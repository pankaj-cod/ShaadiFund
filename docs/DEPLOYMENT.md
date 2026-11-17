# Deploying ShaadiFund

This puts the site online on Vercel, in **demo payment mode** (Razorpay test keys; no real money). Everything except email is added from inside Vercel.

| Piece       | Service       | Added from                     |
| ----------- | ------------- | ------------------------------ |
| Hosting     | Vercel        | vercel.com                     |
| Database    | Neon Postgres | Vercel → Storage               |
| Photos      | Vercel Blob   | Vercel → Storage               |
| Rate limits | Upstash Redis | Vercel → Storage (Marketplace) |
| Email       | Resend        | resend.com                     |

Vercel's free Hobby plan is for personal, non-commercial projects. Once ShaadiFund charges fees, it needs the Pro plan.

## 1. Email (Resend)

1. Sign up at [resend.com](https://resend.com) and create an API key with "Sending access".
2. **Domain.** Resend only delivers to your own sign-up address until you verify a domain you own (**Domains → Add domain**, then add the DNS records it shows). Without a domain, only you can receive sign-in links; other people can still sign in with Google.
3. Keep the API key for step 4.

## 2. Create the Vercel project

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, choose `pankaj-cod/ShaadiFund`, **Import**.
3. Leave the build settings as detected (Next.js). Press **Deploy**. This first deployment is expected to fail because there is no database yet. That is fine.

## 3. Add storage

In the project, open the **Storage** tab:

1. **Create Database → Neon (Postgres)**. Pick the region **AWS Mumbai (ap-south-1)** or, if not offered, Singapore. Connect it to **all environments**. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (or the same names starting `STORAGE_`, if Vercel adds that prefix; both work).
   - In the Neon integration's settings, turn on **a database branch for each preview deployment** if offered. Otherwise preview deployments run migrations against the production database.
2. **Create → Blob**. Connect it to all environments. This sets `BLOB_READ_WRITE_TOKEN`.
3. **Redis for rate limits (Upstash).** Vercel's labels change often; any one of these works:
   - In **Storage**, click **Create Database** (or **Connect Store**) and choose **Upstash** / **Redis** from the providers listed in that dialog.
   - Or open [vercel.com/marketplace/upstash](https://vercel.com/marketplace/upstash), press **Install**, and pick this project.
   - Or skip Vercel: create a free database at [console.upstash.com](https://console.upstash.com) (region Mumbai, `ap-south-1`), and copy its **REST URL** and **REST token** into the environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

   Pick region Mumbai or Singapore. Whichever names the integration uses (`UPSTASH_REDIS_REST_*` or `KV_REST_API_*`), ShaadiFund reads both.

## 4. Environment variables

**Settings → Environment Variables**, for the Production environment (and Preview if you use previews). Generate each secret fresh on your own machine; never reuse the ones in `.env.local`:

```bash
openssl rand -base64 36
```

| Name                       | Value                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`       | a fresh value from the command above                                                                        |
| `CRON_SECRET`              | another fresh value                                                                                         |
| `MEDIA_STORAGE`            | `blob`                                                                                                      |
| `EMAIL_TRANSPORT`          | `resend`                                                                                                    |
| `RESEND_API_KEY`           | from step 1                                                                                                 |
| `EMAIL_FROM`               | `ShaadiFund <hello@your-verified-domain>`, or `ShaadiFund <onboarding@resend.dev>` before you have a domain |
| `PAYMENTS_MODE`            | `test`                                                                                                      |
| `RAZORPAY_KEY_ID`          | your `rzp_test_…` key                                                                                       |
| `RAZORPAY_KEY_SECRET`      | its secret                                                                                                  |
| `RAZORPAY_WEBHOOK_SECRET`  | a value you choose; you will paste the same one into Razorpay in step 6                                     |
| `LIVE_SETTLEMENT_APPROVED` | `false`                                                                                                     |
| `GOOGLE_CLIENT_ID`         | same as local                                                                                               |
| `GOOGLE_CLIENT_SECRET`     | same as local                                                                                               |

`APP_URL` is optional: it defaults to the project's production domain. Set it once you add your own domain (for example `https://shaadifund.in`).

Database, Blob and Upstash variables are found even if Vercel gave them a prefix such as `STORAGE_`. The app refuses to start on Vercel if photo storage, email, rate limits or the cron secret are missing, and the error names the missing setting.

## 5. Deploy

**Deployments → the failed deployment → ⋯ → Redeploy.** The build applies database migrations (`prisma migrate deploy`) before building.

Then check:

- `https://<your-project>.vercel.app/api/health` shows `"status":"ok"` and `"paymentsMode":"test"`.
- The home page and `/demo` load.

## 6. Connect the outside services to the new address

**Google sign-in.** In Google Cloud Console, open your OAuth client and add:

- Authorised JavaScript origin: `https://<your-project>.vercel.app`
- Authorised redirect URI: `https://<your-project>.vercel.app/api/auth/callback/google`

While the consent screen is in Testing, only listed test users can sign in. Publish it when you want anyone to sign in with Google.

**Razorpay webhook.** In the Razorpay dashboard (Test Mode): **Account & Settings → Webhooks → Add New Webhook**:

- URL: `https://<your-project>.vercel.app/api/webhooks/razorpay`
- Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `payment.failed`

## 7. Make yourself an admin on the live site

Sign in on the live site once, then from your project folder (replace both values):

```bash
DIRECT_URL='<DATABASE_URL_UNPOOLED from Vercel → Settings → Environment Variables>' npm run admin:promote -- you@example.com
```

## Scheduled job

`vercel.json` runs the housekeeping job once a day at 03:00 IST (the most the Hobby plan allows). Vercel sends `CRON_SECRET` with the request automatically. Emails are still sent immediately after each payment; the job is the safety net for retries and for payments that were never reported back.

## Custom domain

**Settings → Domains → Add**, then follow Vercel's DNS instructions. Afterwards set `APP_URL`, add the domain to Google's origins and redirect URIs, update the Razorpay webhook URL, and redeploy.

## Rolling back

**Deployments → a previous deployment → ⋯ → Promote to Production.** Migrations are written to be backward compatible, so the previous version keeps working with the newer database.
