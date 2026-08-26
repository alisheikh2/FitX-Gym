# FITX Personal Training Studio — Website + POS/Admin

**Stack:** React + Vite + Tailwind + Framer Motion + Recharts (frontend) · Node + Express + MongoDB/Mongoose + JWT (backend).
**Theme:** Dark cinematic (near-black + orange accent), mobile-first, Urdu/Pakistan market, floating WhatsApp CTA.

## Deploying to Vercel (one click)

1. Zip this folder (`fitx-deploy.zip`) and extract it locally.
2. `cd fitx-deploy && vercel` — or drag-drop the folder to https://vercel.com/new.
3. In Vercel project settings → Environment Variables, add:
   - `JWT_SECRET` = any long random string (required)
   - `MONGO_URI` = your MongoDB Atlas URI (**optional** — if omitted the app boots in **DEMO MODE** using an in-memory store seeded with sample plans and two accounts; data resets on cold start)
4. Deploy.
5. Log in at `/admin` with:
   - **Owner:** `owner` / `fitx2026`  (change in production — see below)
   - **Staff:** `staff` / `staff2026`

> ⚠️ Demo mode is for previewing only. For production, set `MONGO_URI`. Also seed/change the default passwords via MongoDB once connected.

## Running locally

```bash
npm install
npm start                        # runs api/index.js on port 5000
# open http://localhost:5000
```

To rebuild the client after editing `client/` in the source repo, run `npm run build` there and copy `client/dist/*` into `public/` here.

## Pages

- `/` Home
- `/about`
- `/programs`
- `/membership` Pricing
- `/coaches`
- `/transformations` Before/after gallery
- `/reviews` Real client testimonials (Google-sourced)
- `/blog`
- `/contact` (form posts to `/api/contact` — wire up to email/WhatsApp webhook)
- `/admin` POS + admin dashboard (JWT-gated)

## Admin/POS features

- JWT auth (owner/staff roles)
- Member management (create/edit/delete, auto-expiry from plan duration)
- Membership plans CRUD
- Attendance check-in with same-day duplicate guard
- POS billing (cash/card/easypaisa/jazzcash/bank) with auto receipt numbers
- Revenue dashboard (today/month/last-7-days, by method, by coach)
- CSV export for members & payments
- Walk-in day-pass sales

## Pricing flags

All membership prices shown on the site are **placeholders** (researched for Sahiwal tier) and are flagged as *"Needs client confirmation — contact studio for final rates"* so they are not presented as final pricing.
