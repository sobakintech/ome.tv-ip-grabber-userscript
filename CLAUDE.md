# OmeTV IP Grabber

## Releasing

Release tags are single incrementing integers: `v1`, `v2`, `v3`, etc. NEVER use semver like `v1.0.0`. The build strips the `v` prefix for the userscript `@version` (`v2` -> `2`); the prefix must be stripped because userscript managers require each version part to start with a digit, and a leading `v` breaks auto-update detection.

To deploy a new version: find the latest `vN` tag, create `v(N+1)` at HEAD, and push it to trigger the release workflow (`.github/workflows/release.yml`).
