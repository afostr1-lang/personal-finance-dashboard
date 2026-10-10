# FinanceFlow production checklist

## Required before the new release works

Set these **Production** environment variables in Vercel (Project → Settings → Environment Variables):

- `DATABASE_URL` — existing Neon PostgreSQL connection string
- `FINANCEFLOW_PASSWORD` — a strong, unique login password (do not put it in GitHub)
- `FINANCEFLOW_SESSION_SECRET` — a random secret of **at least 32 characters**, different from the password

Redeploy the latest commit after adding them. FinanceFlow intentionally refuses access until the two new security variables are configured. Existing records remain in Neon.

The API uses an HttpOnly, Secure, SameSite=Strict signed cookie, seven-day expiry, and origin checking for write requests. This is **single-owner password access**, not a multi-user authentication system. For shared access, add managed authentication and per-user database ownership before use.

## Receipt behavior

OCR runs in the browser. The original receipt **is not saved**, and the recognized fields must be reviewed before confirming. Matching merchant/date/amount transactions are blocked as likely duplicates. Budget totals are calculated from confirmed expenses.

Permanent private receipt storage is **not yet implemented**: configure a private object store with authenticated upload/download and deletion before promising a receipt archive. Never store public receipt URLs.

## Remaining acceptance checks

- Deploy succeeds; sign-in, sign-out, invalid password, unauthorized API requests and Excel export are tested.
- Scan a PNG/JPG and a text/scanned PDF; verify extracted merchant, date, and amount.
- Confirm a receipt expense, edit it, delete it, and verify monthly budget changes.
- Check duplicate warnings and 80%/100% budget status.
- Verify the mobile UI at 320px, 375px, 768px, and desktop widths.
- Export and restore a test dataset; document Neon backup/restore procedure.
- Set up rate limiting and monitoring before exposing the login endpoint publicly.

Do not enter sensitive personal financial data until these checks are complete.
