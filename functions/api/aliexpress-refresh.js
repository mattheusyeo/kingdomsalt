// POST /api/aliexpress-refresh   (renews the AliExpress sign-in; call it once a day)
// The sign-in only lasts a day or two, so something must call this regularly.
// Send the header  Authorization: Bearer <ALIEXPRESS_ADMIN_SECRET>.
import { refreshToken, same } from '../_lib/aliexpress.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.ALIEXPRESS_ADMIN_SECRET) return json({ error: 'Not set up yet' }, 503);
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!same(given, env.ALIEXPRESS_ADMIN_SECRET)) return json({ error: 'Not allowed' }, 403);
  try {
    const t = await refreshToken(env);
    return json({ ok: true, expiresAt: new Date(t.expiresAt).toISOString() });   // never return the tokens themselves
  } catch (e) {
    console.log('AliExpress refresh error:', e.message);
    return json({ error: 'Could not renew the sign-in' }, 502);
  }
}
