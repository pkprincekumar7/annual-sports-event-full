# Environment Setup (.env)

After copying `.env.example` to `.env`, update the following values with correct credentials:

## Required values
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `VITE_API_URL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`

## Steps

```bash
cp .env.example .env
```

Open `.env` and replace the values above with real ones for your environment.

## Email setup details

For Gmail App Password setup and other providers, see `docs/guides/EMAIL_SETUP.md`.
