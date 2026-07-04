// Geo/ISP lookup for a detected IP.
//
// We resolve each srflx IP to a location + network via ipwho.is: it's HTTPS (ome.tv is HTTPS),
// CORS-enabled, and keyless, so a plain `fetch` works with the userscript's `grant: none`. Results
// are cached per IP for the page's lifetime so re-encountering the same stranger (or a repeat
// candidate) doesn't re-hit the API.

const cache = new Map(); // ip -> Promise<info|null>
const ENDPOINT = (ip) => `https://ipwho.is/${encodeURIComponent(ip)}`;

// Normalize ipwho.is's payload into the flat shape the UI renders. Returns null on any failure
// (network error, rate limit, `success:false`) so callers can just fall back to showing the bare IP.
function normalize(d) {
  if (!d || d.success === false) return null;
  const conn = d.connection || {};
  return {
    city: d.city || '',
    region: d.region || '',
    country: d.country || '',
    isp: conn.isp || conn.org || '',
  };
}

export function lookup(ip) {
  if (cache.has(ip)) return cache.get(ip);
  const p = fetch(ENDPOINT(ip), { referrerPolicy: 'no-referrer' })
    .then((r) => (r.ok ? r.json() : null))
    .then(normalize)
    .catch(() => null);
  cache.set(ip, p);
  return p;
}
