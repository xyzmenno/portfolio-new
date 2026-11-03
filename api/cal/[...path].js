// Optionele proxy voor Vercel: zet in main.js  apiBase: '/api/cal'
// Handig als Cal.com rechtstreekse aanroepen vanuit de browser blokkeert,
// of als je een API-sleutel wilt gebruiken (zet CAL_API_KEY in Vercel > Settings > Environment Variables).
export default async function handler(req, res) {
  // Pad en query uit de URL zelf halen: req.query.path is bij de catch-all route niet betrouwbaar.
  const incoming = new URL(req.url, 'http://localhost');
  const fromQuery = [].concat(req.query.path || req.query['...path'] || []).join('/');
  const path = (fromQuery || incoming.pathname.replace(/^\/api\/cal\/?/, '')).replace(/^\/+|\/+$/g, '');
  if (!['slots', 'bookings'].includes(path)) return res.status(404).json({ error: 'Not found' });
  if (path === 'slots' && req.method !== 'GET') return res.status(405).end();
  if (path === 'bookings' && req.method !== 'POST') return res.status(405).end();

  const url = new URL('https://api.cal.com/v2/' + path);
  for (const [k, v] of incoming.searchParams) if (k !== 'path' && k !== '...path') url.searchParams.append(k, v);

  const headers = { 'Content-Type': 'application/json', 'cal-api-version': req.headers['cal-api-version'] || (path === 'slots' ? '2024-09-04' : '2024-08-13') };
  if (process.env.CAL_API_KEY) headers.Authorization = 'Bearer ' + process.env.CAL_API_KEY;

  const r = await fetch(url, { method: req.method, headers, body: req.method === 'POST' ? JSON.stringify(req.body) : undefined });
  res.status(r.status).setHeader('Content-Type', 'application/json').send(await r.text());
}
