/* Lumen Terminal — provider proxy.
 *
 * Why this exists: Alpaca, Marketaux, Etherscan and FMP send no CORS headers, so a browser
 * cannot call them directly no matter how valid the key is. This function is the server side
 * that can.
 *
 * It is deliberately narrow:
 *   - only the providers in ALLOW are reachable
 *   - only path segments matching that provider's pattern are forwarded
 *   - credentials come from this deploy's environment variables, never from the request,
 *     so a key is never exposed to the page or to anyone who finds the function URL
 *
 * Environment variables to set in Netlify (Site settings → Environment variables):
  *   MARKETAUX_TOKEN
 *   ETHERSCAN_KEY
 *   FMP_KEY
 *   FINNHUB_KEY                 — optional; Finnhub also works direct from the browser
 *   LUMEN_ALLOWED_ORIGIN        — optional; defaults to '*', set to your site origin to lock it down
 *
 * Anything not configured returns 501 rather than a confusing upstream error.
 */

const ALLOW = {
  marketaux: {
    hosts: { trading: 'https://api.marketaux.com/v1' },
    path: /^\/news\/(all|similar)$/,
    methods: ['GET'],
    query: (q) => {
      if (!process.env.MARKETAUX_TOKEN) return false;
      q.set('api_token', process.env.MARKETAUX_TOKEN);
      return true;
    }
  },
  finnhub: {
    hosts: { trading: 'https://finnhub.io/api/v1' },
    path: /^\/(quote|stock\/candle|company-news|news)$/,
    methods: ['GET'],
    query: (q) => {
      if (!process.env.FINNHUB_KEY) return false;
      q.set('token', process.env.FINNHUB_KEY);
      return true;
    }
  },
  etherscan: {
    hosts: { trading: 'https://api.etherscan.io/api' },
    path: /^$/,                       // etherscan takes everything in the query string
    methods: ['GET'],
    query: (q) => {
      if (!process.env.ETHERSCAN_KEY) return false;
      const mod = q.get('module');
      if (['account', 'stats', 'proxy'].indexOf(mod) < 0) return false;
      q.set('apikey', process.env.ETHERSCAN_KEY);
      return true;
    }
  },
  fmp: {
    hosts: { trading: 'https://financialmodelingprep.com/api/v3' },
    path: /^\/(form-thirteen\/[A-Za-z0-9-]+|insider-trading|profile\/[A-Za-z0-9.:-]+|quote\/[A-Za-z0-9.:,-]+)$/,
    methods: ['GET'],
    query: (q) => {
      if (!process.env.FMP_KEY) return false;
      q.set('apikey', process.env.FMP_KEY);
      return true;
    }
  },
  gdelt: {
    hosts: { trading: 'https://api.gdeltproject.org/api/v2/doc/doc' },
    path: /^$/,
    methods: ['GET'],
    query: () => true                 // no key needed
  }
};

// Query keys the browser must never be able to set — they would be a way to smuggle
// credentials in or point the call somewhere else.
const STRIP = ['api_token', 'apikey', 'token', 'apiKey', 'key', 'secret', 'provider', 'path'];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': process.env.LUMEN_ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Cache-Control': 'no-store'
  };
}

exports.handler = async function (event) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, cors());

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const params = event.queryStringParameters || {};
  const provider = String(params.provider || '');
  const path = String(params.path || '');
  const spec = ALLOW[provider];

  if (!spec) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown provider. Allowed: ' + Object.keys(ALLOW).join(', ') }) };
  }
  if (spec.methods.indexOf(event.httpMethod) < 0) {
    return { statusCode: 405, headers, body: JSON.stringify({ error: event.httpMethod + ' not allowed for ' + provider }) };
  }
  if (path.indexOf('..') >= 0 || path.indexOf('//') >= 0 || !spec.path.test(path)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Path not permitted for ' + provider + ': ' + path }) };
  }

  const q = new URLSearchParams();
  Object.keys(params).forEach((k) => {
    if (STRIP.indexOf(k) >= 0) return;
    q.set(k, params[k]);
  });

  const upstreamHeaders = { Accept: 'application/json' };
  let configured = true;
  if (spec.auth) configured = spec.auth(upstreamHeaders);
  if (configured && spec.query) configured = spec.query(q);
  if (!configured) {
    return {
      statusCode: 501, headers,
      body: JSON.stringify({ error: provider + ' is not configured on this deploy. Set its environment variables in Netlify and redeploy.' })
    };
  }

  const hostKey = spec.hostFor ? spec.hostFor(path) : 'trading';
  const base = spec.hosts[hostKey];
  const qs = q.toString();
  const url = base + path + (qs ? (base.indexOf('?') >= 0 ? '&' : '?') + qs : '');

  const init = { method: event.httpMethod, headers: upstreamHeaders };
  if (event.httpMethod === 'POST' && event.body) {
    init.body = event.body;
    upstreamHeaders['Content-Type'] = 'application/json';
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, Object.assign({ signal: controller.signal }, init));
    clearTimeout(timer);
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: Object.assign({}, headers, { 'Content-Type': res.headers.get('content-type') || 'application/json' }),
      body: text
    };
  } catch (e) {
    return {
      statusCode: 502, headers,
      body: JSON.stringify({ error: 'Upstream request failed: ' + (e && e.message ? e.message : String(e)) })
    };
  }
};
