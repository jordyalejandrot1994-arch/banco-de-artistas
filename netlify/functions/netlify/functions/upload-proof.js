export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const url = process.env.GAS_EMAIL_WEBHOOK;
    if (!url) {
      return { statusCode: 500, body: 'Missing GAS_EMAIL_WEBHOOK env var' };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body || '{}'
    });
    const text = await res.text();
    return { statusCode: res.ok ? 200 : 500, body: text };
  } catch (e) {
    console.error('Upload relay error:', e);
    return { statusCode: 500, body: 'Upload relay error' };
  }
};
