/**
 * Money helpers. PHP amounts are handled as integer centavos in TypeScript to avoid
 * binary floating-point errors. The database stores numeric(12,2).
 */

export type Centavos = number & { readonly __brand?: "centavos" };

const AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/;

/** Parse a decimal string/number such as "1500.5" or 1500.5 into integer centavos. */
export function toCentavos(value: string | number | null | undefined): Centavos {
  if (value === null || value === undefined || value === "") return 0;
  const str = typeof value === "number" ? value.toFixed(2) : value.trim().replace(/,/g, "");
  if (!AMOUNT_RE.test(str)) {
    throw new Error(`Invalid money amount: ${String(value)}`);
  }
  const negative = str.startsWith("-");
  const [whole, frac = ""] = str.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Amount out of range");
  return (negative ? -cents : cents) as Centavos;
}

/** Convert centavos to a fixed 2-decimal string suitable for numeric columns. */
export function fromCentavos(cents: Centavos): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function sumCentavos(values: Iterable<Centavos>): Centavos {
  let total = 0;
  for (const v of values) total += v;
  return total as Centavos;
}

/** Multiply a unit amount by a quantity (quantity may have up to 2 decimals). */
export function lineAmount(quantity: string | number, unit: string | number): Centavos {
  const q = toCentavos(quantity); // quantity in hundredths
  const u = toCentavos(unit);
  // (q/100) * u, rounded half away from zero to the nearest centavo
  const raw = (q * u) / 100;
  return (Math.sign(raw) * Math.round(Math.abs(raw))) as Centavos;
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

export function formatPHP(value: Centavos | string | number | null | undefined, opts?: { isCentavos?: boolean }): string {
  if (value === null || value === undefined) return "—";
  const cents = opts?.isCentavos ? Number(value) : toCentavos(value as string | number);
  return phpFormatter.format(cents / 100);
}
