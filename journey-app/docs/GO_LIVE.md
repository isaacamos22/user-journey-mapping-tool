# Go live — plain checklist

You (or IT) wire Azure once; after that, each deploy is automatic from GitHub.

## What I cannot do without you

- Create your **Azure** website or database (needs your company Azure login or an IT ticket).
- Create **Microsoft Entra** app registration (usually IT).
- Paste **secrets** into GitHub (only someone with access to the repo settings).

Everything below is what **you or IT** does, in order.

---

## Step 1 — Ask IT (copy into a ticket)

Subject: **Azure App Service + Postgres + Entra for internal User Journey Mapping Tool**

Body:

```
We need to host a Node 20 (Next.js) internal web app.

Please provide:
1. Azure App Service (Linux), Node 20, HTTPS hostname, e.g. https://<name>.azurewebsites.net or custom domain.
2. Azure Database for PostgreSQL — connection string for DATABASE_URL.
3. Microsoft Entra app registration:
   - Redirect URI: https://<HOSTNAME>/api/auth/callback/microsoft-entra-id
   - Client ID, client secret, tenant ID (for AUTH_MICROSOFT_ENTRA_ID_*).
4. GitHub Actions secrets access OR publish profile for the App Service.

Health check path: /api/health
```

Save the **hostname** — you will use it as `AUTH_URL`.

---

## Step 2 — Put code in GitHub

1. Create a **private** GitHub repository (or use company GitHub).
2. Push this project; branch **`main`** triggers deploy (see `.github/workflows/azure-deploy.yml`).
3. Do **not** commit `.env` (secrets stay in Azure + GitHub Secrets only).

---

## Step 3 — GitHub repository secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Value |
|--------|--------|
| `DATABASE_URL` | Postgres URL from IT |
| `AUTH_SECRET` | Long random string (`openssl rand -base64 32`) |
| `AUTH_URL` | `https://<your-hostname>` (no trailing slash) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Entra app client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Entra client secret |
| `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | Entra tenant ID |
| `AZURE_WEBAPP_NAME` | App Service resource name |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Full XML from Azure Portal → App Service → **Download publish profile** |
| `LIVEBLOCKS_SECRET_KEY` | Optional |

---

## Step 4 — Azure App Service settings

Portal → App Service → **Configuration** → **Application settings** (same as secrets above, plus):

| Name | Value |
|------|--------|
| `LOCAL_MODE` | `false` |
| `GUEST_AUTH_ENABLED` | `true` |
| `NODE_ENV` | `production` |

**Startup command:** `npm start`  
**Working directory:** site root should be the deployed `journey-app` folder (workflow deploys that folder).

---

## Step 5 — Run deploy

1. In GitHub: **Actions** → **Deploy to Azure App Service** → **Run workflow** (or push to `main`).
2. Open `https://<hostname>/api/health` → should show `{"ok":true}`.
3. Open `https://<hostname>/` → should redirect to **login**.

---

## Step 6 — Smoke test

1. **Sign in with Microsoft** (company account).
2. Create a user journey.
3. **Share** → create **guest link** → open in private browser → **Continue as guest**.

---

## Quick local test (not “live”, same login UX)

In `.env`:

```
LOCAL_MODE=false
AUTH_SECRET=dev-secret-change-me
GUEST_AUTH_ENABLED=true
```

Restart `npm run dev` → use **Development sign-in** on `/login` with any email.

---

## Help

- Full env list: [`.env.example`](../.env.example)
- Guest vs email: [README](../README.md)