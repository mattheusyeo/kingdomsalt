import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';

import { encodeForm, verifyStripeSignature } from '../functions/_lib/stripe.js';
import { priceCart } from '../functions/_lib/catalog.js';
import { buildOrder } from '../functions/_lib/fulfil.js';
import { onRequestPost as checkout } from '../functions/api/checkout.js';
import { onRequestPost as webhook } from '../functions/api/webhook.js';

// The server tests use a fixed sample shop (tests/fixtures/catalog.json) so they keep working however the real shop changes.
const catalogText = readFileSync(new URL('./fixtures/catalog.json', import.meta.url), 'utf8');
const catalog = JSON.parse(catalogText);
const liveCatalog = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));

const realFetch = globalThis.fetch;
let stripeCalls;
beforeEach(() => { stripeCalls = []; });
afterEach(() => { globalThis.fetch = realFetch; });

// Pretend to be Stripe
function fakeStripe(respond) {
  globalThis.fetch = async (url, init = {}) => {
    stripeCalls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
    const { status = 200, data } = respond(String(url), init);
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };
}

const env = (extra = {}) => ({
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  ASSETS: { fetch: async () => new Response(catalogText, { status: 200 }) },
  ...extra,
});
const post = (url, body, headers = {}) =>
  new Request(url, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers });

// ---------- helpers ----------
test('encodeForm nests objects and arrays the way Stripe expects', () => {
  const out = decodeURIComponent(encodeForm({ a: 1, line_items: [{ quantity: 2, price_data: { currency: 'aud' } }], skip: undefined, nope: null }));
  assert.equal(out, 'a=1&line_items[0][quantity]=2&line_items[0][price_data][currency]=aud');
});

test('priceCart accepts a valid cart and rejects bad ones', () => {
  assert.equal(priceCart(catalog, [{ id: 'acrylic-pen-holder', qty: 2 }]).lines[0].qty, 2);
  for (const bad of [[], null, [{ id: 'nope', qty: 1 }], [{ id: 'acrylic-pen-holder', qty: 0 }], [{ id: 'acrylic-pen-holder', qty: 11 }],
    [{ id: 'acrylic-pen-holder', qty: 1.5 }], [{ id: 'acrylic-pen-holder', qty: '2' }], [{ id: 'acrylic-pen-holder', qty: 1 }, { id: 'acrylic-pen-holder', qty: 1 }]]) {
    assert.ok(priceCart(catalog, bad).error, `should reject ${JSON.stringify(bad)}`);
  }
});

test('products.json is well formed', () => {
  assert.equal(liveCatalog.currency, 'aud');
  assert.deepEqual(liveCatalog.allowedCountries, ['AU']);
  const ids = new Set();
  for (const p of liveCatalog.products) {
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.ok(Number.isInteger(p.price) && p.price > 0, `${p.id} price must be whole cents`);
    assert.ok(!ids.has(p.id), `${p.id} duplicated`);
    ids.add(p.id);
    assert.ok(p.categories.length > 0 && p.categories.every((c) => ['lifestyle', 'stationery', 'accessories'].includes(c)), `${p.id} needs valid categories`);
    assert.ok(p.alt && p.image, `${p.id} needs an image and alt text`);
  }
  for (const p of liveCatalog.products.filter((x) => x.options)) {
    assert.ok(p.options.label && p.options.values.length > 0, `${p.id}: options need a label and values`);
    const optionIds = new Set();
    for (const v of p.options.values) {
      assert.match(v.id, /^[a-z0-9-]+$/);
      assert.ok(!optionIds.has(v.id), `${p.id}: option ${v.id} duplicated`);
      optionIds.add(v.id);
      assert.ok(v.name && v.image, `${p.id}/${v.id} needs a name and image`);
      for (const f of [v.image, v.thumb].filter(Boolean)) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${p.id}/${v.id}: missing file ${f}`);
    }
  }
  for (const c of Object.keys(liveCatalog.labels)) assert.ok(['lifestyle', 'stationery', 'accessories'].includes(c), `unknown label ${c}`);
});

test('every photo mentioned in products.json exists, and descriptions are lists of text', () => {
  for (const p of liveCatalog.products) {
    const files = [p.image, ...(p.images || []).map((i) => i.src)];
    // Photos can also be linked from a supplier's https image server instead of saved in assets/
    for (const f of files.filter((f) => !/^https:\/\//.test(f))) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${p.id}: missing file ${f}`);
    for (const i of p.images || []) assert.ok(i.alt, `${p.id}: photo ${i.src} needs alt text`);
    for (const key of ['description', 'details']) {
      if (p[key] !== undefined) assert.ok(Array.isArray(p[key]) && p[key].every((t) => typeof t === 'string' && t.length > 0), `${p.id}.${key}`);
    }
  }
});

