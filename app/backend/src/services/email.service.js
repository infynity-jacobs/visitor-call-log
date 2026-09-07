const nodemailer = require('nodemailer');
const { query } = require('../db/pool');
const { decrypt } = require('../utils/crypto');
const { AppError } = require('../middleware/errorHandler');

async function getSmtpSettings() {
  const result = await query('SELECT * FROM smtp_settings WHERE id = 1');
  return result.rows[0];
}

function buildTransport(settings) {
  if (!settings || !settings.smtp_host || !settings.smtp_port) {
    throw new AppError('SMTP is not configured. Please configure it under Settings before sending email.', 400);
  }
  const password = settings.smtp_password_enc ? decrypt(settings.smtp_password_enc) : undefined;
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.security === 'ssl',
    ...(settings.security === 'tls' ? { requireTLS: true } : {}),
    auth: settings.smtp_username ? { user: settings.smtp_username, pass: password } : undefined
  });
}

async function sendMail({ to, subject, text, html, attachments }) {
  const settings = await getSmtpSettings();
  const transport = buildTransport(settings);
  const from = settings.from_email
    ? `${settings.from_name || ''} <${settings.from_email}>`.trim()
    : settings.smtp_username;

  return transport.sendMail({ from, to, subject, text, html, attachments });
}

async function sendTestEmail(to) {
  return sendMail({
    to,
    subject: 'Test Email — Visitor Register & Call Log System',
    text: 'This is a test email confirming your SMTP configuration is working correctly.'
  });
}

module.exports = { sendMail, sendTestEmail, getSmtpSettings };
