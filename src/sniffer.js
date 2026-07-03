// WebRTC IP sniffer for ome.tv.
//
// ome.tv pairs you with a stranger over a direct browser-to-browser WebRTC connection. To find a path
// between the two peers, each side runs ICE: it gathers candidate transport addresses and sends them to
// the other side. The candidate we care about is the remote peer's *server-reflexive* one (`typ srflx`),
// the address a STUN server saw the peer arrive from, i.e. its real public IP. Those remote candidates
// reach us either trickled in through `RTCPeerConnection.addIceCandidate`, or baked into the SDP passed
// to `setRemoteDescription`. We hook both.
//
// An ICE candidate line is space-delimited and fixed-layout (RFC 5245):
//
//   candidate:<foundation> <component> <proto> <priority> <IP> <port> typ <cand-type> raddr <..> ...
//   index:     0            1           2       3          4    5      6   7          ...
//
// so the IP is field[4] and the type follows the `typ` keyword. We parse it structurally and fall back
// to an IPv4 regex if a browser ever reorders things. Only `srflx`/`prflx` (public reflexive) candidates
// are reported; `host` candidates are LAN IPs or mDNS `.local` placeholders and `relay` is just the TURN
// server, neither of which is the stranger's real address.
//
// This module is logic-only: every detected IP is pushed to subscribers and dispatched as a
// `ometv-ip` CustomEvent on `window`, so a separate UI layer can render it without touching this code.

const DEBUG = false;
const log = (...a) => DEBUG && console.log('[OmeTV IP]', ...a);

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;
const IPV4_G = /(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)/g;

// The reflexive candidate types that expose the peer's public address.
const PUBLIC_TYPES = new Set(['srflx', 'prflx']);

function isPrivateIP(ip) {
  const p = ip.split('.').map(Number);
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
  );
}

// Pull { ip, type } out of a single candidate line, or null if it isn't a usable public candidate.
function parseCandidate(line) {
  if (typeof line !== 'string' || line.indexOf('candidate:') === -1) return null;

  const fields = line.split(' ');
  const typIdx = fields.indexOf('typ');
  const type = typIdx !== -1 ? fields[typIdx + 1] : null;
  if (!type || !PUBLIC_TYPES.has(type)) return null;

  let ip = fields[4];
  if (!IPV4.test(ip || '')) {
    const m = line.match(IPV4_G);
    ip = m ? m[0] : null;
  }
  if (!ip || isPrivateIP(ip)) return null;

  return { ip, type };
}

// --- subscriber plumbing (what the UI layer hooks into) ---------------------------------------------

const subscribers = new Set();
const history = [];

function emit(hit) {
  history.push(hit);
  console.log(`[OmeTV IP] ${hit.ip} (${hit.type})`);
  for (const cb of subscribers) {
    try {
      cb(hit);
    } catch (e) {}
  }
  try {
    window.dispatchEvent(new CustomEvent('ometv-ip', { detail: hit }));
  } catch (e) {}
}

// Scan any candidate string; dedupe per peer connection so one stranger's repeats don't spam.
function inspect(line, seen) {
  const parsed = parseCandidate(line);
  if (!parsed || seen.has(parsed.ip)) return;
  seen.add(parsed.ip);
  emit({ ...parsed, at: Date.now() });
}

// Wrap a single RTCPeerConnection instance so we see the remote peer's candidates.
function hookConnection(pc) {
  const seen = new Set();

  const realAddIce = pc.addIceCandidate.bind(pc);
  pc.addIceCandidate = function (candidate, ...rest) {
    try {
      const line = typeof candidate === 'string' ? candidate : candidate && candidate.candidate;
      if (line) inspect(line, seen);
    } catch (e) {}
    return realAddIce(candidate, ...rest);
  };

  const realSetRemote = pc.setRemoteDescription.bind(pc);
  pc.setRemoteDescription = function (desc, ...rest) {
    try {
      const sdp = (desc && desc.sdp) || '';
      for (const l of sdp.split(/\r?\n/)) {
        if (l.startsWith('a=candidate:')) inspect(l.slice(2), seen);
      }
    } catch (e) {}
    return realSetRemote(desc, ...rest);
  };

  return pc;
}

export function installSniffer() {
  const Original = window.RTCPeerConnection || window.webkitRTCPeerConnection;
  if (!Original) {
    log('no RTCPeerConnection in this environment');
    return;
  }

  // Replace the global constructor so every connection ome.tv opens is hooked. Doing this at
  // document-start means we win before ome.tv captures its own reference.
  function Patched(...args) {
    const pc = new Original(...args);
    return hookConnection(pc);
  }
  Patched.prototype = Original.prototype;

  try {
    window.RTCPeerConnection = Patched;
    if ('webkitRTCPeerConnection' in window) window.webkitRTCPeerConnection = Patched;
    log('RTCPeerConnection hook installed at document-start');
  } catch (e) {
    log('failed to install hook', e);
  }

  // Public API for the (separate) UI layer.
  window.OmeTVIPGrabber = {
    onIP(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    getLast: () => history[history.length - 1] || null,
    getHistory: () => history.slice(),
  };
}
