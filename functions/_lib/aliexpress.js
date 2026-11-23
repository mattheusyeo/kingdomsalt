// AliExpress Open Platform (Dropshipping API): signing, sign-in tokens and a helper to call it.
//
// The App Key and App Secret live in Cloudflare secrets (ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET),
// never in this repository. The sign-in token is kept in the ORDERS storage under TOKEN_KEY.
//
// NOTE: written from AliExpress's published documentation and covered by tests with a pretend
// server. It has not been run against the real AliExpress yet, so the first real sign-in is the test.

export const API_BASE = 'https://api-sg.aliexpress.com';
export const TOKEN_KEY = 'aliexpress:token';
const REFRESH_WHEN_LEFT_MS = 6 * 60 * 60 * 1000; // renew when less than 6 hours are left

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

/** AliExpress signature: HMAC-SHA256 over the API path followed by every parameter name and value, sorted by name. */
export async function sign(secret, apiPath, params) {
  const text = apiPath + Object.keys(params).filter((k) => k !== 'sign').sort().map((k) => k + params[k]).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

/** Calls one AliExpress "system" API (for example /auth/token/create). Returns the parsed JSON. */
export async function aliexpressCall(env, apiPath, params = {}) {
  if (!env.ALIEXPRESS_APP_KEY || !env.ALIEXPRESS_APP_SECRET) throw new Error('AliExpress is not set up yet');
  const all = { app_key: env.ALIEXPRESS_APP_KEY, timestamp: String(Date.now()), sign_method: 'sha256', ...params };
  all.sign = await sign(env.ALIEXPRESS_APP_SECRET, apiPath, all);
  const res = await fetch(`${API_BASE}/rest${apiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(all).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`AliExpress returned ${res.status}`);
  return data;
}

function toToken(data, previous) {
  const r = data && (data.access_token ? data : data.data) || {};
  if (!r.access_token) throw new Error((data && (data.message || data.error_message || data.error_description)) || 'AliExpress did not return a token');
  const now = Date.now();
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token || (previous && previous.refreshToken) || null,
    expiresAt: Number(r.expire_time) || now + Number(r.expires_in || 86400) * 1000,
    refreshExpiresAt: Number(r.refresh_token_valid_time) || now + Number(r.refresh_expires_in || 172800) * 1000,
    account: r.user_nick || r.account || (previous && previous.account) || null,
    updatedAt: new Date(now).toISOString(),
  };
}

async function save(env, token) {
  if (!env.ORDERS) throw new Error('Storage (ORDERS) is not connected');
  await env.ORDERS.put(TOKEN_KEY, JSON.stringify(token));
  return token;
}

/** First sign-in: swaps the one-time code from the authorisation page for a token and saves it. */
export async function exchangeCode(env, code) {
  const data = await aliexpressCall(env, '/auth/token/create', { code });
  return save(env, toToken(data, null));
}

/** Gets a fresh access token using the refresh token, and saves it. */
export async function refreshToken(env) {
  const current = env.ORDERS && JSON.parse((await env.ORDERS.get(TOKEN_KEY)) || 'null');
  if (!current || !current.refreshToken) throw new Error('Not signed in to AliExpress yet');
  const data = await aliexpressCall(env, '/auth/token/refresh', { refresh_token: current.refreshToken });
  return save(env, toToken(data, current));
}

/** The access token to use for a call. Renews it first if it is about to expire. */
export async function getAccessToken(env) {
  const current = env.ORDERS && JSON.parse((await env.ORDERS.get(TOKEN_KEY)) || 'null');
  if (!current) throw new Error('Not signed in to AliExpress yet');
  if (current.expiresAt - Date.now() > REFRESH_WHEN_LEFT_MS) return current.accessToken;
  return (await refreshToken(env)).accessToken;
}

/** Constant-time comparison for secrets. */
export function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
