# Free UPC → metadata lookup (Grand Comics Database)

Comicseller can resolve a scanned barcode to comic metadata (series, issue,
publisher, year) **for free and offline**, using a local slice of the
[Grand Comics Database](https://www.comics.org) (GCD). GCD data is CC-BY-SA —
please credit the Grand Comics Database.

## How it works

- A `GcdIssue` table (indexed by barcode) holds the lookup data.
- When you scan a UPC, the app calls `GET /lookup/upc/<digits>`, which matches
  the full barcode, then falls back to the 12-digit main UPC (identifies the
  title even when the scanner didn't read the 5-digit supplement).
- Matches auto-fill the title/issue/publisher/year on the Add and detail screens
  (you still confirm before saving).

It stays empty (and simply returns "no match") until you load GCD data once.

## One-time data load

1. **Get GCD data.** GCD publishes a downloadable database dump (see
   comics.org → Data / Downloads; an account is required). The relevant tables
   are `gcd_issue` (has the `barcode` column), `gcd_series` (series name), and
   `gcd_publisher` (publisher name).

2. **Prepare a delimited file** (CSV or TSV) with a header row and these columns
   (only `barcode` and `series` are required):

   ```
   barcode,series,number,publisher,year
   ```

   Produce it by joining the GCD tables, e.g. (MySQL):

   ```sql
   SELECT i.barcode, s.name AS series, i.number,
          p.name AS publisher, LEFT(i.key_date, 4) AS year
   FROM gcd_issue i
   JOIN gcd_series s   ON i.series_id = s.id
   JOIN gcd_publisher p ON s.publisher_id = p.id
   WHERE i.barcode IS NOT NULL AND i.barcode <> ''
   INTO OUTFILE '/tmp/gcd_barcodes.csv'
   FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
   LINES TERMINATED BY '\n';
   ```

3. **Import it** (run from the `backend/` folder so Prisma resolves):

   ```bash
   cd backend
   node scripts/import-gcd.mjs /path/to/gcd_barcodes.csv --replace
   ```

   `--replace` wipes the table first (use it for a fresh full load). Re-run any
   time GCD publishes updated data.

4. Confirm it loaded: `GET /lookup/status` returns `{ datasetSize, ready }`.

## In Docker / on the NAS

The `GcdIssue` table is created automatically on deploy (schema sync). To load
data into the running container, copy your prepared CSV into the app container
and run the importer there, e.g.:

```bash
docker cp gcd_barcodes.csv <app-container>:/tmp/gcd_barcodes.csv
docker exec -w /app/backend <app-container> node scripts/import-gcd.mjs /tmp/gcd_barcodes.csv --replace
```

(The data persists in Postgres, which is bind-mounted to your NAS folder.)

## Notes & limits

- The 12-digit UPC identifies the title/printing; the 5-digit supplement
  distinguishes issue number + cover. If your scan only captured the main code,
  the app returns the best match plus candidates.
- This is a pluggable provider. If you later get a Key Collector / CovrPrice API,
  it slots in alongside GCD without changing the scan flow.
