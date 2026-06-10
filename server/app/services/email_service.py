import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings


class EmailNotConfiguredError(RuntimeError):
    """SMTP 자격증명이 설정되지 않은 경우"""


def send_email(
    to_addr: str,
    subject: str,
    body: str,
    reply_to: str | None = None,
) -> None:
    if not settings.smtp_user or not settings.smtp_password:
        raise EmailNotConfiguredError(
            "SMTP_USER / SMTP_PASSWORD가 설정되지 않았습니다 (server/.env 확인)"
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to_addr
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
