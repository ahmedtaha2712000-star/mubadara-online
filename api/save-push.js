function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

function cors(res) {
  const origin = String(res.req?.headers?.origin || '');
  const allowed = ['https://mubadara-online.vercel.app', 'https://mubadara-scanner.vercel.app'];
  res.setHeader('Access-Control-Allow-Origin', allowed.includes(origin) ? origin : 'https://mubadara-online.vercel.app');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY } = process.env;
  const anonKey = SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !anonKey) return json(res, 500, { error: 'Supabase environment is incomplete.' });

  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return json(res, 401, { error: 'Authentication required.' });
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anonKey, authorization } });
  if (!userResponse.ok) return json(res, 401, { error: 'Invalid authentication.' });
  const user = await userResponse.json();
  const input = req.body || {};
  if (!input.endpoint || !input.subscription) return json(res, 400, { error: 'Push subscription is incomplete.' });

  const row = {
    user_id: user.id,
    endpoint: String(input.endpoint),
    subscription: input.subscription,
    device_label: String(input.device_label || '').slice(0, 180),
    is_active: true,
    updated_at: new Date().toISOString()
  };
  const saveResponse = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(row)
  });
  if (!saveResponse.ok) return json(res, 502, { error: 'Unable to save push subscription.' });
  return json(res, 200, { ok: true });
};
