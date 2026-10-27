const webpush = require('web-push');

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mubadara-scanner.vercel.app');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json(res, 500, { error: 'Push service environment is incomplete.' });
  }

  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return json(res, 401, { error: 'Authentication required.' });
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, authorization } });
  if (!userResponse.ok) return json(res, 401, { error: 'Invalid authentication.' });
  const sender = await userResponse.json();
  const { title = 'جمعية المبادرة', body = 'لديك إشعار جديد.', url = 'https://mubadara-online.vercel.app/?screen=uploadTool#uploadTool', sender_id, audience = 'all' } = req.body || {};
  if (sender_id && sender_id !== sender.id) return json(res, 403, { error: 'Sender mismatch.' });

  webpush.setVapidDetails('mailto:admin@mubadara-online.vercel.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const subscriptionsResponse = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?is_active=eq.true&select=id,user_id,subscription&limit=500`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  if (!subscriptionsResponse.ok) return json(res, 502, { error: 'Unable to load push subscriptions.' });
  let subscriptions = await subscriptionsResponse.json();
  if (audience === 'owners') {
    const ownersResponse = await fetch(`${SUPABASE_URL}/rest/v1/app_user_profiles?app_role=in.(owner,manager)&select=user_id&limit=500`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });
    if (!ownersResponse.ok) return json(res, 502, { error: 'Unable to load owner accounts.' });
    const ownerIds = new Set((await ownersResponse.json()).map(row => String(row.user_id)).filter(Boolean));
    subscriptions = subscriptions.filter(row => ownerIds.has(String(row.user_id)));
  }
  const payload = JSON.stringify({ title, body, url: url || 'https://mubadara-online.vercel.app/?screen=uploadTool#uploadTool', icon: 'https://mubadara-online.vercel.app/icons/icon-192.png', badge: 'https://mubadara-online.vercel.app/icons/icon-192.png', tag: `scanner-${Date.now()}` });
  let sent = 0, removed = 0;
  for (const row of subscriptions) {
    try { await webpush.sendNotification(row.subscription, payload); sent += 1; }
    catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ is_active: false }) });
        removed += 1;
      }
    }
  }
  return json(res, 200, { ok: true, sent, removed });
};