// ---------- checkout ----------
test('checkout builds a Stripe session from SERVER prices, ignoring prices sent by the browser', async () => {
  fakeStripe(() => ({ data: { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } }));
  const res = await checkout({ request: post('https://shop.example/api/checkout', { items: [{ id: 'acrylic-pen-holder', qty: 2, price: 1 }] }), env: env() });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

  assert.equal(stripeCalls.length, 1);
  const call = stripeCalls[0];
  assert.equal(call.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(call.headers.Authorization, 'Bearer sk_test_123');
  const f = Object.fromEntries(new URLSearchParams(call.body));
  assert.equal(f.mode, 'payment');
  assert.equal(f['line_items[0][quantity]'], '2');
  assert.equal(f['line_items[0][price_data][currency]'], 'aud');
  assert.equal(f['line_items[0][price_data][unit_amount]'], '2200'); // not the 1 the browser sent
  assert.equal(f['line_items[0][price_data][product_data][name]'], 'Acrylic Pen Holder');
  assert.equal(f['line_items[0][price_data][product_data][metadata][sku]'], 'acrylic-pen-holder');
  assert.equal(f['line_items[0][price_data][product_data][images][0]'], 'https://shop.example/assets/acrylic-pen-holder.jpg');
  assert.equal(f['shipping_address_collection[allowed_countries][0]'], 'AU');
  assert.match(f['custom_text[submit][message]'], /Terms of sale.*Refund policy.*Australian Consumer Law/);
  assert.equal(f['phone_number_collection[enabled]'], 'true');
  assert.equal(f['shipping_options[0][shipping_rate_data][fixed_amount][currency]'], 'aud');
  assert.equal(f['shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]'], 'business_day');
  assert.equal(f.success_url, 'https://shop.example/success.html?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(f.cancel_url, 'https://shop.example/cart.html?canceled=1');
});

test('checkout leaves product images out on a non-https site (Stripe cannot fetch them)', async () => {
  fakeStripe(() => ({ data: { url: 'https://checkout.stripe.com/x' } }));
  await checkout({ request: post('http://localhost:8788/api/checkout', { items: [{ id: 'acrylic-pen-holder', qty: 1 }] }), env: env() });
  const f = Object.fromEntries(new URLSearchParams(stripeCalls[0].body));
  assert.equal(f['line_items[0][price_data][product_data][images][0]'], undefined);
});

test('checkout rejects bad carts without calling Stripe', async () => {
  fakeStripe(() => ({ data: {} }));
  for (const body of [{ items: [] }, { items: [{ id: 'nope', qty: 1 }] }, { items: [{ id: 'acrylic-pen-holder', qty: 99 }] }, {}]) {
    const res = await checkout({ request: post('https://shop.example/api/checkout', body), env: env() });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const res = await checkout({ request: post('https://shop.example/api/checkout', 'not json'), env: env() });
  assert.equal(res.status, 400);
  assert.equal(stripeCalls.length, 0);
});

test('checkout says so when Stripe is not configured, and hides Stripe errors from customers', async () => {
  const res = await checkout({ request: post('https://shop.example/api/checkout', { items: [{ id: 'acrylic-pen-holder', qty: 1 }] }), env: env({ STRIPE_SECRET_KEY: undefined }) });
  assert.equal(res.status, 503);

  fakeStripe(() => ({ status: 401, data: { error: { message: 'Invalid API Key provided: sk_test_123' } } }));
  const bad = await checkout({ request: post('https://shop.example/api/checkout', { items: [{ id: 'acrylic-pen-holder', qty: 1 }] }), env: env() });
  assert.equal(bad.status, 502);
  assert.ok(!(await bad.text()).includes('sk_test'), 'must not leak Stripe error details');
});

// ---------- webhook ----------
const sign = (body, secret = 'whsec_test', t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

const paidSession = {
  id: 'cs_test_paid', object: 'checkout.session', payment_status: 'paid', payment_intent: 'pi_1', created: 1700000000,
  currency: 'aud', amount_total: 4000, total_details: { amount_shipping: 0 },
  customer_details: { email: 'buyer@example.com', name: 'Sam Buyer', phone: '+61400000000' },
  shipping_details: { name: 'Sam Buyer', address: { line1: '1 George St', line2: null, city: 'Sydney', state: 'NSW', postal_code: '2000', country: 'AU' } },
  line_items: { data: [{ description: 'Acrylic Pen Holder', quantity: 2, amount_total: 4000, price: { unit_amount: 2000, product: { metadata: { sku: 'acrylic-pen-holder' } } } }] },
};
const event = (type = 'checkout.session.completed') => JSON.stringify({ id: 'evt_1', type, data: { object: { id: 'cs_test_paid' } } });
const kv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; };

test('verifyStripeSignature accepts a good signature and rejects bad, old or missing ones', async () => {
  const body = '{"a":1}';
  assert.equal(await verifyStripeSignature(body, sign(body), 'whsec_test'), true);
  assert.equal(await verifyStripeSignature(body, sign(body, 'whsec_other'), 'whsec_test'), false);
  assert.equal(await verifyStripeSignature(body + ' ', sign(body), 'whsec_test'), false, 'tampered body');
  assert.equal(await verifyStripeSignature(body, sign(body, 'whsec_test', Math.floor(Date.now() / 1000) - 3600), 'whsec_test'), false, 'too old');
  assert.equal(await verifyStripeSignature(body, null, 'whsec_test'), false);
  assert.equal(await verifyStripeSignature(body, 't=abc,v1=00', 'whsec_test'), false);
});

test('webhook rejects unsigned or wrongly signed requests', async () => {
  fakeStripe(() => ({ data: paidSession }));
  const body = event();
  for (const headers of [{}, { 'stripe-signature': sign(body, 'whsec_wrong') }]) {
    const res = await webhook({ request: post('https://shop.example/api/webhook', body, headers), env: env() });
    assert.equal(res.status, 400);
  }
  assert.equal(stripeCalls.length, 0);
});

test('webhook turns a paid session into a saved order, and only once', async () => {
  fakeStripe(() => ({ data: paidSession }));
  const store = kv();
  const body = event();
  const req = () => post('https://shop.example/api/webhook', body, { 'stripe-signature': sign(body) });

  const first = await webhook({ request: req(), env: env({ ORDERS: store }) });
  assert.equal(first.status, 200);
  assert.equal(await first.text(), 'OK');
  assert.match(stripeCalls[0].url, /\/v1\/checkout\/sessions\/cs_test_paid\?expand%5B0%5D=line_items\.data\.price\.product$/);

  const saved = JSON.parse(store.m.get('order:cs_test_paid'));
  assert.equal(saved.customer.email, 'buyer@example.com');
  assert.equal(saved.shipping.postalCode, '2000');
  assert.deepEqual(saved.items, [{ sku: 'acrylic-pen-holder', option: null, name: 'Acrylic Pen Holder', quantity: 2, unitAmount: 2000, total: 4000 }]);
  assert.equal(saved.fulfilment.status, 'manual');
  assert.match(saved.fulfilment.reason, /not connected yet/);
  assert.equal(saved.fulfilment.supplierLines[0].aliexpressProductId, '1005009000500891');

  const again = await webhook({ request: req(), env: env({ ORDERS: store }) });
  assert.equal(await again.text(), 'Already processed');
  assert.equal(store.m.size, 1);
});

test('webhook ignores other events and unpaid sessions, and asks Stripe to retry on failure', async () => {
  fakeStripe(() => ({ data: { ...paidSession, payment_status: 'unpaid' } }));
  let body = event('payment_intent.created');
  let res = await webhook({ request: post('https://shop.example/api/webhook', body, { 'stripe-signature': sign(body) }), env: env() });
  assert.equal(await res.text(), 'Ignored');
  assert.equal(stripeCalls.length, 0);

  body = event();
  res = await webhook({ request: post('https://shop.example/api/webhook', body, { 'stripe-signature': sign(body) }), env: env() });
  assert.equal(await res.text(), 'Not paid yet');

  fakeStripe(() => ({ status: 500, data: {} }));
  res = await webhook({ request: post('https://shop.example/api/webhook', body, { 'stripe-signature': sign(body) }), env: env() });
  assert.equal(res.status, 500);
});

test('buildOrder copes with a session that has no shipping details', () => {
  const order = buildOrder({ id: 'cs_x', created: 1, line_items: { data: [] } });
  assert.equal(order.shipping.line1, null);
  assert.deepEqual(order.items, []);
});

// ---------- options (scents) ----------
test('priceCart needs a valid option for products that have options, and refuses options on others', () => {
  const candle = catalog.products.find((p) => p.id === 'scented-tin-candle');
  assert.ok(candle, 'candle product exists');
  const first = candle.options.values[0];
  const ok = priceCart(catalog, [{ id: candle.id, option: first.id, qty: 2 }]);
  assert.equal(ok.lines[0].option.id, first.id);
  assert.equal(ok.lines[0].unitAmount, candle.price);

  assert.match(priceCart(catalog, [{ id: candle.id, qty: 1 }]).error, /choose a scent/i, 'option is required');
  assert.ok(priceCart(catalog, [{ id: candle.id, option: 'nope', qty: 1 }]).error, 'unknown option rejected');
  assert.ok(priceCart(catalog, [{ id: 'acrylic-pen-holder', option: 'lavender', qty: 1 }]).error, 'option not allowed on a product without options');
  // same product, different scents = two separate lines (fine); same scent twice = rejected
  const second = candle.options.values[1];
  assert.equal(priceCart(catalog, [{ id: candle.id, option: first.id, qty: 1 }, { id: candle.id, option: second.id, qty: 1 }]).lines.length, 2);
  assert.ok(priceCart(catalog, [{ id: candle.id, option: first.id, qty: 1 }, { id: candle.id, option: first.id, qty: 1 }]).error);
});

test('checkout shows the chosen scent to Stripe and records it for the supplier', async () => {
  const candle = catalog.products.find((p) => p.id === 'scented-tin-candle');
  const v = candle.options.values[1];
  fakeStripe(() => ({ data: { url: 'https://checkout.stripe.com/x' } }));
  const res = await checkout({ request: post('https://shop.example/api/checkout', { items: [{ id: candle.id, option: v.id, qty: 3 }] }), env: env() });
  assert.equal(res.status, 200);
  const f = Object.fromEntries(new URLSearchParams(stripeCalls[0].body));
  assert.equal(f['line_items[0][price_data][product_data][name]'], `${candle.name} (${v.name})`);
  assert.equal(f['line_items[0][price_data][product_data][metadata][sku]'], candle.id);
  assert.equal(f['line_items[0][price_data][product_data][metadata][option]'], v.id);
  assert.equal(f['line_items[0][price_data][unit_amount]'], String(candle.price));
  assert.equal(f['line_items[0][quantity]'], '3');

  const missing = await checkout({ request: post('https://shop.example/api/checkout', { items: [{ id: candle.id, qty: 1 }] }), env: env() });
  assert.equal(missing.status, 400);
});

test('webhook order keeps the chosen scent and flags a missing AliExpress variant', async () => {
  const candle = catalog.products.find((p) => p.id === 'scented-tin-candle');
  const v = candle.options.values[0];
  const session = {
    ...paidSession, id: 'cs_test_candle',
    line_items: { data: [{ description: `${candle.name} (${v.name})`, quantity: 1, amount_total: candle.price, price: { unit_amount: candle.price, product: { metadata: { sku: candle.id, option: v.id } } } }] },
  };
  fakeStripe(() => ({ data: session }));
  const store = kv();
  const body = JSON.stringify({ id: 'evt_2', type: 'checkout.session.completed', data: { object: { id: 'cs_test_candle' } } });
  const res = await webhook({ request: post('https://shop.example/api/webhook', body, { 'stripe-signature': sign(body) }), env: env({ ORDERS: store }) });
  assert.equal(await res.text(), 'OK');
  const saved = JSON.parse(store.m.get('order:cs_test_candle'));
  assert.equal(saved.items[0].option, v.id);
  assert.equal(saved.fulfilment.supplierLines[0].option, v.id);
  assert.match(saved.fulfilment.reason, new RegExp(`${candle.id}/${v.id}`));
});


// ---------- AliExpress sign-in ----------
import { sign as aeSign, exchangeCode, getAccessToken, TOKEN_KEY } from '../functions/_lib/aliexpress.js';
import { onRequestGet as aeCallback } from '../functions/api/aliexpress-callback.js';
import { onRequestPost as aeRefresh } from '../functions/api/aliexpress-refresh.js';

const fakeKV = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; };
const aeEnv = (extra = {}) => ({ ALIEXPRESS_APP_KEY: '123', ALIEXPRESS_APP_SECRET: 'shh', ALIEXPRESS_AUTH_STATE: 'state-xyz', ALIEXPRESS_ADMIN_SECRET: 'admin-pw', ORDERS: fakeKV(), ...extra });
const fakeAliExpress = (respond) => {
  globalThis.fetch = async (url, init = {}) => {
    stripeCalls.push({ url: String(url), body: init.body });
    return new Response(JSON.stringify(respond(String(url), Object.fromEntries(new URLSearchParams(init.body)))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
};

test('AliExpress signature is HMAC-SHA256 over the path and the sorted name+value pairs, in capitals', async () => {
  const expected = createHmac('sha256', 'shh').update('/auth/token/createapp_key123codeabcsign_methodsha256timestamp1700000000000').digest('hex').toUpperCase();
  assert.equal(await aeSign('shh', '/auth/token/create', { timestamp: '1700000000000', code: 'abc', app_key: '123', sign_method: 'sha256', sign: 'ignored' }), expected);
});

test('first sign-in swaps the code for a token and saves it (without the secret in the request)', async () => {
  const env = aeEnv();
  fakeAliExpress(() => ({ access_token: 'AT1', refresh_token: 'RT1', expires_in: 86400, refresh_expires_in: 172800, user_nick: 'shop' }));
  const t = await exchangeCode(env, 'thecode');
  assert.equal(t.accessToken, 'AT1'); assert.equal(t.refreshToken, 'RT1');
  assert.equal(JSON.parse(env.ORDERS.m.get(TOKEN_KEY)).accessToken, 'AT1');
  const call = stripeCalls[0];
  assert.equal(call.url, 'https://api-sg.aliexpress.com/rest/auth/token/create');
  const f = Object.fromEntries(new URLSearchParams(call.body));
  assert.equal(f.code, 'thecode'); assert.equal(f.app_key, '123'); assert.equal(f.sign_method, 'sha256'); assert.match(f.sign, /^[0-9A-F]{64}$/);
  assert.ok(!call.body.includes('shh'), 'the app secret must never be sent');
});

test('callback refuses a wrong or missing state, and accepts the right one', async () => {
  const env = aeEnv();
  fakeAliExpress(() => ({ access_token: 'AT1', refresh_token: 'RT1', expires_in: 86400 }));
  let res = await aeCallback({ request: new Request('https://shop.example/api/aliexpress-callback?code=c&state=nope'), env });
  assert.equal(res.status, 403);
  res = await aeCallback({ request: new Request('https://shop.example/api/aliexpress-callback?code=c'), env });
  assert.equal(res.status, 403);
  assert.equal(stripeCalls.length, 0, 'no call to AliExpress without the right state');
  res = await aeCallback({ request: new Request('https://shop.example/api/aliexpress-callback?code=c&state=state-xyz'), env });
  assert.equal(res.status, 200);
  assert.ok(env.ORDERS.m.get(TOKEN_KEY));
  res = await aeCallback({ request: new Request('https://shop.example/api/aliexpress-callback?code=c&state=state-xyz'), env: { ...env, ALIEXPRESS_AUTH_STATE: undefined } });
  assert.equal(res.status, 503);
});

test('refresh endpoint needs the admin secret, never returns the tokens, and keeps the refresh token', async () => {
  const env = aeEnv();
  env.ORDERS.m.set(TOKEN_KEY, JSON.stringify({ accessToken: 'old', refreshToken: 'RT1', expiresAt: Date.now() + 1000, refreshExpiresAt: Date.now() + 1e8 }));
  fakeAliExpress((url, f) => { assert.equal(f.refresh_token, 'RT1'); return { access_token: 'AT2', expires_in: 86400 }; });
  let res = await aeRefresh({ request: new Request('https://shop.example/api/aliexpress-refresh', { method: 'POST' }), env });
  assert.equal(res.status, 403);
  res = await aeRefresh({ request: new Request('https://shop.example/api/aliexpress-refresh', { method: 'POST', headers: { Authorization: 'Bearer admin-pw' } }), env });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(!body.includes('AT2') && !body.includes('RT1'));
  const saved = JSON.parse(env.ORDERS.m.get(TOKEN_KEY));
  assert.equal(saved.accessToken, 'AT2'); assert.equal(saved.refreshToken, 'RT1');
});

test('getAccessToken reuses a good token and renews one that is about to expire', async () => {
  const env = aeEnv();
  env.ORDERS.m.set(TOKEN_KEY, JSON.stringify({ accessToken: 'fresh', refreshToken: 'RT', expiresAt: Date.now() + 20 * 3600e3 }));
  fakeAliExpress(() => { throw new Error('should not be called'); });
  assert.equal(await getAccessToken(env), 'fresh');
  env.ORDERS.m.set(TOKEN_KEY, JSON.stringify({ accessToken: 'stale', refreshToken: 'RT', expiresAt: Date.now() + 3600e3 }));
  fakeAliExpress(() => ({ access_token: 'renewed', expires_in: 86400 }));
  assert.equal(await getAccessToken(env), 'renewed');
  await assert.rejects(() => getAccessToken(aeEnv()), /Not signed in/);
});
