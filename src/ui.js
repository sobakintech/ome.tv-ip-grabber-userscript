// Show the connected peer's IP by injecting it straight into ome.tv's own "Connection established."
// chat line, with no separate UI.
//
// That system line is uniquely built from `i.flag.message-flag` (the peer's country flag) next to
// `span.tr-country` (the country name); regular chat messages have neither. Because the line already
// *is* the peer's country, appending the IP right after the country name pairs IP and country
// perfectly, so the whole class of "which IP goes with which flag" timing bugs disappears.
//
// The srflx IP comes from the sniffer (window.OmeTVIPGrabber). The IP is detected during ICE, a beat
// before ome.tv renders this line, so it's normally ready when the line appears; we also handle the
// reverse order by remembering the line until the IP arrives.
//
// Right after the IP we show a "City, Region, Country · ISP" summary resolved from geo.js, so the
// whole picture sits inline in the connect line with nothing to hover or open.

import { lookup } from './geo.js';

const STYLE_ID = 'ometv-ip-style';
const INJECT = 'ometv-ip-inject';
const SEP = 'ometv-ip-sep';
const SUMMARY = 'ometv-ip-summary';
const ACCENT = '#f8834f'; // ome.tv orange

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    .${INJECT}{font-family:ui-monospace,Consolas,monospace;font-weight:700;color:${ACCENT};cursor:pointer;}
    .${INJECT}:hover{text-decoration:underline;}
    .${SEP}{margin:0 6px;opacity:.4;}
    .${SUMMARY}{font-size:.85em;opacity:.7;margin-left:6px;}
    .${SUMMARY}::before{content:"·";margin-right:6px;opacity:.5;}
  `;
  document.head.appendChild(s);
}

let readyIP = null; // an IP detected but not yet placed in a line
let pendingLine = null; // a country line rendered but still waiting for its IP

function place(container, ip) {
  if (!container || container.__ometvIp) return;
  container.__ometvIp = ip;

  // A neutral separator dot, kept outside the IP span so it isn't orange and doesn't underline/copy
  // when you hover the IP.
  const sep = document.createElement('span');
  sep.className = SEP;
  sep.textContent = '·';

  const span = document.createElement('span');
  span.className = INJECT;
  span.textContent = ip;
  span.title = 'Click to copy IP';
  span.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(ip);
    } catch (_) {}
    const t = span.textContent;
    span.textContent = 'copied!';
    setTimeout(() => (span.textContent = t), 700);
  });

  const summary = document.createElement('span');
  summary.className = SUMMARY;

  const frag = document.createDocumentFragment();
  frag.append(sep, span, summary);

  const country = container.querySelector('.tr-country');
  if (country) country.after(frag);
  else container.appendChild(frag);

  // Resolve geo asynchronously; the bare IP is already visible, so this only enriches it.
  lookup(ip).then((data) => {
    if (!data) return;
    const location = [data.city, data.region, data.country].filter(Boolean).join(', ');
    summary.textContent = [location, data.isp].filter(Boolean).join(' · ');
  });
}

// A country line just rendered (we trigger on the country-name span, so the flag sibling is already
// present). Inject now if we have the IP, otherwise remember the line for the next IP.
function onCountryLine(countryEl) {
  const container = countryEl.parentElement;
  if (!container || container.__ometvIp) return;
  if (!container.querySelector('.flag, .message-flag')) return; // confirm it's the connect line
  if (readyIP) {
    place(container, readyIP);
    readyIP = null;
    pendingLine = null;
  } else {
    pendingLine = container;
  }
}

function onIP(ip) {
  if (pendingLine && !pendingLine.__ometvIp) {
    place(pendingLine, ip);
    pendingLine = null;
    readyIP = null;
  } else {
    readyIP = ip;
  }
}

// ome.tv reuses one persistent system bubble: on match it appends the flag + country into it, and on
// disconnect it removes them again. Our injected nodes aren't ome.tv's, so they'd linger between
// strangers, so we drop them the moment the bubble no longer has a `.tr-country`, and reset the bubble
// so the next match re-injects cleanly.
function cleanup() {
  for (const span of document.querySelectorAll('.' + INJECT)) {
    const bubble = span.closest('.message-bubble');
    if (!bubble || !bubble.querySelector('.tr-country')) {
      if (bubble) {
        delete bubble.__ometvIp;
        bubble.querySelectorAll('.' + SEP + ', .' + SUMMARY).forEach((el) => el.remove());
      }
      span.remove();
    }
  }
  if (pendingLine && !pendingLine.querySelector('.tr-country')) pendingLine = null;
}

function watch() {
  injectStyle();
  const SEL = '.tr-country';
  const attach = () => {
    const log = document.querySelector('.chat__messages');
    if (!log || log.__ometvWatch) return;
    log.__ometvWatch = true;
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches(SEL)) onCountryLine(n);
          if (n.querySelectorAll) n.querySelectorAll(SEL).forEach(onCountryLine);
        }
      }
      cleanup(); // ome.tv cleared the connect line (between strangers) -> drop our leftover IP
    }).observe(log, { childList: true, subtree: true });
    log.querySelectorAll(SEL).forEach(onCountryLine); // catch one already present
  };
  attach();
  setInterval(attach, 1000); // re-attach if ome.tv rebuilds the message log
}

export function installUI() {
  const api = window.OmeTVIPGrabber;
  if (api) api.onIP((h) => onIP(h.ip));
  else window.addEventListener('ometv-ip', (e) => onIP(e.detail.ip));
  watch();
}
