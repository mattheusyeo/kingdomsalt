// GET /api/aliexpress-callback   (AliExpress sends you here after you approve the app)
// Needs the Cloudflare secrets ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET and ALIEXPRESS_AUTH_STATE.
// The "state" in the address must match ALIEXPRESS_AUTH_STATE, so nobody else can connect their account.
import { exchangeCode, same } from '../_lib/aliexpress.js';

const page = (title, text, status = 200) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>${title}</title>` +
    `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1>${title}</h1><p>${text}</p></body>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  if (!env.ALIEXPRESS_APP_KEY || !env.ALIEXPRESS_APP_SECRET || !env.ALIEXPRESS_AUTH_STATE) {
    return page('Not set up yet', 'The AliExpress secrets have not been added to Cloudflare.', 503);
  }
  const url = new URL(request.url);
  if (!same(url.searchParams.get('state') || '', env.ALIEXPRESS_AUTH_STATE)) {
    return page('Not allowed', 'This link is not valid.', 403);
  }
  const code = url.searchParams.get('code');
  if (!code) return page('Missing code', 'AliExpress did not send a code. Please try approving the app again.', 400);
  try {
    await exchangeCode(env, code);
    return page('Connected', 'Your AliExpress account is connected. You can close this page.');
  } catch (e) {
    console.log('AliExpress sign-in error:', e.message);
    return page('Could not connect', 'AliExpress did not accept the sign-in. Please try again.', 502);
  }
}
