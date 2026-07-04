/**
 * Build an eBay Seller Hub Reports / File Exchange bulk-listing CSV (Action=Add)
 * from "ready to list" comics. Uses eBay Business Policy names for
 * shipping/payment/returns and public photo URLs. No eBay API required — the
 * seller uploads the CSV in Seller Hub → Reports → Upload.
 */

export interface EbayExportSettings {
  ebayCategoryId: string;
  ebayConditionId: string;
  ebayDuration: string;
  ebayShippingProfile: string;
  ebayPaymentProfile: string;
  ebayReturnProfile: string;
  publicBaseUrl: string;
}

export interface CsvPhoto {
  url: string | null;
  isPrimary: boolean;
}

export interface CsvComic {
  sku: string;
  title: string;
  issueNumber: string | null;
  publisher: string | null;
  variant: string | null;
  year: number | null;
  grade: number | null;
  graded: boolean;
  gradingCompany: string | null;
  condition: string | null;
  keyIssue: boolean;
  keyNotes: string | null;
  location: string | null;
  recommendedPrice: unknown;
  recommendedFormat: string | null;
  photos: CsvPhoto[];
}

const TITLE_MAX = 80;

function buildTitle(c: CsvComic): string {
  const parts: string[] = [c.title];
  if (c.issueNumber) parts.push(`#${c.issueNumber}`);
  if (c.publisher) parts.push(c.publisher);
  if (c.year) parts.push(String(c.year));
  if (c.variant) parts.push(c.variant);
  if (c.graded && c.gradingCompany && c.grade) parts.push(`${c.gradingCompany} ${c.grade}`);
  else if (c.grade) parts.push(`${c.grade}`);
  if (c.keyIssue) parts.push("KEY");
  let t = parts.filter(Boolean).join(" ");
  if (t.length > TITLE_MAX) t = t.slice(0, TITLE_MAX).trim();
  return t;
}

function buildDescription(c: CsvComic): string {
  const lines: string[] = [];
  lines.push(`${c.title}${c.issueNumber ? ` #${c.issueNumber}` : ""}`);
  if (c.publisher || c.year) lines.push(`${c.publisher ?? ""}${c.year ? ` (${c.year})` : ""}`.trim());
  if (c.variant) lines.push(`Variant: ${c.variant}`);
  if (c.keyIssue && c.keyNotes) lines.push(`Key issue: ${c.keyNotes}`);
  else if (c.keyIssue) lines.push("Key issue.");
  if (c.graded && c.gradingCompany && c.grade) lines.push(`Condition: ${c.gradingCompany} graded ${c.grade}.`);
  else if (c.grade) lines.push(`Condition: raw, estimated grade ${c.grade}${c.condition ? ` (${c.condition})` : ""}.`);
  else lines.push("Condition: see photos.");
  lines.push("Please review photos, which form part of the description.");
  lines.push("Ships securely in a bag, board, and rigid mailer.");
  return lines.join(" ");
}

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function picUrls(c: CsvComic, baseUrl: string): string {
  if (!baseUrl) return "";
  const base = baseUrl.replace(/\/$/, "");
  const ordered = [...c.photos].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return ordered
    .filter((p) => p.url)
    .map((p) => (p.url!.startsWith("http") ? p.url! : `${base}${p.url}`))
    .join("|");
}

const HEADERS = [
  "Action(SiteID=US|Country=US|Currency=USD|Version=1193)",
  "Category",
  "Title",
  "Description",
  "ConditionID",
  "PicURL",
  "Format",
  "Duration",
  "StartPrice",
  "Quantity",
  "CustomLabel",
  "Location",
  "ShippingProfileName",
  "PaymentProfileName",
  "ReturnProfileName",
  "C:Series Title",
  "C:Issue Number",
  "C:Publisher",
  "C:Grade",
];

export function buildEbayCsv(comics: CsvComic[], s: EbayExportSettings): string {
  const rows: string[] = [HEADERS.map(esc).join(",")];

  for (const c of comics) {
    const isAuction = c.recommendedFormat === "AUCTION";
    const format = isAuction ? "Auction" : "FixedPrice";
    const duration = isAuction ? "Days_7" : s.ebayDuration || "GTC";
    const price =
      c.recommendedPrice == null ? "" : Number(c.recommendedPrice).toFixed(2);
    const gradeText =
      c.graded && c.gradingCompany && c.grade
        ? `${c.gradingCompany} ${c.grade}`
        : c.grade != null
        ? String(c.grade)
        : "";

    const row = [
      "Add",
      s.ebayCategoryId,
      buildTitle(c),
      buildDescription(c),
      s.ebayConditionId,
      picUrls(c, s.publicBaseUrl),
      format,
      duration,
      price,
      "1",
      c.sku,
      c.location ?? "",
      s.ebayShippingProfile,
      s.ebayPaymentProfile,
      s.ebayReturnProfile,
      c.title,
      c.issueNumber ?? "",
      c.publisher ?? "",
      gradeText,
    ];
    rows.push(row.map(esc).join(","));
  }

  return rows.join("\r\n") + "\r\n";
}
