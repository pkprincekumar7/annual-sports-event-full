# Email Setup Guide

This application uses **Nodemailer** for sending emails. Multiple email providers are supported, including free options.

## Free Email Options

### 1. Gmail SMTP (Recommended for Free Tier)
- **Free**: Yes (up to 500 emails/day)
- **Setup**: Requires Gmail account and App Password
- **Best for**: Development and small-scale production

### 2. SendGrid
- **Free Tier**: 100 emails/day forever
- **Setup**: Requires SendGrid account and API key
- **Best for**: Production with moderate email volume

### 3. Resend
- **Free Tier**: 3,000 emails/month
- **Setup**: Requires Resend account and API key
- **Best for**: Production with higher email volume

## Setup Instructions

### Option 1: Gmail SMTP (Easiest Free Option)

1. **Enable 2-Step Verification** on your Gmail account:
   - Go to https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Sports Event App" as the name
   - Copy the 16-character password

3. **Add to `.env` file**:
   ```env
   EMAIL_PROVIDER=gmail
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-app-password
   EMAIL_FROM=your-email@gmail.com
   EMAIL_FROM_NAME=Sports Event Management
   APP_NAME=Sports Event Management System
   ```

### Option 2: SendGrid

1. **Create SendGrid Account**:
   - Go to https://signup.sendgrid.com/
   - Sign up for free account

2. **Create API Key**:
   - Go to Settings > API Keys
   - Create new API key with "Mail Send" permissions
   - Copy the API key

3. **Add to `.env` file**:
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_USER=apikey
   SENDGRID_API_KEY=your-sendgrid-api-key
   EMAIL_FROM=your-verified-sender@yourdomain.com
   EMAIL_FROM_NAME=Sports Event Management
   APP_NAME=Sports Event Management System
   ```

### Option 3: Resend

1. **Create Resend Account**:
   - Go to https://resend.com/
   - Sign up for free account

2. **Create API Key**:
   - Go to API Keys section
   - Create new API key
   - Copy the API key

**Note:** Resend uses SMTP host `smtp.resend.com` with a fixed username `resend` (no SMTP user env var needed).

3. **Add to `.env` file**:
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=your-resend-api-key
   EMAIL_FROM=noreply@yourdomain.com
   EMAIL_FROM_NAME=Sports Event Management
   APP_NAME=Sports Event Management System
   ```

### Option 4: Generic SMTP

If you have access to any SMTP server:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Sports Event Management
APP_NAME=Sports Event Management System
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `EMAIL_PROVIDER` | Email provider: `gmail`, `sendgrid`, `resend`, `smtp` | No | `gmail` |
| `GMAIL_USER` | Gmail email address | Yes (if Gmail) | - |
| `GMAIL_APP_PASSWORD` | Gmail app password | Yes (if Gmail) | - |
| `SENDGRID_USER` | SendGrid username (usually `apikey`) | Yes (if SendGrid) | - |
| `SENDGRID_API_KEY` | SendGrid API key | Yes (if SendGrid) | - |
| `RESEND_API_KEY` | Resend API key | Yes (if Resend) | - |
| `SMTP_HOST` | SMTP server hostname | Yes (if SMTP) | - |
| `SMTP_PORT` | SMTP server port | No (if SMTP) | `587` |
| `SMTP_SECURE` | Use TLS/SSL | No (if SMTP) | `false` |
| `SMTP_USER` | SMTP username | Yes (if SMTP) | - |
| `SMTP_PASSWORD` | SMTP password | Yes (if SMTP) | - |
| `EMAIL_FROM` | Sender email address | No | `GMAIL_USER` or `noreply@sportsevent.com` |
| `EMAIL_FROM_NAME` | Sender display name | No | `Sports Event Management` |
| `APP_NAME` | Application name for emails | No | `Sports Event Management System` |

## Testing Email Configuration

After setting up your email provider, you can test the configuration by:

1. Starting the server
2. Attempting to reset a password
3. Checking the server logs for email sending status
4. Checking the recipient's inbox (and spam folder)

## Troubleshooting

### Gmail Issues

- **"Less secure app access" error**: Use App Password instead of regular password
- **"Authentication failed"**: Make sure 2-Step Verification is enabled
- **"Connection timeout"**: Check firewall/network settings

### SendGrid Issues

- **"Unauthorized"**: Verify API key is correct and has "Mail Send" permissions
- **"Sender verification"**: Verify your sender email/domain in SendGrid dashboard

### Resend Issues

- **"Invalid API key"**: Verify API key is correct
- **"Domain verification"**: Verify your domain in Resend dashboard

### General Issues

- **Emails not sending**: Check server logs for detailed error messages
- **Emails going to spam**: Configure SPF/DKIM records for your domain
- **Rate limiting**: Free tiers have daily/monthly limits

## Security Notes

- **Never commit `.env` file** to version control
- **Use App Passwords** for Gmail (not your regular password)
- **Rotate API keys** periodically
- **Monitor email sending** for suspicious activity

## Production Recommendations

For production environments:

1. **Use a dedicated email service** (SendGrid, Resend, Mailgun)
2. **Verify your domain** to improve deliverability
3. **Set up SPF/DKIM records** to prevent emails from going to spam
4. **Monitor email sending** and set up alerts for failures
5. **Use environment-specific email addresses** (e.g., `noreply@yourdomain.com`)
