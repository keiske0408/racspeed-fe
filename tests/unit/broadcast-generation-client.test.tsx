import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BroadcastsClient } from "@/app/(app)/broadcasts/broadcasts-client";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("shows generation errors without silently replacing the current composition", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ error: "Generation timed out. Please try again." }), { status: 504 },
  ));
  vi.stubGlobal("fetch", fetch);
  render(<BroadcastsClient sources={[]} />);
  const textareas = screen.getAllByRole("textbox");
  const outputBefore = textareas.map((textarea) => (textarea as HTMLTextAreaElement).value);
  fireEvent.click(screen.getByRole("button", { name: "Extract & Compose GC Invite" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Generation timed out");
  expect(textareas.map((textarea) => (textarea as HTMLTextAreaElement).value)).toEqual(outputBefore);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty("apiKey");
});

it("removes legacy stored provider credentials and no longer offers a key input", async () => {
  localStorage.setItem("racspeed_gemini_key", "legacy-test-key");
  render(<BroadcastsClient sources={[]} />);
  await waitFor(() => expect(localStorage.getItem("racspeed_gemini_key")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "AI Engine Information" }));
  expect(screen.getByText(/Administrators configure Gemini on the server/)).toBeInTheDocument();
  expect(document.querySelector('input[type="password"]')).toBeNull();
});
