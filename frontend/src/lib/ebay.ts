import type { Comic } from "../api";

/**
 * Compose eBay-ready listing text from a comic. Used for the copy-paste
 * workflow (works with no eBay API access). eBay titles are capped at 80 chars.
 */

const EBAY_TITLE_MAX = 80;

export function buildEbayTitle(c: Comic): string {
  const parts: string[] = [];
  parts.push(c.title);
  if (c.issueNumber) parts.push(`#${c.issueNumber}`);
  if (c.publisher) parts.push(c.publisher);
  if (c.year) parts.push(String(c.year));
  if (c.variant) parts.push(c.variant);
  if (c.graded && c.gradingCompany && c.grade) {
    parts.push(`${c.gradingCompany} ${c.grade}`);
  } else if (c.grade) {
    parts.push(`${c.grade} grade`);
  }
  if (c.keyIssue) parts.push("KEY");

  let title = parts.filter(Boolean).join(" ");
  if (title.length > EBAY_TITLE_MAX) title = title.slice(0, EBAY_TITLE_MAX).trim();
  return title;
}

export function buildEbayDescription(c: Comic): string {
  const lines: string[] = [];
  lines.push(`${c.title}${c.issueNumber ? ` #${c.issueNumber}` : ""}`);
  if (c.publisher || c.year) {
    lines.push(`${c.publisher ?? ""}${c.year ? ` (${c.year})` : ""}`.trim());
  }
  if (c.variant) lines.push(`Variant: ${c.variant}`);
  if (c.keyIssue && c.keyNotes) lines.push(`Key issue: ${c.keyNotes}`);
  else if (c.keyIssue) lines.push("Key issue.");

  lines.push("");
  if (c.graded && c.gradingCompany && c.grade) {
    lines.push(`Condition: ${c.gradingCompany} graded ${c.grade}.`);
  } else if (c.grade) {
    lines.push(`Condition: raw, estimated grade ${c.grade}${c.condition ? ` (${c.condition})` : ""}.`);
  } else {
    lines.push("Condition: see photos.");
  }
  lines.push("Please review photos, which form part of the description.");
  lines.push("Ships securely in a bag, board, and rigid mailer.");
  return lines.join("\n");
}
