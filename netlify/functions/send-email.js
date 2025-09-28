import sgMail from '@sendgrid/mail';

const { SENDGRID_API_KEY, FROM_EMAIL } = process.env;

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    if (!SENDGRID_API_KEY || !FROM_EMAIL) {
      return { statusCode: 500, body: 'Missing SENDGRID_API_KEY or FROM_EMAIL env vars' };
    }
    sgMail.setApiKey(SENDGRID_API_KEY);
    const payload = JSON.parse(event.body || '{}');
    let { to = [], subject = 'Banco de Artistas', html = '' } = payload;

    if (!Array.isArray(to)) to = [to].filter(Boolean);
    to = to.filter(Boolean);

    if (!to.length) {
      return { statusCode: 400, body: 'Missing recipients' };
    }

    const msg = { to, from: FROM_EMAIL, subject, html };
    await sgMail.sendMultiple(msg);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('Send email error:', err);
    return { statusCode: 500, body: 'Email send error' };
  }
};
