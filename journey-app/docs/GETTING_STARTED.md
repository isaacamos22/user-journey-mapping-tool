# Getting started

**GitHub (public):** https://github.com/isaacamos22/user-journey-mapping-tool

**Your journeys stay on your machine** — not in git. Local: `dev.db`, `.env`, `.cursor-import/`, `.cursor-discovery/`, `public/home/covers/`. Share maps with **Export → pack.zip**, not by pushing to GitHub.

**Needs once:** Node.js 20 — https://nodejs.org · Cursor — https://cursor.com

---

## Install + run (paste into Cursor Agent)

```
Clone and run the User Journey Mapping Tool locally.

git clone https://github.com/isaacamos22/user-journey-mapping-tool.git
cd user-journey-mapping-tool/journey-app

Windows: Copy-Item .env.example .env
Mac/Linux: cp .env.example .env

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev

Open http://localhost:3000 (LOCAL_MODE=true in .env — no login).

If npm run dev crashes on Windows (Watchpack regex): npm run dev:turbo
If SQLite readonly on OneDrive: npm run db:prep-local, set DATABASE_URL in .env, then migrate + seed again.
```

---

## Every session

```
cd journey-app
npm run dev
```

Stop: **Ctrl+C**

---

## After setup

| Step | What |
|------|------|
| Import | Cursor chat + FigJam/PDF — `docs/CURSOR_IMPORT.md` |
| Map | Home → journey → Map |
| Discovery | Scope on map → Cursor — `docs/CURSOR_DISCOVERY.md` |
| Move data | App **Export** pack.zip (not git push) |

More: `docs/SHARE_AND_SETUP.md` · Map views: `docs/MAP_ZOOM_LOD.md`