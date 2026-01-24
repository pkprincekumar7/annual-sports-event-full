import logging
from email.message import EmailMessage
from typing import Dict

import aiosmtplib

from .config import get_settings


logger = logging.getLogger("identity-service.email")
settings = get_settings()


def _smtp_config() -> Dict[str, str]:
    provider = settings.email_provider
    if provider == "gmail":
        if not settings.gmail_user or not settings.gmail_app_password:
            return {}
        return {
            "host": "smtp.gmail.com",
            "port": 587,
            "user": settings.gmail_user,
            "password": settings.gmail_app_password,
        }
    if provider == "sendgrid":
        if not settings.sendgrid_api_key:
            return {}
        return {
            "host": "smtp.sendgrid.net",
            "port": 587,
            "user": settings.sendgrid_user or "apikey",
            "password": settings.sendgrid_api_key,
        }
    if provider == "resend":
        if not settings.resend_api_key:
            return {}
        return {
            "host": "smtp.resend.com",
            "port": 587,
            "user": "resend",
            "password": settings.resend_api_key,
        }
    if provider == "smtp":
        if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
            return {}
        return {
            "host": settings.smtp_host,
            "port": settings.smtp_port,
            "user": settings.smtp_user,
            "password": settings.smtp_password,
            "secure": settings.smtp_secure,
        }
    return {}


async def send_password_reset_email(
    to_email: str, new_password: str, recipient_name: str = "User"
) -> Dict[str, str]:
    config = _smtp_config()
    if not config:
        logger.error("Email transporter not configured. Cannot send email.")
        return {"success": False, "error": "Email service not configured. Please contact administrator."}

    from_email = settings.email_from or settings.gmail_user or "noreply@sportsevent.com"
    from_name = settings.email_from_name
    app_name = settings.app_name

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body>
  <p>Hello {recipient_name or 'User'},</p>
  <p>You have requested to reset your password. Your new temporary password is:</p>
  <p><strong>{new_password}</strong></p>
  <p>For security reasons, you will be required to change this password immediately after logging in.</p>
  <p>This is an automated email from {app_name}.</p>
</body>
</html>
""".strip()

    text_body = f"""
Password Reset - {app_name}

Hello {recipient_name or 'User'},

You have requested to reset your password for your account. Your new temporary password is:

{new_password}

IMPORTANT: For security reasons, you will be required to change this password immediately after logging in.

This is an automated email. Please do not reply to this message.
""".strip()

    message = EmailMessage()
    message["Subject"] = "Password Reset - Sports Event Management"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=config["host"],
            port=config["port"],
            username=config["user"],
            password=config["password"],
            start_tls=not config.get("secure", False),
            use_tls=config.get("secure", False),
        )
        return {"success": True}
    except Exception as exc:
        logger.error("Error sending password reset email: %s", exc)
        return {"success": False, "error": str(exc)}
