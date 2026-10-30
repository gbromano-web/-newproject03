# Deploying the Nasmat Ward Secure Backend

Follow these 4 steps. Total time: ~20 minutes.

---

## Step 1 — Set up Supabase (database)

1. Go to [supabase.com](https://supabase.com) → "Start your project" → sign in with GitHub
2. Click **New Project** → name it `nasmat-ward` → set a strong database password → pick **Middle East (Bahrain)** region → click **Create**
3. Wait ~2 minutes for provisioning, then go to **SQL Editor** → **New Query**
4. Paste the entire content of `backend/db/schema.sql` and click **Run**
5. Go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role` secret key (under "Project API keys") → this is your `SUPABASE_SERVICE_KEY`

⚠️ **Change the admin password** — after the site is live, log in and immediately change `flowers2024` to a strong password. To generate a new bcrypt hash run:
```
node -e "const b=require('bcryptjs');b.hash('YOUR_NEW_PASS',12).then(h=>console.log(h))"
```
Then update it in Supabase: SQL Editor → `UPDATE admin_users SET password_hash='<new hash>' WHERE username='nasmat';`

---

## Step 2 — Deploy the backend to Railway

1. Go to [railway.app](https://railway.app) → "Start a New Project" → sign in with GitHub
2. Click **Deploy from GitHub repo** → select **gbromano-web/-newproject03**
3. In the project settings, set **Root Directory** to `backend`
4. Go to **Variables** and add these:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | (from Step 1) |
| `SUPABASE_SERVICE_KEY` | (from Step 1) |
| `JWT_SECRET` | (run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `JWT_EXPIRES_IN` | `1h` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `https://nasmatwardgift.com,https://gbromano-web.github.io` |
| `PORT` | `3001` |

5. Click **Deploy** → wait for the green checkmark
6. Copy your Railway URL — it looks like: `https://nasmat-ward-api.up.railway.app`

---

## Step 3 — Update the API URL in both HTML files

In `index.html` and `admin.html`, find this line and replace with your Railway URL:

```js
const API_URL = 'https://YOUR-BACKEND-URL.railway.app';
```

Change to:
```js
const API_URL = 'https://nasmat-ward-api.up.railway.app'; // your actual URL
```

---

## Step 4 — Push to GitHub Pages

```bash
cd /home/claude/nasmat-clean
git add -A
git commit -m "Add secure cloud backend with Supabase + JWT auth"
git push origin main
```

Wait ~2 minutes, then visit `https://nasmatwardgift.com` — the products will load from Supabase.

---

## Custom domain for the API (optional but cleaner)

In Railway → Settings → Domains → add `api.nasmatwardgift.com`  
Then in GoDaddy DNS add a CNAME: `api` → `<your-railway-url>.railway.app`  
Update `CORS_ORIGINS` and both `API_URL` lines to `https://api.nasmatwardgift.com`

---

## Daily admin workflow

1. Open `https://nasmatwardgift.com/admin.html`
2. Log in with username `nasmat` and your password
3. Toggle Fresh/Available for today's stock
4. Click "Mark All Fresh" each morning to reset freshness
5. The main site at `nasmatwardgift.com` updates instantly for all visitors

---

## Security summary

| Layer | Protection |
|-------|-----------|
| Password storage | bcrypt (12 rounds) — never plain text |
| Session tokens | JWT in httpOnly cookie — JavaScript cannot read it |
| Login brute-force | 5 attempts per IP per 15 min, then locked |
| Input validation | All fields sanitized + validated server-side |
| Security headers | Helmet.js: CSP, HSTS, X-Frame-Options, etc. |
| Database | Supabase PostgreSQL with parameterized queries |
| Audit trail | Every login, edit, and delete is logged |
| HTTPS | Enforced by Railway and GitHub Pages |
| CORS | Only nasmatwardgift.com is allowed |
