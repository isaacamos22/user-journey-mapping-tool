# User Journey Mapping Tool — share, install, and workflow

One guide for **you**, **teammates installing in Cursor**, and **a future hosted rollout** (when IT is ready).

**Short version for colleagues:** [GETTING_STARTED.md](./GETTING_STARTED.md) (install + daily use in ~5 minutes).

---

## What stays local (not in GitHub)

The public repo ships **code and docs only**. Each machine keeps its own:

| Path | Contents |
|------|----------|
| `journey-app/dev.db` | Journeys, phases, pains, synthesis |
| `journey-app/.env` | Local mode, database path |
| `journey-app/.cursor-import/` | Import JSON drafts |
| `journey-app/.cursor-discovery/` | Discovery JSON drafts |
| `journey-app/public/home/covers/*.png` | Home poster art per journey |

To back up or share: **Export → pack.zip** in the app, or copy `dev.db` (same machine restore).

---

## What this tool is

A **local workbench** (default) for UX and product owners after a Figma workshop:

1. **Collaborate in FigJam / Figma** (workshop, sticky notes, comments).
2. **Export** from Figma (usually **PDF**, or other workshop files).
3. **Import** via Cursor chat (attach workshop files; agent runs `npm run import:apply`) → open journey on **Home**.
4. **Map** on the canvas with your product owner.
5. **Discovery** (requirements, user stories) → **Export** packs.

Collaboration during the workshop stays in **Figma**. This app is for **structuring, alignment, and delivery** afterward.

---

## Is “install in Cursor” a good way to share?

| Share with | Good approach |
|------------|----------------|
| UX/PO colleagues comfortable with Node + terminal | **Yes** — give them this repo + this doc |
| Many non-technical stakeholders | **No** — use a **hosted URL** later (Azure + IT) |
| One shared journey everyone edits live | **Needs hosting** — local install = **separate DB per machine** |

**Cursor** is the editor. The app runs at **`http://localhost:3000`** on each person’s PC. There is no separate “Cursor app store” install.

---

## Prerequisites

- **Node.js 20** ([https://nodejs.org](https://nodejs.org))
- **Cursor** or VS Code (optional but typical)
- **Git** (if cloning a repo)

---

## First-time setup (local workbench)

```bash
cd journey-app
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open **http://localhost:3000**.

### Recommended `.env` (no login, no sharing UI)

```env
LOCAL_MODE=true
LOCAL_DEFAULT_USER_EMAIL="your.name@company.com"
DATABASE_URL="file:./dev.db"
```

Do **not** set `AUTH_*`, `GUEST_*`, or `LIVEBLOCKS_*` for local-only use.

### Windows + OneDrive (SQLite “readonly database”)

If the project lives on OneDrive, SQLite may fail to write:

```bash
npm run db:prep-local
```

Copy the printed `DATABASE_URL` into `.env`, then run migrate/seed again.

---

## Daily use

```bash
cd journey-app
npm run dev
```

Stop with **Ctrl+C** in the terminal. Restart after changing `.env`.

---

## Import workflow (Figma → Cursor → app)

1. Run your workshop in **Figma / FigJam**.
2. In **Cursor chat**, import **either** way — see **`journey-app/docs/CURSOR_IMPORT.md`**:
   - **Upload** a file (PDF export, image, or zip / pack.zip), **or**
   - **Paste** the board link (`figma.com/board/...` or `figma.com/design/...`).
3. Ask the agent to import.
4. Open the new journey from **Home** → **Map**, refine with your product owner.
5. Use **Discovery** and **Export** when ready.

Optional:

- **pack.zip** from Export: attach in Cursor chat and ask the agent to import (same chat workflow).

---

## What’s hidden in local mode (`LOCAL_MODE=true`)

- No **login / logout**
- No **Share** tab, email invites, or guest links
- `/login`, `/invite`, `/join` redirect away

Auth and sharing code remains in the project for a future hosted deployment.

---

## Sharing the project with others

### App code (public GitHub)

1. `git clone https://github.com/isaacamos22/user-journey-mapping-tool.git`
2. [GETTING_STARTED.md](./GETTING_STARTED.md) — install + run.
3. Repo has **no** workshop journeys; each person starts with empty local `dev.db` (seed is a tiny demo only).

### Journey data (not git)

- **Export → pack.zip** in the app, or send the zip to a colleague.
- They import via **Cursor chat** on their machine.
- Do not commit `.cursor-import/`, `.cursor-discovery/`, `dev.db`, covers, or `.env`.

---

## Import structuring (Cursor vs in-app)

Primary path: **Cursor chat** reads workshop files and runs `npm run import:apply` to create the journey locally.

Optional hosted-only: **Azure OpenAI** in `.env` can assist legacy file-parse paths if you enable them in code; not required for local Cursor workflow.

---

## Going live on the web (later, with IT)

Use when many people need **one URL** and **company sign-in**.

| Piece | Purpose |
|-------|---------|
| Azure App Service (Node 20) | Hosts the website |
| Azure PostgreSQL | Shared database |
| Microsoft Entra | Sign in with company email |
| `LOCAL_MODE=false` | Enables login and sharing |

Step-by-step for IT and GitHub Actions: **[GO_LIVE.md](./GO_LIVE.md)**.

You can stay on **local mode** for pilots and turn on hosting when ready — same codebase.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `readonly database` | `npm run db:prep-local`, update `DATABASE_URL` |
| Import empty / weak from PDF | Try export with more text; optional `AZURE_OPENAI_*` |
| `prisma generate` EPERM | Stop `npm run dev`, close DB locks, run `npm run predev:prisma` again |
| Endless `Compiling…` on OneDrive | Use `npm run dev` (webpack + ignored watches); pause OneDrive sync on `journey-app/.next` and `node_modules`; or move repo off OneDrive |
| Still see Share / login | Ensure `LOCAL_MODE=true`, restart `npm run dev` (restarts pick up `next.config`) |

---

## Quick reference

| Task | Command / URL |
|------|----------------|
| Dev server | `npm run dev` → http://localhost:3000 |
| Reset demo data | `npm run db:seed` |
| Production build (advanced) | `npm run build` && `npm run start` |
| Health check (when hosted) | `/api/health` |

---

## Support checklist for someone helping a colleague

- [ ] Node 20 installed (`node -v`)
- [ ] `journey-app/.env` with `LOCAL_MODE=true`
- [ ] `npm install` && `npx prisma migrate deploy` succeeded
- [ ] `npm run dev` and browser opens home page
- [ ] Test: Import a small PDF → review → apply → open Map