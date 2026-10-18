# Mayo's Construction CRM

A simple business app for **Mayo's Construction** (Hot Springs, AR · 870-617-3507), built for two partners, Isaiah Mayo and Moss Mayo (50/50).

Works on your phone or a computer. There's nothing extra to install except Node.js.

## What it does

| Page | What it's for |
|---|---|
| **Home** | This month's money in/out, profit, each partner's 50% share, today's to-dos, next 7 days, open estimates |
| **Jobs** | One card per job, laid out like *The Mayo's Workshop* notes: address, customer, start/finish, status (📝 Estimate Pending, 📆 Scheduled, 🔨 In Progress, ✅ Done). Each job tracks price, collected vs. still owed, the labor/sub budget with who's been **paid** and who's still **owed** (Dad, subs), materials budget (Unspent / Paid / Unpaid), and tick-off lists for **materials needed** and **scope of work** |
| **To-Do** | Quick list. Assign to Isaiah, Moss, or both. Set due dates, tick them off |
| **Schedule** | Appointments and job days. List of what's coming up, or a month calendar |
| **Customers** | Name, phone, email, address, and notes. Each customer page shows their estimates, payments, appointments, to-dos, and contracts. Tap to call, text, or open in Maps |
| **Estimates** | Line items with automatic totals and optional tax. Status (Draft / Sent / Accepted / Declined). Printable, or save as PDF |
| **Money** | Money in and money out with categories, by month or year. Shows the partner split, what each partner paid out of their own pocket, and where the money went. **Export CSV** for taxes or your accountant |
| **Contracts** | Contract templates with fill-in blanks. Pick a customer and estimate and the names, address, work, and price fill in for you. Print it, save a copy, and **upload the signed copy** (phone photo or PDF) to the customer's file |
| **Settings** | Change your password, download a backup |

## Run it

You need **Node.js 22.13 or newer** ([nodejs.org](https://nodejs.org)).

```bash
npm start
```

Then open http://localhost:3000.

**Logins:** pick **Isaiah** or **Moss**. The starting password is `mayo2026` for both. **Change it under Settings right away.**
You can also set the starting passwords before the first run:

```bash
ISAIAH_PASSWORD=something MOSS_PASSWORD=somethingelse npm start
```

### Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port to run on |
| `DATA_DIR` | `./data` | Where the database and uploaded files are kept |
| `TZ` | server's | Set to `America/Chicago` so "today" matches Hot Springs |
| `COOKIE_SECURE` | off | Set to `1` when running on HTTPS (any real hosting) |
| `ISAIAH_PASSWORD` / `MOSS_PASSWORD` | `mayo2026` | Starting passwords. Only used the very first time |

## Put it online (one tap)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/MayosConstruction/Isaiah-Mayo)

1. Tap the button above and sign in to Render with GitHub.
2. Type a password for Isaiah and one for Moss when it asks.
3. Tap **Deploy** and wait a few minutes. Render shows your app's address, like `https://mayos-crm.onrender.com`.

The setup lives in `render.yaml`: the Starter plan with a 1 GB disk for your data, Hot Springs time zone, and secure cookies. It costs about $7–8 a month.

## Using it on both your phones

Both of you need to reach the same server so you see the same data. Two easy options:

1. **Cheap cloud host (recommended).** Any host that runs Node.js and gives you a **persistent disk** will work, such as Render, Railway, or Fly.io. Set the start command to `npm start`, mount the disk, and point `DATA_DIR` at it. Also set `TZ=America/Chicago` and `COOKIE_SECURE=1`. Without a persistent disk, your data gets wiped on every restart.
2. **A computer at home or the office** that stays on. Run `npm start`, then use a tool like Tailscale to reach it from your phones.

Tip: on your phone, open the site and choose **Add to Home Screen** so it works like an app.

## Loading your existing jobs

Go to **Settings → Import** and pick a `.json` file: either a backup made by this app, or a starter file. Importing only adds records. It never deletes anything.

Customer and job details are kept out of this repository on purpose, because the repository is public. Keep your starter or backup files somewhere private.

## How the money works

- **Moss and Isaiah are 50/50 partners.** Money you pay yourselves from a job is **Partner pay**. It isn't a cost, it's your split.
- **Subcontractors** (Tommy and Chris, electricians; Julio, drywaller; David, laborer) and **materials** are business **costs**.
- **Profit** = money in − costs.
- On each job, labor is broken down by sub, Moss, and Isaiah. Whatever labor isn't assigned to a sub or Moss shows as **Isaiah, rest of labor**.
- A payment marked **Due when job is finished** shows on the job and under **Money → Due when jobs finish**. It doesn't count until you tap **Mark paid**.
- **Materials status:** *Not bought yet*, *Purchased*, or *Bought, not paid yet*. Setting it to *Purchased* offers to log the purchase in Money.

## Backups

- **Settings → Download backup** saves all records as one `.json` file.
- For a full backup, copy the whole `data/` folder: `crm.db` plus `uploads/`, which holds the signed contracts.

## About the contract template

The starter **Construction Agreement** is a general starting point, **not legal advice**. Arkansas has specific rules for residential contractors, including the residential lien notice (Ark. Code Ann. § 18-44-115) and contractor licensing thresholds. The template has a marked spot for that notice. **Have an Arkansas attorney review your template** before you use it. You can edit templates anytime under Contracts → Edit.

Fill-in blanks you can use in any template:
`{{customer_name}}` `{{customer_address}}` `{{customer_phone}}` `{{customer_email}}` `{{date}}` `{{job_title}}` `{{job_address}}` `{{job_scope}}` `{{job_price}}` `{{start_date}}` `{{finish_date}}` `{{estimate_number}}` `{{estimate_items}}` `{{estimate_total}}`

## For developers

- `server.js` is a single-file Node server using the built-in `node:sqlite`. It has no npm dependencies.
- `public/` holds the front end: plain HTML, CSS, and JS with no build step.
- `templates/` holds the starter contract text that gets added on first run.
- `npm test` runs an API smoke test against a temporary database.
