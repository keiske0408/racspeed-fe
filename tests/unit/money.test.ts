import { describe, it, expect } from "vitest";
import { toCentavos, fromCentavos, sumCentavos, lineAmount, formatPHP } from "@/lib/utils/money";

describe("Money Utilities (Integer Centavos)", () => {
  it("converts decimal strings and numbers to centavos safely", () => {
    expect(toCentavos("150.00")).toBe(15000);
    expect(toCentavos("150.5")).toBe(15050);
    expect(toCentavos("0.05")).toBe(5);
    expect(toCentavos(1250.75)).toBe(125075);
    expect(toCentavos(0)).toBe(0);
    expect(toCentavos("")).toBe(0);
    expect(toCentavos(null)).toBe(0);
  });

  it("handles commas in formatted strings", () => {
    expect(toCentavos("1,250.50")).toBe(125050);
    expect(toCentavos("10,000,000.00")).toBe(1000000000);
  });

  it("converts centavos to 2-decimal string", () => {
    expect(fromCentavos(15000 as any)).toBe("150.00");
    expect(fromCentavos(5 as any)).toBe("0.05");
    expect(fromCentavos(0 as any)).toBe("0.00");
    expect(fromCentavos(-2500 as any)).toBe("-25.00");
  });

  it("calculates exact line item totals without float inaccuracies", () => {
    // 3 items @ 33.33 each
    const total = lineAmount(3, "33.33");
    expect(total).toBe(9999); // 99.99 PHP
    expect(fromCentavos(total)).toBe("99.99");
  });

  it("sums an array of centavos", () => {
    expect(sumCentavos([1000, 2550, 450] as any)).toBe(4000);
  });

  it("formats PHP currency correctly", () => {
    const formatted = formatPHP(150000 as any, { isCentavos: true });
    expect(formatted).toContain("1,500.00");
  });
});
