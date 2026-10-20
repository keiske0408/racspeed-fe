import { describe, it, expect } from "vitest";
import { rotaryYearFor, rotaryYearRange } from "@/lib/utils/rotary-year";

describe("Rotary Year Utilities", () => {
  it("determines correct Rotary year for dates before July 1", () => {
    // June 15, 2026 is part of Rotary Year 2025-26
    const date = new Date("2026-06-15T00:00:00Z");
    expect(rotaryYearFor(date)).toBe("2025-26");
  });

  it("determines correct Rotary year for dates on and after July 1", () => {
    // July 1, 2026 is part of Rotary Year 2026-27
    const date = new Date("2026-07-01T04:00:00Z");
    expect(rotaryYearFor(date)).toBe("2026-27");
    // Oct 20, 2026
    const dateOct = new Date("2026-10-20T12:00:00Z");
    expect(rotaryYearFor(dateOct)).toBe("2026-27");
  });

  it("calculates accurate UTC boundaries for a Rotary year", () => {
    const range = rotaryYearRange("2026-27");
    expect(range.start.toISOString()).toBe("2026-06-30T16:00:00.000Z"); // July 1 00:00 Asia/Manila (UTC+8) is 16:00 UTC previous day
    expect(range.end.toISOString()).toBe("2027-06-30T16:00:00.000Z");
  });

  it("throws on invalid Rotary year label", () => {
    expect(() => rotaryYearRange("2026-28")).toThrow();
    expect(() => rotaryYearRange("invalid")).toThrow();
  });
});
