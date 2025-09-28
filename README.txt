import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, FROM_EMAIL } = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: String(SMTP_SECURE || 'false').toLowerCase() === 'true', // true para 465 (SSL)
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const payload = JSON.parse(event.body || '{}');
    let { to = [], subject = 'Banco de Artistas', html = '' } = payload;

    if (!Array.isArray(to)) to = [to].filter(Boolean);
    to = to.filter(Boolean);
    if (!to.length) {
      return { statusCode: 400, body: 'Missing recipients' };
    }

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: to.join(','),
      subject,
      html,
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, id: info.messageId }) };
  } catch (err) {
    console.error('SMTP send error:', err);
    return { statusCode: 500, body: 'Email send error' };
  }
};
