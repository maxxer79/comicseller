/**
 * Comic book barcode parser.
 *
 * A modern comic barcode is 17 digits: a 12-digit UPC-A plus a 5-digit
 * supplement.
 *
 *   digit  1      number system
 *   digits 2-6    publisher code (assigned by GS1)
 *   digits 7-11   series code (same for every issue of a title)
 *   digit  12     check digit (validates digits 1-11)
 *   digits 13-17  supplement: issue / cover / printing
 *
 * The supplement uses one of two layouts and the barcode does NOT say which:
 *   III·C·P  (traditional)      issue=digits 1-3, cover=digit 4, printing=digit 5
 *   II·CC·P  (extended cover)   issue=digits 1-2, cover=digits 3-4, printing=digit 5
 * So we decode BOTH and let the AI cover-read / the user confirm.
 */

/** Publisher code (digits 1-5 of the barcode) -> publisher name. Extend freely. */
export const PUBLISHER_PREFIXES: Record<string, string> = {
  "75960": "Marvel Comics",
  "76194": "DC Comics",
  "70985": "Image Comics",
  "76156": "Dark Horse Comics",
  "82771": "IDW Publishing",
  "72513": "Dynamite Entertainment",
};

export interface SupplementDecode {
  layout: "III·C·P" | "II·CC·P";
  issue: string;
  cover: string;
  printing: string;
}

export interface ParsedBarcode {
  raw: string; // digits only
  numberSystem: string;
  publisherCode: string; // 5 digits
  seriesCode: string; // 5 digits
  checkDigit: string;
  checkDigitValid: boolean;
  publisher: string | null; // from PUBLISHER_PREFIXES
  hasSupplement: boolean;
  supplement: string | null; // 5 digits, or null
  supplementDecodes: SupplementDecode[]; // best-guess (III·C·P) first
  mainUpc: string; // 12 digits
  full: string; // 17 (with supplement) or 12
}

/** UPC-A check digit for the first 11 digits. Returns 0-9. */
export function upcCheckDigit(first11: string): number {
  const d = first11.replace(/\D/g, "").slice(0, 11).padStart(11, "0");
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const n = Number(d[i]);
    sum += i % 2 === 0 ? n * 3 : n; // positions 1,3,5… (0-indexed even) ×3
  }
  return (10 - (sum % 10)) % 10;
}

function stripNum(s: string): string {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? String(n) : "?";
}

function decodeSupplement(sup: string): SupplementDecode[] {
  return [
    { layout: "III·C·P", issue: stripNum(sup.slice(0, 3)), cover: stripNum(sup[3]), printing: stripNum(sup[4]) },
    { layout: "II·CC·P", issue: stripNum(sup.slice(0, 2)), cover: stripNum(sup.slice(2, 4)), printing: stripNum(sup[4]) },
  ];
}

/** Parse a scanned/typed comic barcode. Returns null if fewer than 12 digits. */
export function parseComicBarcode(raw: string): ParsedBarcode | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 12) return null;

  const mainUpc = digits.slice(0, 12);
  const numberSystem = mainUpc[0];
  const publisherCode = mainUpc.slice(1, 6);
  const seriesCode = mainUpc.slice(6, 11);
  const checkDigit = mainUpc[11];
  const checkDigitValid = upcCheckDigit(mainUpc.slice(0, 11)) === Number(checkDigit);

  const supplement = digits.length >= 17 ? digits.slice(12, 17) : null;

  return {
    raw: digits,
    numberSystem,
    publisherCode,
    seriesCode,
    checkDigit,
    checkDigitValid,
    publisher: PUBLISHER_PREFIXES[mainUpc.slice(0, 5)] ?? null,
    hasSupplement: supplement !== null,
    supplement,
    supplementDecodes: supplement ? decodeSupplement(supplement) : [],
    mainUpc,
    full: supplement ? mainUpc + supplement : mainUpc,
  };
}
