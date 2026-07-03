# OmeTV IP Grabber

A userscript that shows you the IP address of the stranger you're matched with on
[ome.tv](https://ome.tv). The IP appears right in the chat, next to the country flag ome.tv already
shows on its "Connection established." line, and you can click it to copy.

No setup and nothing to open: the IP comes from the connection your browser already makes, so there are
no extra lookups or pop-ups.

## Install

**1. Get a userscript manager.** You need one browser extension to run the script:

- **Chrome / Brave:** use **[Tampermonkey](https://www.tampermonkey.net/)**. (Violentmonkey no longer
  runs here since Chrome removed Manifest V2 support in mid-2025.)
- **Edge:** use **[Violentmonkey](https://microsoftedge.microsoft.com/addons/detail/eeagobfjdenkkddmbclomhiblgggliao)**
  or Tampermonkey.
- **Firefox:** use **[Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/)** or
  Tampermonkey.

**2. Install the script.** Open
[ometv-ip-grabber.user.js](https://github.com/sobakintech/ome.tv-ip-grabber-userscript/releases/latest/download/ometv-ip-grabber.user.js)
(latest release). Your userscript manager will show its install page, where you click **Install**.
Updates then arrive automatically.

## Develop (hot reload)

```bash
bun install
bun run dev
```

vite-plugin-monkey serves a dev loader userscript on `http://localhost:3000`. Install that loader once
in Tampermonkey or Violentmonkey (open the URL the dev server prints). After that, editing anything
under `src/` hot-reloads on ome.tv. Just keep the tab open, no reinstalling.

## Build

```bash
bun run build      # outputs dist/ometv-ip-grabber.user.js (+ .meta.js)
```

## Release

CI (`.github/workflows/release.yml`) builds and publishes the userscript as a release asset whenever a
`v*` tag is pushed:

```bash
git tag v1
git push origin v1
```

The release asset feeds `@downloadURL` and `@updateURL`, so installed copies auto-update. Metadata
(name, match, version, URLs) is defined once in `vite.config.js`.

## How it works

**Getting the IP** (`src/sniffer.js`). ome.tv connects you to each stranger over a direct WebRTC peer
connection. During ICE negotiation the remote peer advertises its candidate addresses, and its
*server-reflexive* candidate (`typ srflx`, the address a STUN server observed it arriving from) carries
its real public IP. At `document-start`, before ome.tv captures its own reference, the script replaces
`window.RTCPeerConnection` with a wrapper that hooks each connection's `addIceCandidate` and
`setRemoteDescription` (remote candidates arrive through one or the other). Each candidate is parsed by
its fixed RFC 5245 layout (IP at field 4, type after the `typ` keyword), with an IPv4 regex fallback.
Only public reflexive candidates (`srflx`/`prflx`) are used; `host` candidates are LAN/mDNS and `relay`
is just the TURN server. Every detected IP is also logged to the console.

**Showing it** (`src/ui.js`). Instead of a separate panel, the IP is injected directly into ome.tv's own
"Connection established." chat line, the system message that already carries the peer's country flag and
name (`i.flag.message-flag` next to `span.tr-country`). The IP is placed right after the country name, so
the IP and country are guaranteed to belong to the same peer, since they're the same message. ome.tv
reuses one system bubble and strips that line when the stranger leaves, so the script removes its injected
IP at that same moment and re-injects cleanly for the next match. Nothing is fetched, and there's no
per-IP geolocation call: the country/flag are ome.tv's own.

The sniffer also exposes `window.OmeTVIPGrabber` (`onIP` / `getLast` / `getHistory`) and an `ometv-ip`
event, if you want to build on top of it.

Built with Vite, vite-plugin-monkey (HMR), and Bun. Entry is `src/main.js`. The hook must run before
ome.tv grabs `RTCPeerConnection`, hence `document-start`; if a change ever seems not to take effect,
hard-reload the tab.

## Disclaimer

This userscript is provided as-is, for educational purposes, with no warranty. You use it at your own
risk. Reading a peer's IP from the WebRTC connection your own browser makes is the same information any
STUN/networking tool sees, but what you do with it is your responsibility.
