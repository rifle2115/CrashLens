# Deploying CrashLens on Render

Render is a Platform-as-a-Service: it builds straight from this GitHub repo and
redeploys on every push. No SSH, no Docker Compose, no IP juggling. Free tier,
HTTPS included. (Trade-off: free services sleep after 15 min idle; free Postgres
is **deleted after 90 days** — fine for a demo.)

## First-time setup (~20 min, mostly waiting on builds)

1. **Sign up / log in** at https://render.com (use "Sign in with GitHub").
2. Top-right **New +** → **Blueprint**.
3. Select the **CrashLens** repo. Render finds `render.yaml` automatically.
4. It shows a preview: 1 database + 2 web services. Click **Apply**.
5. Render prompts for the secrets marked `sync: false`:
   - **GROQ_API_KEY** → paste your Groq key.
   (JWT_SECRET is auto-generated; DATABASE_URL is auto-wired.)
6. Click **Apply / Create Resources**. Builds start.
   - Backend build ~3 min, frontend build ~8 min (Next.js).
7. When both show **Live**, open the frontend URL:
   `https://crashlens-frontend.onrender.com`

## If Render added a suffix to your service names

Render needs globally-unique subdomains. If `crashlens-backend` was taken, your
URL might be `crashlens-backend-x7k2.onrender.com`. If so, fix the two cross-refs:

- **Frontend** service → Environment → `NEXT_PUBLIC_API_URL` → set to the real
  backend URL → **Save** (triggers a rebuild, since it's baked in at build time).
- **Backend** service → Environment → `CORS_ORIGINS` → set to the real frontend
  URL → **Save**.

## Everyday workflow after that

```bash
git push        # that's it — Render rebuilds + redeploys automatically
```

Watch progress in the Render dashboard → your service → **Events / Logs**.

## Waking a sleeping free service

Free web services sleep after 15 min of no traffic. The next visitor triggers a
~30 s cold start, then it's fast again. Upgrade a service to the $7/mo plan to
keep it always-on.
