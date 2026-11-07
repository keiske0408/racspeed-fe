import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  DEFAULT_QR_EXPIRATION_MINUTES,
  QR_EXPIRATION_OPTIONS,
  decodeSessionSecretMeta,
  encodeSessionSecretMeta,
  evaluateQrScanCheckIn,
  normalizeQrDurationMinutes,
  resolveQrSessionLifecycle,
} from "@/features/activities/rules";

vi.mock("server-only", () => ({}));

const mockAuthGetUser = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockAuthGetUser,
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

vi.mock("@/lib/services/rewards", () => ({
  awardEngagementPoints: vi.fn(async () => undefined),
}));

describe("QR Attendance Module — Rules, Lifecycle & Security Engine", () => {
  it("applies default 20-minute expiration and supports configurable 5, 10, 15, 20, 30, 60 minute options", () => {
    expect(DEFAULT_QR_EXPIRATION_MINUTES).toBe(20);
    expect(QR_EXPIRATION_OPTIONS).toEqual([5, 10, 15, 20, 30, 60]);

    // Default when omitted or invalid
    expect(normalizeQrDurationMinutes()).toBe(20);
    expect(normalizeQrDurationMinutes(null)).toBe(20);
    expect(normalizeQrDurationMinutes(undefined)).toBe(20);
    expect(normalizeQrDurationMinutes(0)).toBe(20);

    // Custom configurable options
    for (const mins of QR_EXPIRATION_OPTIONS) {
      expect(normalizeQrDurationMinutes(mins)).toBe(mins);
    }

    // Clamps positive numbers between 1 and 1440
    expect(normalizeQrDurationMinutes(45)).toBe(45);
    expect(normalizeQrDurationMinutes(9999)).toBe(1440);
  });

  it("encodes and decodes cryptographic session metadata with SHA-256 hash and lifecycle status", () => {
    const encoded = encodeSessionSecretMeta({
      hash: "abc123sha256hash",
      lifecycleStatus: "PAUSED",
      durationMinutes: 30,
      opensAt: "2026-11-07T08:00:00.000Z",
      closesAt: "2026-11-07T10:00:00.000Z",
    });
    const decoded = decodeSessionSecretMeta(encoded);
    expect(decoded.hash).toBe("abc123sha256hash");
    expect(decoded.lifecycleStatus).toBe("PAUSED");
    expect(decoded.durationMinutes).toBe(30);
    expect(decoded.opensAt).toBe("2026-11-07T08:00:00.000Z");
    expect(decoded.closesAt).toBe("2026-11-07T10:00:00.000Z");
  });

  it("evaluates server-side expiration strictly on the server clock (Scenario D)", () => {
    const generatedAt = new Date("2026-11-07T08:00:00.000Z");
    const expiresAt = new Date("2026-11-07T08:20:00.000Z"); // 20m default

    // At 8:19:59 AM -> ACTIVE
    const activeLifecycle = resolveQrSessionLifecycle({
      dbStatus: "ACTIVE",
      secretHash: encodeSessionSecretMeta({
        hash: "h1",
        lifecycleStatus: "ACTIVE",
        durationMinutes: 20,
      }),
      expiresAt: expiresAt.toISOString(),
      now: new Date("2026-11-07T08:19:59.000Z"),
    });
    expect(activeLifecycle.status).toBe("ACTIVE");

    const activeCheck = evaluateQrScanCheckIn({
      sessionLifecycle: activeLifecycle.status,
      activityStatus: "PLANNED",
      isArchived: false,
      qrCheckInEnabled: true,
      isParticipant: true,
      alreadyCheckedIn: false,
    });
    expect(activeCheck).toEqual({ allowed: true, code: "OK" });

    // At 8:20:01 AM -> EXPIRED
    const expiredLifecycle = resolveQrSessionLifecycle({
      dbStatus: "ACTIVE",
      secretHash: encodeSessionSecretMeta({
        hash: "h1",
        lifecycleStatus: "ACTIVE",
        durationMinutes: 20,
      }),
      expiresAt: expiresAt.toISOString(),
      now: new Date("2026-11-07T08:20:01.000Z"),
    });
    expect(expiredLifecycle.status).toBe("EXPIRED");

    const expiredCheck = evaluateQrScanCheckIn({
      sessionLifecycle: expiredLifecycle.status,
      activityStatus: "PLANNED",
      isArchived: false,
      qrCheckInEnabled: true,
      isParticipant: true,
      alreadyCheckedIn: false,
    });
    expect(expiredCheck).toEqual({
      allowed: false,
      code: "TOKEN_EXPIRED",
      reason:
        "This QR code has expired. Please ask the event administrator to generate a new attendance QR code.",
    });
    expect(generatedAt.getTime()).toBeLessThan(expiresAt.getTime());
  });

  it("rejects revoked QR tokens immediately (Scenario: Revoked QR)", () => {
    const revokedLifecycle = resolveQrSessionLifecycle({
      dbStatus: "CLOSED",
      secretHash: encodeSessionSecretMeta({
        hash: "h1",
        lifecycleStatus: "REVOKED",
        durationMinutes: 20,
      }),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      now: new Date(),
    });
    expect(revokedLifecycle.status).toBe("REVOKED");

    const revokedCheck = evaluateQrScanCheckIn({
      sessionLifecycle: revokedLifecycle.status,
      activityStatus: "ONGOING",
      isArchived: false,
      qrCheckInEnabled: true,
      isParticipant: true,
      alreadyCheckedIn: false,
    });
    expect(revokedCheck.allowed).toBe(false);
    expect(revokedCheck.code).toBe("TOKEN_REVOKED");
  });

  it("rejects scans when attendance session is paused, closed, or outside check-in window (Scenario E)", () => {
    const pausedCheck = evaluateQrScanCheckIn({
      sessionLifecycle: "PAUSED",
      activityStatus: "ONGOING",
      isArchived: false,
      qrCheckInEnabled: true,
      isParticipant: true,
      alreadyCheckedIn: false,
    });
    expect(pausedCheck).toEqual({
      allowed: false,
      code: "SESSION_CLOSED",
      reason: "Attendance check-in is currently closed.",
    });

    const closedCheck = evaluateQrScanCheckIn({
      sessionLifecycle: "CLOSED",
      activityStatus: "ONGOING",
      isArchived: false,
      qrCheckInEnabled: true,
      isParticipant: true,
      alreadyCheckedIn: false,
    });
    expect(closedCheck).toEqual({
      allowed: false,
      code: "SESSION_CLOSED",
      reason: "Attendance check-in is currently closed.",
    });
  });

  it("rejects ineligible users with NOT_ELIGIBLE (Scenario F)", () => {
    const ineligibleCheck = evaluateQrScanCheckIn({
      sessionLifecycle: "ACTIVE",
      activityStatus: "ONGOING",
      isArchived: false,
      qrCheckInEnabled: true,
      isParticipant: false,
      alreadyCheckedIn: false,
    });
    expect(ineligibleCheck).toEqual({
      allowed: false,
      code: "NOT_ELIGIBLE",
      reason:
        "You are not authorized or registered to attend this event. Only active club members and aspirants are eligible.",
    });
  });

  it("prevents duplicate check-ins across same or regenerated QR tokens (Scenario C)", () => {
    const duplicateCheck = evaluateQrScanCheckIn({
      sessionLifecycle: "ACTIVE",
      activityStatus: "ONGOING",
      isArchived: false,
      qrCheckInEnabled: true,
      isParticipant: true,
      alreadyCheckedIn: true,
    });
    expect(duplicateCheck).toEqual({
      allowed: false,
      code: "ALREADY_CHECKED_IN",
      reason: "You are already checked in for this event.",
    });
  });

  it("distinguishes SCHEDULED, ACTIVE, EXPIRED, PAUSED, CLOSED, and REVOKED session lifecycle states", () => {
    const now = new Date("2026-11-07T08:00:00.000Z");
    const futureExpiry = "2026-11-07T08:20:00.000Z";

    expect(
      resolveQrSessionLifecycle({
        dbStatus: "ACTIVE",
        secretHash: encodeSessionSecretMeta({
          hash: "h",
          lifecycleStatus: "SCHEDULED",
          durationMinutes: 20,
          opensAt: "2026-11-07T08:10:00.000Z",
        }),
        expiresAt: futureExpiry,
        now,
      }).status,
    ).toBe("SCHEDULED");

    expect(
      resolveQrSessionLifecycle({
        dbStatus: "ACTIVE",
        secretHash: encodeSessionSecretMeta({
          hash: "h",
          lifecycleStatus: "ACTIVE",
          durationMinutes: 20,
        }),
        expiresAt: futureExpiry,
        now,
      }).status,
    ).toBe("ACTIVE");
  });
});

