# Bulk-list on eBay with a CSV (no API needed)

Comicseller exports an **eBay Seller Hub Reports / File Exchange** CSV of your
"Ready to list" comics. You upload it in Seller Hub and eBay creates all the
listings at once — no developer API or approval required.

## One-time setup (Admin → eBay bulk export)

Set these in Admin so the CSV imports cleanly:

- **Category ID** — eBay category for your comics (defaults to `259104`, US
  Comics). Find the exact ID on eBay if you list in a different category.
- **Condition ID** — eBay's condition code (defaults to `4000`). Adjust per how
  you list (graded vs. raw).
- **Duration** — `GTC` (good-til-cancelled) for fixed price; auctions use 7 days.
- **Shipping / Payment / Return policy** — type your eBay **Business Policy
  names exactly** as they appear in eBay → Account → Business policies.
- **Public base URL** — the internet-reachable HTTPS address of this app (e.g.
  `https://comics.example.com`). eBay fetches photos from public URLs, so this
  must be reachable from the internet for images to attach. If the app is only
  on your LAN, leave it blank and add photos in eBay after upload.

## Exporting

1. Get comics to **Ready** (Mark ready to list on each detail page).
2. On **Inventory**, click **⬇ eBay CSV** (exports the current status filter, or
   Ready if "ALL"). A `comicseller-ebay.csv` downloads.

## Uploading to eBay

1. Go to **Seller Hub → Reports → Upload** (or "Create listings" → upload).
2. Upload `comicseller-ebay.csv`.
3. eBay validates and creates the listings. Review the results/report for any
   rows that need fixing (usually category-specific item specifics or a policy
   name typo).

## What's in the CSV

`Action=Add`, Category, Title (≤80 chars), Description, ConditionID, PicURL
(pipe-separated), Format (FixedPrice/Auction from the recommendation), Duration,
StartPrice (recommended price), Quantity 1, CustomLabel (your SKU), Location,
your three Business Policy names, and a few comic item specifics (Series Title,
Issue Number, Publisher, Grade).

## Notes

- Price comes from each comic's **recommended price** — price your books first.
- Auctions export with a 7-day duration and the recommended price as the start.
- Item specifics vary by eBay category; if eBay flags missing required specifics,
  add them in the listing or extend the export columns.
- This is the no-API path. If your eBay developer API is later approved, we can
  add true one-click posting via the Inventory API — but this CSV route already
  gets your whole collection listed in bulk today.
