# User Journey Mapping Tool

Structure workshop or Figma output via **Cursor chat** (agent imports into the app), review the journey on **Map**, capture requirements in **Discovery**, and export delivery packs.

**Default (recommended):** local workbench in Cursor — `LOCAL_MODE=true`, no login. Collaborate in **Figma**, export **PDF**, turn it into JSON in chat ([docs/CURSOR_IMPORT.md](docs/CURSOR_IMPORT.md)), then import in the app. Hosted auth/sharing (Entra, guests, Liveblocks) is optional when you set `LOCAL_MODE=false`.

**Clone + run:** [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) (public GitHub; journey data stays local).

**Full guide:** [docs/SHARE_AND_SETUP.md](docs/SHARE_AND_SETUP.md) (local data, import, pack.zip sharing).

## Quick start (local)

```bash
cd journey-app
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With `LOCAL_MODE=true` you skip the login screen.

If SQLite fails on OneDrive:

```bash
npm run db:prep-local
# copy printed DATABASE_URL into .env
```

## Production identity & sharing

| Variable | Purpose |
|----------|---------|
| `LOCAL_MODE` | Set to `false` to require sign-in and enforce `JourneyMember` roles |
| `AUTH_SECRET` | NextAuth session encryption |
| `AUTH_URL` | Public URL of the app (Azure hostname) |
| `AUTH_MICROSOFT_ENTRA_ID_*` | Entra app registration (company email) |
| `DATABASE_URL` | PostgreSQL connection string (never SQLite in Azure) |
| `LIVEBLOCKS_SECRET_KEY` | Optional — colored cursors + names on Map (legacy `/workspace` redirects) |
| `GUEST_AUTH_ENABLED` | `true` to show **Continue as guest** on `/login` and allow guest link redemption |

Flows:

- Home lists only journeys you are a member of.
- **Share** (`/journeys/[id]/share`) — invite by email, copy link, manage roles.
- **Accept** — `/invite/[token]` after Entra sign-in (email must match invite).
- **Guest link** — facilitators create a link on **Share**; guests open `/join/[token]`, sign in with a **display name** (`GUEST_AUTH_ENABLED=true`).

### Guest vs email invite

| Mechanism | Who | Sign-in |
|-----------|-----|---------|
| Email invite | Named colleagues | Microsoft Entra; email must match invite |
| Guest link | Workshop attendees without company email | Display name only; **viewer** access via shared URL |

Guests cannot create journeys or use Import; they only see journeys they joined via a guest link.

**New to deployment?** Follow [docs/GO_LIVE.md](docs/GO_LIVE.md) (plain steps + IT ticket text).

## Azure deployment

1. **Azure Database for PostgreSQL** — create DB, set `DATABASE_URL` on App Service.
2. **App Service** (Linux, Node 20) — set configuration from `.env.example` (production section).
3. **Entra** — redirect URI `https://<host>/api/auth/callback/microsoft-entra-id`.
4. **CI** — GitHub Actions workflow [`.github/workflows/azure-deploy.yml`](../.github/workflows/azure-deploy.yml):
   - Swaps Prisma provider to `postgresql` during migrate
   - Runs `prisma migrate deploy` then `npm run build`
   - Deploys to App Service (configure `AZURE_WEBAPP_NAME`, `AZURE_WEBAPP_PUBLISH_PROFILE`, and secrets)

Health probe: `GET /api/health` → `{ "ok": true }`.

**Staging:** use a deployment slot + separate Postgres database; set `AUTH_URL` to the staging hostname in that slot.

## Smoke tests (auth)

- Unauthenticated `/` → `/login` when `LOCAL_MODE=false`
- Guest: `/join/<token>` → login → display name → Map (viewer)
- Guest cannot create a journey or open Import
- Entra user: email invite and guest link both grant access
- Revoked/expired guest link shows an error

## Live presence (phase 1)

With `LIVEBLOCKS_SECRET_KEY`, collaborators on the same journey map see each other's pointers. Edits are still saved via server actions (refresh to see others' saves). Phase 2 simultaneous editing is documented in [docs/COLLAB_PHASE2.md](docs/COLLAB_PHASE2.md).

## Workflow

1. **Import** (`/import`) — instructions; attach files in Cursor chat ([docs/CURSOR_IMPORT.md](docs/CURSOR_IMPORT.md))
2. **Map** (`/journeys/[id]/map`) — read-only journey canvas from import; personas and insights in the left rail
3. **Discovery** (`/journeys/[id]/synthesis`) — edit requirements and user stories
4. **Share / export** — invites and print/PDF from Map when needed

## Scripts

- `npm run dev` — Development server
- `npm run build` — Production build
- `npm run db:seed` — Demo user journey
- `npm run db:prep-local` — Writable SQLite path on Windows