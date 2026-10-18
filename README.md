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

**Easiest way:** on the Home screen (or in Settings), type the code from your Claude chat into **Load your jobs**. Your Workshop notes ship inside the app *encrypted*, so nobody can read them from the public repository without that code.

**Or:** 
Go to **Settings → Import** and pick a `.json` file: either a backup made by this app, or a starter file. Importing only adds records. It never deletes anything. Importing the same file again won't double anything, and it fills in any missing phone numbers.

Customer and job details are kept out of this repository on purpose, because the repository is public. Keep your starter or backup files somewhere private.

## Sending estimates to sign

1. Build the estimate (from a job, use **Make estimate**, and the scope fills in).
2. Tap **✍️ Send to sign** and pick the agreement to include.
3. Tap **Send by text** or **Send by email**. Your phone's Messages or Mail app opens with the link ready to go.
4. The customer opens the link, reviews everything, types their name, and signs with their finger.
5. The signed copy (with signature, date, and time) saves to the customer's file, the estimate turns **Accepted**, and a "✍️ signed, schedule it" to-do appears for both of you.

The link works only for that one estimate and can be signed once.

## Texting customers

On a job tap **💬 Text customer** (also on customer pages and appointments). Pick a message, such as *schedule reminder*, *on our way*, *running late*, *who's coming*, *job update*, or *job finished*. Then pick **who's coming** (Moss, Isaiah, both, or a sub) and the arrival time. The text is written for you, and you can edit it before sending. It sends from **your own phone number** through Messages, so replies come straight to you. Every text is logged on the job under *Texts & updates sent*.

## Business texting (from a Mayo's Construction number)

With these set on Render (**Environment** tab), texts send straight from the app using your business number, and your phone's Messages app never opens:

| Variable | What it is |
|---|---|
| `TWILIO_ACCOUNT_SID` | From your Twilio console (starts with `AC`) |
| `TWILIO_AUTH_TOKEN` | From your Twilio console |
| `TWILIO_FROM_NUMBER` | The number you bought in Twilio |
| `TEXT_FORWARD_TO` | Optional: your cell, to get customer replies forwarded |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional: a Messaging Service with an approved **RCS sender**, so iPhones (iOS 18+) show **Mayo's Construction with your logo** and a verified check. Phones without RCS get a normal text from your number. |

In Twilio, set the number's **"A message comes in"** webhook to `https://<your-app>.onrender.com/twilio/incoming` (HTTP POST). Then replies are saved on the job and forwarded to `TEXT_FORWARD_TO`. The first text to each customer automatically adds "Reply STOP to opt out." The app never opens your phone's Messages app. Until texting is connected, you can copy a text or email it.

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

## Contracts and change orders

The app comes with two templates:

- **Residential Construction Agreement:** scope and exclusions, price with deposit and balance, late fees and the right to stop work, change orders, schedule and delays, hidden conditions (rot, termites, mold), permits, owner responsibilities, materials and allowances, cleanup, subcontractors, warranty limits, termination, disputes (Garland County), and the **3-day right to cancel** for jobs sold at the customer's home.
- **Change Order:** what's changing, **your price for it** (or a credit), days added, and the price before and after. When the customer signs, the amount is added to the job total and the days are added to the finish date.

**Before using them:** fill in **Settings → Business info** (license #, insurance, email, deposit %, warranty). Then have an Arkansas attorney look the agreement over once. This is a strong starting point, **not legal advice**.

Fill-in blanks you can use in any template:
`{{customer_name}}` `{{customer_phone}}` `{{customer_email}}` `{{job_address}}` `{{date}}` `{{start_date}}` `{{finish_date}}` `{{estimate_number}}` `{{estimate_items}}` `{{estimate_notes}}` `{{estimate_total}}` `{{deposit_percent}}` `{{deposit_amount}}` `{{balance_amount}}` `{{business_name}}` `{{business_phone}}` `{{business_email}}` `{{license_number}}` `{{insurance}}` `{{warranty_years}}` `{{late_fee}}` `{{exclusions}}` `{{cancel_by_date}}` `{{contractor_signer}}` `{{original_price}}` `{{change_amount}}` `{{new_total}}` `{{days_added}}`

## Fill-in-the-blank contracts

When you create or send a contract, anything the app can't fill in from the customer, job, estimate, or Settings (like a missing email) shows as a **Fill in the blanks** box. Type the answer and it drops into the agreement. Anything left empty prints as N/A, after asking you first. A customer email or phone typed in is saved to their record. Printed contracts get signature boxes instead of underlines, and online signing adds the real signatures.

## Checking which version is running

The version number shows at the bottom of the login screen and at the top of **Settings**, for example `Version 1.5.1 · abc1234`. If it doesn't match the latest, go to Render → your service → **Manual Deploy → Deploy latest commit**.

## For developers

- `server.js` is a single-file Node server using the built-in `node:sqlite`. It has no npm dependencies.
- `public/` holds the front end: plain HTML, CSS, and JS with no build step.
- `templates/` holds the starter contract text that gets added on first run.
- `npm test` runs an API smoke test against a temporary database.
