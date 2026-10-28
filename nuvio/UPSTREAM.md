# Upstream source and local integration notes

Upstream project: https://github.com/tapframe/NuvioStreamsAddon

The `nuvio/` directory contains the Nuvio application source and local deployment files. The app is based on the upstream add-on and includes this repository's provider fixes and deployment-specific changes. Do not replace it wholesale from upstream: preserve local fixes, deployment settings, user data, and secrets.

## Optional Stremio add-ons

`utils/stremioAddonAdapter.js` queries configured add-ons using the Stremio protocol: it fetches the configured `/manifest.json`, verifies the `stream` resource, content type, and supported ID prefix, then requests `/stream/{type}/{id}.json`. It does not import an add-on's own upstream add-ons or invent alternate endpoints.

Magnetio and AIOStreams are independently opt-in through `ENABLE_MAGNETIO_ADDON` / `MAGNETIO_MANIFEST_URL` and `ENABLE_AIOSTREAMS_ADDON` / `AIOSTREAMS_MANIFEST_URL`. Keep manifest URLs private if their path or query includes credentials. They are not included in browser responses or application logs. An HTTP(S) result may be forwarded as a playable stream; a magnet or info-hash is displayed only as a discovery result and is never forwarded as an HTTP stream. No debrid service is required or configured by this adapter.

The add-on manifest continues to declare `p2pNotSupported: true`; no torrent playback engine is included. Webtor, WebTorrent, and TorrServer are not integrated by this phase.

The Nuvio-specific diagnostic UI is served at `/nuvio-tester` by the existing Nuvio service. Its catalog search uses the server-side `TMDB_API_KEY`; the key is not sent to the browser. Provider diagnostics distinguish a positive result from no-results/provider-error ambiguity where the native provider implementations do not expose separate failure states.

## Local changes and safe deployment

Retain the existing `docker-compose.yml`, port mapping, `.env`, and `data/` content. New optional integration variables are described in `.env.example`; do not commit real manifest URLs, cookies, or API keys. Review changes and run `npm test` from `nuvio/` before deployment. Deployment, if approved, should recreate only the existing `nuvio-streams` Compose service; do not add a public port for the tester.
