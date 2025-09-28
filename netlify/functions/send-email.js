export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const url = process.env.GAS_EMAIL_WEBHOOK;
    if (!url) {
      return { statusCode: 500, body: 'Missing GAS_EMAIL_WEBHOOK env var' };
    }

    const r = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: event.body || '{}'
    });

    const text = await r.text();
    return { statusCode: r.ok ? 200 : 500, body: text };
  } catch (err) {
    console.error('Relay error:', err);
    return { statusCode: 500, body: 'Relay error' };
  }
};
