# Dealer Intelligence Dashboard

A full-stack reporting tool that:
1. **Uploads a dealer CSV** (with Group + Branch columns)
2. **Fetches Mixpanel event counts** per dealer domain
3. **Generates PDF reports** per group and branch
4. **Sends reports via Gmail** using a Cloudflare Worker

---

## Project Structure

```
dealer-dashboard/
├── app/                        # React frontend (Cloudflare Pages)
│   └── src/
│       ├── components/
│       │   ├── UploadStep.jsx       # Step 1: CSV upload
│       │   ├── MixpanelStep.jsx     # Step 2: Mixpanel API fetch
│       │   └── ReportsStep.jsx      # Step 3: Generate + send PDFs
│       └── lib/
│           ├── csvParser.js         # Papa Parse + hierarchy builder
│           ├── mixpanel.js          # Mixpanel /segmentation API
│           ├── pdfGenerator.js      # jsPDF report builder
│           └── emailSender.js       # Worker API caller
├── worker/                     # Cloudflare Worker (Gmail sender)
│   ├── src/index.js
│   └── wrangler.toml
└── .github/workflows/
    ├── deploy-app.yml           # CI: React → Cloudflare Pages
    └── deploy-worker.yml        # CI: Worker → Cloudflare
```

---

## CSV Format

Your CSV must have at minimum a **Group** and **Branch** column.
Optional but recommended: `domain`, `email`.

```csv
group,branch,domain,email
AutoGroup North,Belfast Branch,belfast.autogroupnorth.com,belfast@autogroupnorth.com
AutoGroup North,Derry Branch,derry.autogroupnorth.com,derry@autogroupnorth.com
Premier Cars,Dublin HQ,premiercars.ie,info@premiercars.ie
```

Accepted column name variations:
- **Group**: `group`, `group_name`, `dealer_group`, `dealergroup`
- **Branch**: `branch`, `branch_name`, `dealer`, `dealer_name`, `dealer_branch`
- **Domain**: `domain`, `referring_domain`, `website`, `url`, `dealer_domain`
- **Email**: `email`, `contact_email`, `dealer_email`, `branch_email`

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_ORG/dealer-dashboard.git
cd dealer-dashboard
cd app && npm install
cd ../worker && npm install
```

### 2. Gmail OAuth2 credentials

You need a Google Cloud project with the Gmail API enabled:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Gmail API**
3. Create **OAuth 2.0 credentials** (Desktop app type)
4. Go to [OAuth2 Playground](https://developers.google.com/oauthplayground)
   - Settings → Use your own credentials → enter Client ID & Secret
   - Authorise scope: `https://www.googleapis.com/auth/gmail.send`
   - Exchange for tokens → copy the **Refresh Token**

### 3. Deploy the Worker

```bash
cd worker

# Set secrets (run each separately, paste value when prompted)
npx wrangler secret put GMAIL_CLIENT_ID
npx wrangler secret put GMAIL_CLIENT_SECRET
npx wrangler secret put GMAIL_REFRESH_TOKEN
npx wrangler secret put GMAIL_SENDER_EMAIL       # e.g. reports@yourcompany.com
npx wrangler secret put ALLOWED_ORIGIN           # e.g. https://dealer-dashboard.pages.dev

# Deploy
npx wrangler deploy
```

Note the Worker URL (e.g. `https://dealer-mailer.YOUR_SUBDOMAIN.workers.dev`)

### 4. Configure the React app

Create `app/.env.local`:

```
VITE_WORKER_URL=https://dealer-mailer.YOUR_SUBDOMAIN.workers.dev
```

### 5. Set GitHub Secrets

In your GitHub repo → Settings → Secrets → Actions, add:

| Secret | Value |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages + Workers edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_WORKER_URL` | Your Worker URL |

### 6. Deploy

Push to `main` — GitHub Actions will:
- Build the React app and deploy to Cloudflare Pages
- Deploy the Worker to Cloudflare

Or deploy manually:

```bash
# App
cd app && npm run build
npx wrangler pages deploy dist --project-name=dealer-dashboard

# Worker
cd worker && npx wrangler deploy
```

---

## Running Locally

```bash
# Terminal 1 — React app
cd app && npm run dev

# Terminal 2 — Worker (optional, for email testing)
cd worker && npx wrangler dev
```

Set `VITE_WORKER_URL=http://localhost:8787` in `app/.env.local` for local Worker testing.

---

## Mixpanel API Notes

- Uses the `/api/2.0/segmentation` endpoint with `$referring_domain` property filter
- Requires **Project ID** and **API Secret** (Project Settings → Service Accounts)
- The `domain` column in your CSV is matched to Mixpanel's `$referring_domain` property
- Fetches all events for the date range; top events shown per dealer in the PDF

---

## PDF Report Structure

Each report contains:
- Branded header with period dates
- Group / Branch identity block
- KPI summary boxes (CSV records, total events, event types)
- Event activity table (sorted by volume)
- CSV numeric column summary

---

## Architecture

```
Browser (React)
  │
  ├─── CSV File ──► Papa Parse ──► Dealer hierarchy
  │
  ├─── Mixpanel API ──► Event counts per domain
  │
  ├─── jsPDF ──► PDF generation (client-side)
  │
  └─── POST /send ──► Cloudflare Worker
                           │
                           └─── Gmail API (OAuth2) ──► Email delivered
```
