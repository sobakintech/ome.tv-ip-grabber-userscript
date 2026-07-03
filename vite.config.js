import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

const REPO = 'sobakintech/ome.tv-ip-grabber-userscript';
const FILE = 'ometv-ip-grabber.user.js';
const releaseAsset = `https://github.com/${REPO}/releases/latest/download/${FILE}`;

// Version comes from the release tag (e.g. tag `v2` -> `2`); non-release builds are 0.0.0.
const VERSION = process.env.VERSION || '0.0.0';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'OmeTV IP Grabber',
        version: VERSION,
        namespace: 'sobakintech',
        description:
          "See the IP addresses of strangers on ome.tv.",
        author: 'sobakintech',
        match: ['*://ome.tv/*', '*://*.ome.tv/*'],
        'run-at': 'document-start',
        grant: 'none',
        homepage: `https://github.com/${REPO}`,
        supportURL: `https://github.com/${REPO}/issues`,
        downloadURL: releaseAsset,
        updateURL: releaseAsset,
      },
      build: {
        fileName: FILE,
        // emit <name>.meta.js next to the bundle for lightweight update checks
        metaFileName: true,
      },
    }),
  ],
});
