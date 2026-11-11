const backend = 'https://margin-team-docs-surya.spunky-calf-4916.chatgpt.site';
const allowed = /^(auth\/(config|challenge|google)|me|logout|login|documents(?:\/[a-zA-Z0-9-]+(?:\/shares)?)?)$/;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, error) => { res.statusCode = status; res.end(JSON.stringify({error})); };
  const route = req.query?.route;
  if (typeof route !== 'string' || !allowed.test(route)) return reply(404, 'Not found');
  if (!['GET', 'POST', 'PUT'].includes(req.method)) return reply(405, 'Method not allowed');
  if (req.method !== 'GET' && req.headers.origin) {
    let host;
    try { host = new URL(req.headers.origin).host; } catch { return reply(403, 'Invalid origin'); }
    if (host !== req.headers.host) return reply(403, 'Cross-origin requests are not allowed');
  }
  const cookies = (req.headers.cookie || '').split(';').map(value => value.trim()).filter(value => /^(session|login_nonce)=/.test(value)).join('; ');
  const payload = req.method === 'GET' ? undefined : typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (payload && Buffer.byteLength(payload) > 600000) return reply(413, 'Request is too large');
  try {
    const upstream = await fetch(`${backend}/api/${route}`, {
      method: req.method,
      headers: {'Content-Type': 'application/json', Origin: backend, Cookie: cookies},
      body: payload,
      redirect: 'error',
      signal: AbortSignal.timeout(20000)
    });
    const setCookies = upstream.headers.getSetCookie().filter(value => /^(session|login_nonce)=/.test(value));
    if (setCookies.length) res.setHeader('Set-Cookie', setCookies);
    res.statusCode = upstream.status;
    res.end(await upstream.text());
  } catch {
    reply(503, 'The document service is temporarily unavailable. Please retry.');
  }
}
