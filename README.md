# Comicseller

A hosted web app to help sell a large comic book collection on eBay.

**Workflow:** photo → identify the comic → AI suggests condition (you confirm) →
pull price comps → recommend price + auction/BIN + sell-now/hold → review &
approve → export or auto-post to eBay → track listings & improve.

## Status: Phase 1 — Foundation

Backend scaffold with Postgres + Prisma data model and a health endpoint.

## Build phases

1. **Foundation** *(current)* — Docker, Postgres, Prisma schema, health check.
2. **Intake + identify** — upload photo, vision model returns title/issue/publisher + suggested grade, you confirm.
3. **Pricing + recommendation** — active-listing comps (free), avg/recommended price, auction-vs-BIN, sell-vs-hold.
4. **Review + inventory** — approval queue, eBay-ready metadata, copy-paste export, inventory list.
5. **eBay integration** — direct listing, tracking, improvement suggestions.
6. **Batch throughput** — bulk intake and keyboard-fast review for thousands of books.

## Tech stack

React + TypeScript (frontend, later phase), Node/Express + TypeScript (backend),
Prisma + PostgreSQL, object storage for photos, Docker.

## Getting started (Phase 1)

```bash
# 1. Start Postgres
docker compose up -d db

# 2. Install backend deps
cd backend
npm install

# 3. Copy env and set values
cp .env.example .env

# 4. Create the database schema
npx prisma migrate dev --name init

# 5. Run the server
npm run dev
```

Then visit http://localhost:4000/health — you should see `{"status":"ok"}`.

To run everything (db + backend) in Docker:

```bash
docker compose up --build
```

### Frontend (React)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/comics`, `/import`, and
`/photos` to the backend on :4000, so both must be running.

Tip: to try AI identification without an Anthropic key, set `VISION_MOCK=1` in
`backend/.env`.

## Repo layout

```
/backend
  /src
    /routes      HTTP routes (health, and later comics/pricing/listings/ebay)
    /services    business logic (vision, pricing, ebay, storage)
    /lib         prisma client, config, errors
  prisma/schema.prisma
/docs            setup guides (eBay developer account, etc.)
docker-compose.yml
```

See [`docs/ebay-developer-setup.md`](docs/ebay-developer-setup.md) to start the
eBay API application now — it's the long pole for later phases.
