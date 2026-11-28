import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/broadcasts/generate/route";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  access: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.user,
  getUserAccessContext: mocks.access,
}));
vi.mock("server-only", () => ({}));

let sequence = 0;
function request(body: unknown = { rawText: "Volunteer coastal cleanup", tone: "formal" }) {
  return new Request("http://localhost/api/broadcasts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": `test-${sequence}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sequence++;
  mocks.user.mockReset().mockResolvedValue({ id: `user-${sequence}`, status: "ACTIVE" });
  mocks.access.mockReset().mockResolvedValue({
    isPlatformAdmin: false, permissions: new Set(["NOTIFICATION_SEND"]),
  });
  mocks.fetch.mockReset().mockImplementation(async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ title: "Enhanced cleanup" }) }] } }],
  })));
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("GEMINI_API_KEY", "test-provider-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("broadcast generation protection", () => {
  it("rejects anonymous and inactive callers without calling the provider", async () => {
    mocks.user.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    mocks.user.mockResolvedValueOnce({ id: "suspended", status: "SUSPENDED" });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("requires NOTIFICATION_SEND", async () => {
    mocks.access.mockResolvedValue({ isPlatformAdmin: false, permissions: new Set() });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { rawText: "x".repeat(10_001) },
    { rawText: "Cleanup", tone: "invalid" },
    { rawText: "Cleanup", apiKey: "caller-key" },
  ])("rejects invalid input %# before provider use", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("rejects oversized streamed bodies without relying on Content-Length", async () => {
    expect((await POST(request({ rawText: "x".repeat(33_000) }))).status).toBe(413);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    const req = new Request("http://localhost", { method: "POST", body: "{" });
    expect((await POST(req)).status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("returns a validated Gemini draft with the existing output shape", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true, draft: { title: "Enhanced cleanup" },
      formattedMessage: expect.any(String), poweredBy: "gemini",
    });
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).not.toContain("key=");
    expect(options.headers["x-goog-api-key"]).toBe("test-provider-key");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(timeout).toHaveBeenCalledWith(15_000);
    timeout.mockRestore();
  });
  it("rejects the sixth generation per user within a minute", async () => {
    for (let i = 0; i < 5; i++) expect((await POST(request())).status).toBe(200);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mocks.fetch).toHaveBeenCalledTimes(5);
  });
  it("limits a shared IP to thirty requests across different users", async () => {
    const ip = `shared-ip-${sequence}`;
    for (let i = 0; i < 31; i++) {
      mocks.user.mockResolvedValue({ id: `ip-user-${sequence}-${i}`, status: "ACTIVE" });
      const req = request();
      req.headers.set("x-real-ip", ip);
      expect((await POST(req)).status).toBe(i < 30 ? 200 : 429);
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(30);
  });
  it("accepts the maximum prompt length and resets quota after a minute", async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 5; i++) {
        expect((await POST(request({ rawText: "x".repeat(10_000) }))).status).toBe(200);
      }
      expect((await POST(request())).status).toBe(429);
      vi.advanceTimersByTime(60_000);
      expect((await POST(request())).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
  it("returns an explicit timeout instead of a success-shaped fallback", async () => {
    mocks.fetch.mockRejectedValue(new DOMException("Timeout", "TimeoutError"));
    expect((await POST(request())).status).toBe(504);
  });
  it.each([new Response("failure", { status: 503 }), new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"thingsToBring":"invalid"}' }] } }],
  }))])("returns explicit provider failure", async (providerResponse) => {
    mocks.fetch.mockResolvedValue(providerResponse);
    expect((await POST(request())).status).toBe(502);
  });
  it("uses the local parser when no server provider key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_GENAI_API_KEY", "");
    expect(await (await POST(request())).json()).toMatchObject({
      success: true, poweredBy: "smart_local_nlp",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
