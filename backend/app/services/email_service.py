import logging
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("carebridge.email")


def _get_base_template(content_html: str, action_url: Optional[str] = None, action_text: Optional[str] = None) -> str:
    btn_html = ""
    if action_url and action_text:
        btn_html = f"""
        <div style="margin: 28px 0; text-align: center;">
            <a href="{action_url}" style="background-color: #14B8A6; color: #ffffff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                {action_text} &rarr;
            </a>
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0B1522; margin: 0; padding: 24px; }}
            .container {{ max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; border: 1px solid #E2E8F0; overflow: hidden; }}
            .header {{ background-color: #0B1522; padding: 24px; text-align: center; color: #ffffff; }}
            .header h1 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }}
            .header p {{ margin: 4px 0 0; font-size: 12px; color: #94A3B8; }}
            .body-content {{ padding: 28px; font-size: 14px; line-height: 1.6; color: #334155; }}
            .alert-box {{ background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 12px; padding: 16px; margin: 16px 0; color: #991B1B; }}
            .info-box {{ background-color: #F0FDFA; border: 1px solid #CCFBF1; border-radius: 12px; padding: 16px; margin: 16px 0; color: #115E59; }}
            .footer {{ background-color: #F1F5F9; padding: 18px; text-align: center; font-size: 11px; color: #64748B; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>CareBridge <span style="color: #14B8A6;">AI</span></h1>
                <p>Smarter Care. Safer Living. Connected Families.</p>
            </div>
            <div class="body-content">
                {content_html}
                {btn_html}
            </div>
            <div class="footer">
                <p>CareBridge AI Elderly Healthcare & Medication Management Platform</p>
                <p>Automated healthcare alert. For emergencies, please call local medical emergency services immediately.</p>
            </div>
        </div>
    </body>
    </html>
    """


def send_email_async(to_email: str, subject: str, html_body: str):
    """Dispatches email in a background daemon thread to avoid blocking caller."""
    thread = threading.Thread(
        target=_send_smtp_worker,
        args=(to_email, subject, html_body),
        daemon=True
    )
    thread.start()


def _send_smtp_worker(to_email: str, subject: str, html_body: str):
    if not settings.ENABLE_EMAIL_ALERTS or not settings.SMTP_HOST:
        logger.info(f"[EMAIL NOTIFICATION] To: {to_email} | Subject: '{subject}' | SMTP unconfigured; notification logged safely.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            logger.info(f"Successfully delivered SMTP email to {to_email}")
    except Exception as e:
        logger.warning(f"SMTP delivery failed to {to_email}: {e} (In-app notifications remain unaffected)")


# 1. Upcoming Medication Reminder
def send_upcoming_medication_email(to_email: str, elder_name: str, med_name: str, dosage: str, scheduled_time: str, instructions: Optional[str] = None):
    subject = f"Medication Reminder: Dose Due at {scheduled_time}"
    content = f"""
    <p>Hello,</p>
    <p>This is a scheduled reminder that <strong>{elder_name}</strong> has a medication dose due soon:</p>
    <div class="info-box">
        <strong>Medication:</strong> {med_name} ({dosage})<br>
        <strong>Scheduled Time:</strong> {scheduled_time}<br>
        <strong>Instructions:</strong> {instructions or 'Standard prescription instructions'}
    </div>
    <p>Please ensure this dose is confirmed in the CareBridge AI portal once taken.</p>
    """
    html = _get_base_template(content, action_url="http://127.0.0.1:5173/schedule", action_text="Confirm Dose in Schedule")
    send_email_async(to_email, subject, html)


# 2. Missed Medication Alert
def send_missed_dose_email(to_email: str, recipient_name: str, elder_name: str, med_name: str, dosage: str, scheduled_time: str):
    subject = f"Care Alert: {elder_name} Missed Medication Dose"
    content = f"""
    <p>Dear {recipient_name},</p>
    <div class="alert-box">
        <strong>Safety Alert:</strong> A scheduled dose for <strong>{elder_name}</strong> has exceeded the configured grace window without confirmation.
    </div>
    <p><strong>Dose Details:</strong></p>
    <ul>
        <li><strong>Medication:</strong> {med_name} ({dosage})</li>
        <li><strong>Scheduled Time:</strong> {scheduled_time}</li>
    </ul>
    <p>Please check in with {elder_name} to confirm their wellbeing and verify whether assistance is needed.</p>
    """
    html = _get_base_template(content, action_url="http://127.0.0.1:5173/dashboard", action_text="Open Care Dashboard")
    send_email_async(to_email, subject, html)


# 3. Upcoming Appointment Reminder
def send_appointment_email(to_email: str, recipient_name: str, elder_name: str, doctor_name: str, specialty: str, appt_date: str, appt_time: str, hospital: str, address: Optional[str] = None):
    subject = f"Appointment Reminder: Dr. {doctor_name} on {appt_date}"
    content = f"""
    <p>Dear {recipient_name},</p>
    <p>This is an automated reminder regarding an upcoming doctor appointment for <strong>{elder_name}</strong>:</p>
    <div class="info-box">
        <strong>Doctor:</strong> Dr. {doctor_name} ({specialty})<br>
        <strong>Date & Time:</strong> {appt_date} at {appt_time}<br>
        <strong>Facility:</strong> {hospital}<br>
        {"<strong>Address:</strong> " + address + "<br>" if address else ""}
    </div>
    <p>Please ensure all necessary medical documents, insurance cards, and current prescription lists are prepared.</p>
    """
    html = _get_base_template(content, action_url="http://127.0.0.1:5173/appointments", action_text="View Appointment Details")
    send_email_async(to_email, subject, html)


# 4. Family Connection Approval
def send_family_connection_email(to_email: str, member_name: str, elder_name: str, relationship: str):
    subject = f"CareBridge AI: Connected to {elder_name}'s Healthcare Profile"
    content = f"""
    <p>Hello {member_name},</p>
    <div class="info-box">
        You have been authorized as a <strong>{relationship}</strong> for <strong>{elder_name}</strong>'s healthcare circle.
    </div>
    <p>You can now monitor daily medication adherence, view doctor appointments, and receive timely alerts if a scheduled dose is missed.</p>
    """
    html = _get_base_template(content, action_url="http://127.0.0.1:5173/family/dashboard", action_text="Access Family Portal")
    send_email_async(to_email, subject, html)


# 5. Caregiver Connection Approval
def send_caregiver_connection_email(to_email: str, caregiver_name: str, elder_name: str):
    subject = f"CareBridge AI: Assigned to Patient {elder_name}"
    content = f"""
    <p>Hello {caregiver_name},</p>
    <div class="info-box">
        You have been granted clinical caregiver access to <strong>{elder_name}</strong>'s profile.
    </div>
    <p>You can now manage medication schedules, verify administered doses, and view clinical visit records.</p>
    """
    html = _get_base_template(content, action_url="http://127.0.0.1:5173/caregiver/dashboard", action_text="Open Caregiver Workspace")
    send_email_async(to_email, subject, html)

