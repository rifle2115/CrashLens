# Deploying CrashLens on Render

Render is a Platform-as-a-Service: it builds straight from this GitHub repo and
redeploys on every push. No SSH, no Docker Compose, no IP juggling. Free tier,
HTTPS included. (Trade-off: free services sleep after 15 min idle.)

The database lives on **Neon** (https://neon.tech) instead of Render — Neon's
free Postgres never expires (it just auto-suspends when idle and wakes on the
next query), so your demo data survives indefinitely.

## Step 0 — Create the Neon database (~3 min)

1. Sign up at https://neon.tech ("Continue with GitHub").
2. **Create project** → name it `crashlens`, region close to Render's (US East/West).
3. On the project dashboard, copy the **Connection string** (psql / URI form).
   It looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/crashlens?sslmode=require`.
4. Keep that string handy — you paste it into Render in step 5.

## First-time setup (~20 min, mostly waiting on builds)

1. **Sign up / log in** at https://render.com (use "Sign in with GitHub").
2. Top-right **New +** → **Blueprint**.
3. Select the **CrashLens** repo. Render finds `render.yaml` automatically.
4. It shows a preview: 2 web services. Click **Apply**.
5. Render prompts for the secrets marked `sync: false`:
   - **DATABASE_URL** → paste your Neon connection string from Step 0.
   - **GROQ_API_KEY** → paste your Groq key.
   (JWT_SECRET is auto-generated.)
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
