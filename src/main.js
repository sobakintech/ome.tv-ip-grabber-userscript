// OmeTV IP Grabber: entry point.
//
// ome.tv connects you to a stranger over a direct WebRTC peer connection. During the ICE handshake the
// remote peer advertises its candidates, and its server-reflexive (`srflx`) candidate carries its real
// public IP. We wrap `window.RTCPeerConnection` before ome.tv captures it (hence @run-at document-start)
// and read that IP out of the incoming candidates. This file only wires up the sniffer; the extraction
// logic lives in sniffer.js. A UI layer is added separately and just listens for the events emitted here.

import { installSniffer } from './sniffer.js';
import { installUI } from './ui.js';

installSniffer();
installUI();
