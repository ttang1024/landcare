# LandcareLink — Catchment Mapping Platform

GIS platform for **NZ Landcare Trust** (Ngā Matapopore Whenua). Adds an integration
layer on top of the existing LandcareLink ecosystem (PHP, MySQL, Scriptcase, ArcGIS
Online) — it does **not** replace those systems.

**Live:** https://landcarelink-web.vercel.app/

## Architecture

```
Browser
  ▼
Next.js 16 (Vercel)  ── ArcGIS Maps SDK (client render only)
  ▼  HTTPS / JSON
PHP 8.3 REST API (Clean Architecture)
  └── MySQL 8  (system of record)
```

The API surface is minimal: the frontend consumes `GET /v1/map/groups` (plus
`GET /v1/health` for ops).

```
api/      PHP 8.3 backend (Domain / Infrastructure / Presentation)
web/      Next.js 16 + React 19 frontend
db/       MySQL schema and migrations
.github/  CI/CD workflows
```

## Setup

```bash
cp .env.example .env                  # fill in secrets
cd api && composer install            # backend
cd ../web && npm install              # frontend
mysql -u root -p < db/schema.sql      # database
```

## Develop

```bash
cd api && composer serve   # backend  → http://localhost:8080
cd web && npm run dev      # frontend → http://localhost:3000
```

## Test

```bash
cd api && composer test       # PHPUnit
cd web && npm run test        # Vitest
cd web && npm run test:e2e    # Playwright
cd web && npm run test:a11y   # Accessibility
```

## Deploy

- **Frontend** → Vercel, project `landcarelink-web` (root: `web/`)
- **Backend** → VPS / Railway / Render / DigitalOcean (`api/`)

```bash
cd web && vercel          # preview
cd web && vercel --prod   # production
```

> Requires Next.js ≥ 16.2.9 — Vercel blocks deploys of versions with open advisories.

## Map tools

The catchment map (ArcGIS Maps SDK) ships with:

- **Search** — find a New Zealand address (geocoder constrained to NZL).
- **Measure** — distance and area tools, with clear.
- **Draw** — sketch points/lines/polygons; annotations persist across reloads.
- **Bookmarks** — save and revisit viewpoints (persisted).
- **Print** — export the current map to PDF/image.
- **Basemap toggle** — switch between topographic and satellite imagery.
- **Home / Locate / Fullscreen** — reset extent, geolocate, expand to screen.
- **Legend / Scale bar / coordinate readout** — context for what's on screen.

Top-left expandable tools are grouped, so opening one collapses the previously open one.

## Notes

- **Config** — see [`.env.example`](.env.example); secrets stay in env vars, never
  exposed to the frontend. ArcGIS basemaps render client-side via the Maps SDK.
- **Security** — Zod validation, rate limiting, CSRF protection, output sanitisation,
  clean dependency audit.
- **Observability** — structured logging, request IDs, metrics, audit logs, health
  checks. Contacts, emails, API keys and PII are never logged.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `401`/`404` from API | `NEXT_PUBLIC_API_BASE_URL` reachable / CORS configured? |
| Empty map | `GET /v1/map/groups` returning data? DB seeded? |
