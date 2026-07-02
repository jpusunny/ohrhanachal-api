# ohrhanachal-api

Commerce backend and admin console for Ohr Hanachal.

- **Framework:** Next.js 15 (App Router, TypeScript) — serves both the admin UI and the JSON API from one process.
- **Database:** PostgreSQL via Prisma.
- **Styling:** Tailwind CSS.
- **Auth:** email + password (bcrypt), httpOnly signed session cookie (JWT via `jose`), middleware-guarded `/admin/*` and `/api/admin/*`.

## Layout

```
prisma/schema.prisma        # data model
scripts/seed-admin.ts       # first-run admin seed
src/app/                    # routes (pages + API)
  admin/                    # admin UI
  api/                      # JSON API (health, auth, admin/*)
  login/                    # login page
src/lib/                    # prisma client, session, helpers
src/middleware.ts           # session guard
Dockerfile                  # production image
```

## Data model

- `Product` — title, Hebrew title, author, series, description HTML, status (draft|active), optional unique `voiceCode` for future phone ordering.
- `Variant` — product format (Regular / Pocket / Pocket Leather / set), unique SKU, price in cents, weight.
- `ProductImage` — URL + alt + position.
- `InventoryLevel` — one row per variant with `onHand` and `reserved`.
- `StockMovement` — full audit trail: every change to `onHand` writes one row (`delta`, `reason`, `note`, `actor`). This app replaces the owner's stock spreadsheet.
- `AdminUser` — email + bcrypt hash + role.

## Local setup

```bash
cp .env.example .env         # fill in DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npx prisma migrate dev
npm run seed:admin
npm run dev                  # http://localhost:3000
```

## API

Public:
- `GET  /api/health` → `{ ok: true }`
- `POST /api/auth/login` `{ email, password }` → sets `ohr_session` cookie
- `POST /api/auth/logout` → clears cookie

Admin (session cookie required — middleware returns 401 for `/api/admin/*` and redirects to `/login` for `/admin/*`):
- `GET    /api/admin/products`
- `POST   /api/admin/products` — create product with nested variants + images, seeds initial inventory + movement
- `GET    /api/admin/products/:id`
- `PUT    /api/admin/products/:id` — upsert-style update of variants + images
- `DELETE /api/admin/products/:id`
- `POST   /api/admin/variants/:id/adjust-stock` `{ delta, reason, note? }` — atomic update of `InventoryLevel` + `StockMovement`
- `GET    /api/admin/variants/:id/movements`

## Environment

| Var              | Purpose                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`   | Postgres connection string used by Prisma.                       |
| `SESSION_SECRET` | 32+ char random string; signs the admin session JWT.             |
| `ADMIN_EMAIL`    | Email of the admin user created by `npm run seed:admin`.         |
| `ADMIN_PASSWORD` | Password (min 8 chars) for the seeded admin.                     |

## Docker

The Dockerfile builds with `next build` (standalone output), runs `npx prisma migrate deploy` at container start, then boots `node server.js` on port 3000.