describe("POST /api/attendance/check-in — Endpoint Integration Scenarios", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetCheckInRateLimiter } = await import(
      "@/app/api/attendance/check-in/route"
    );
    resetCheckInRateLimiter();
  });

  it("Scenario B: rejects unauthenticated QR scan with 401 UNAUTHENTICATED so client/proxy redirects to login preserving token", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { POST } = await import("@/app/api/attendance/check-in/route");
    const req = new NextRequest("http://localhost:3000/api/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ sessionToken: "racspeed-validtoken123456" }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });

  it("Scenario A: automatically verifies and records attendance for authenticated eligible member", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "member@racspeed.org" } },
      error: null,
    });

    const futureExpiry = new Date(Date.now() + 20 * 60_000).toISOString();
    const futureActivityEnd = new Date(Date.now() + 120 * 60_000).toISOString();

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "attendance_sessions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "session-1",
                  event_id: null,
                  activity_id: "activity-1",
                  session_token: "racspeed-validtoken123456",
                  secret_hash: encodeSessionSecretMeta({
                    hash: "hash",
                    lifecycleStatus: "ACTIVE",
                    durationMinutes: 20,
                  }),
                  status: "ACTIVE",
                  created_at: new Date().toISOString(),
                  expires_at: futureExpiry,
                  events: null,
                  activities: {
                    id: "activity-1",
                    title: "Coastal Clean-Up Drive",
                    kind: "SERVICE_PROJECT",
                    status: "ONGOING",
                    club_id: "00000000-0000-0000-0000-000000000001",
                    start_at: new Date().toISOString(),
                    end_at: futureActivityEnd,
                    location: "San Pedro",
                    volunteer_hours_default: 3,
                    legacy_event_id: null,
                  },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "activity_log") {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "user-1",
                  full_name: "Juan Dela Cruz",
                  email: "member@racspeed.org",
                  status: "ACTIVE",
                  is_platform_admin: false,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "club_memberships") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    membership_status: "ACTIVE",
                    profiles: { status: "ACTIVE" },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "attendance_records") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: "att-1",
                  check_in_time: "2026-11-07T08:05:00.000Z",
                  volunteer_hours: 3,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        upsert: async () => ({ error: null }),
        insert: async () => ({ error: null }),
      };
    });

    const { POST } = await import("@/app/api/attendance/check-in/route");
    const req = new NextRequest("http://localhost:3000/api/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ sessionToken: "racspeed-validtoken123456" }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe("CHECKED_IN");
    expect(body.eventTitle).toBe("Coastal Clean-Up Drive");
    expect(body.participantName).toBe("Juan Dela Cruz");
    expect(body.volunteerHours).toBe(3);
  });

  it("Scenario C & Concurrent Scan Race Condition: returns 409 ALREADY_CHECKED_IN with original timestamp when Postgres unique index 23505 triggers", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "member@racspeed.org" } },
      error: null,
    });

    const futureExpiry = new Date(Date.now() + 20 * 60_000).toISOString();
    const futureActivityEnd = new Date(Date.now() + 120 * 60_000).toISOString();
    let attendanceSelectCount = 0;

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "attendance_sessions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "session-1",
                  event_id: null,
                  activity_id: "activity-1",
                  session_token: "racspeed-validtoken123456",
                  secret_hash: encodeSessionSecretMeta({
                    hash: "hash",
                    lifecycleStatus: "ACTIVE",
                    durationMinutes: 20,
                  }),
                  status: "ACTIVE",
                  created_at: new Date().toISOString(),
                  expires_at: futureExpiry,
                  events: null,
                  activities: {
                    id: "activity-1",
                    title: "Coastal Clean-Up Drive",
                    kind: "SERVICE_PROJECT",
                    status: "ONGOING",
                    club_id: "00000000-0000-0000-0000-000000000001",
                    start_at: new Date().toISOString(),
                    end_at: futureActivityEnd,
                    location: "San Pedro",
                    volunteer_hours_default: 3,
                    legacy_event_id: null,
                  },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "activity_log") {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "user-1",
                  full_name: "Juan Dela Cruz",
                  email: "member@racspeed.org",
                  status: "ACTIVE",
                  is_platform_admin: false,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "club_memberships") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    membership_status: "ACTIVE",
                    profiles: { status: "ACTIVE" },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "attendance_records") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => {
                  attendanceSelectCount += 1;
                  if (attendanceSelectCount === 1) {
                    return { data: null, error: null };
                  }
                  return {
                    data: {
                      id: "att-1",
                      check_in_time: "2026-11-07T08:05:00.000Z",
                      volunteer_hours: 3,
                    },
                    error: null,
                  };
                },
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { code: "23505", message: "duplicate key value" },
              }),
            }),
          }),
        };
      }
      return {
        upsert: async () => ({ error: null }),
        insert: async () => ({ error: null }),
      };
    });

    const { POST } = await import("@/app/api/attendance/check-in/route");
    const req = new NextRequest("http://localhost:3000/api/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ sessionToken: "racspeed-validtoken123456" }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("ALREADY_CHECKED_IN");
    expect(body.alreadyCheckedIn).toBe(true);
    expect(body.error).toBe("You are already checked in for this event.");
    expect(body.checkInTime).toBe("2026-11-07T08:05:00.000Z");
  });
});
