# Nuvio Streams add-on (VPS test)

This branch vendors the source files from [tapframe/NuvioStreamsAddon](https://github.com/tapframe/NuvioStreamsAddon) into this repository under `nuvio/`, with a Docker deployment adjusted for an isolated port. The upstream project was archived; third-party providers may stop working at any time.

## Run on the Oracle VPS

```bash
cd ~
git clone --branch provider/nuvio-streams --single-branch https://github.com/wroxtaaar/stream-test.git
cd ~/stream-test/nuvio
cp .env.example .env
nano .env
```

Set `TMDB_API_KEY` to your own TMDB API key. Do not copy cookies or credentials from public repositories. Then build and run:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 nuvio-streams
curl -fsS http://127.0.0.1:17000/health
curl -I http://127.0.0.1:17000/manifest.json
```

Default landing/configuration UI: `http://YOUR_VPS_PUBLIC_IP:17000/`
Manifest: `http://YOUR_VPS_PUBLIC_IP:17000/manifest.json`

The host port is `17000`; the application listens inside the container on `7000`. If the host port is occupied, change the left-hand side of the mapping in `docker-compose.yml`. Open the chosen port in Oracle Cloud / Ubuntu firewall only if you need public access. For a public service, use HTTPS and access control.

## Useful commands

```bash
docker compose ps
docker compose logs --tail=150 -f nuvio-streams
docker inspect --format '{{json .State.Health}}' stream-test-nuvio-streams
docker compose down
```

`.env`, user cookies and API credentials must remain private. This is a streaming add-on, not a media host; a successful health check confirms only that the server is alive, not that providers return playable sources. Test only content you are authorized to access.

## Stream link availability checks

HDHub4u and MoviesDrive check Pixeldrain and Google Drive links using small metadata or byte-range requests; they do not download video content. An `available` result means the host returned a file-like response, not that a player can play it. Generic 403 responses, timeouts, temporary restrictions, and unsupported hosts remain `unknown` and are kept as fallback links. Confirmed Pixeldrain missing-file codes, recognized Google Drive quota errors, explicit access denials, and Google Drive 404 responses are temporarily suppressed; Google Drive 404 can also mean the file is inaccessible to this requester, not necessarily deleted. Availability results are surfaced as optional `linkAvailability` metadata, including `playbackTested: false`.

The checker follows the [Pixeldrain API response reference](https://pixeldrain.com/api) for its stable error `value` field and the [Google Drive API error guide](https://developers.google.com/workspace/drive/api/guides/handle-errors) for HTTP and structured error codes. A live synthetic-ID probe confirmed Pixeldrain's documented `404` / `value: "not_found"` response and that `.dev` and `.net` aliases returned the same error envelope. No known public file ID was available to verify a live Pixeldrain success response, and no real quota-exhausted Drive link was probed; success/quota formats are covered with deterministic fixtures based on the documented fields and reported quota response shape.

The checker uses a five-second timeout and bounded concurrency by default. These settings and the per-status cache durations can be adjusted with `LINK_AVAILABILITY_TIMEOUT_MS`, `LINK_AVAILABILITY_CONCURRENCY` (1–16), `LINK_AVAILABILITY_AVAILABLE_TTL_MS`, `LINK_AVAILABILITY_NOT_FOUND_TTL_MS`, `LINK_AVAILABILITY_QUOTA_TTL_MS`, and `LINK_AVAILABILITY_ACCESS_DENIED_TTL_MS`. Unknown results are never cached. Provider stream results for the checked providers are cached for five minutes so stale cached lists do not mask rechecks.

Run the mocked availability tests from this directory with `npm test`; the tests do not contact external hosts or download media.

## Source provenance

The `nuvio/` application files originate from upstream Nuvio Streams, distributed under the license included in `nuvio/LICENSE`. The committed upstream `cookies.txt` was intentionally not copied.

## Nuvio-only diagnostic tester

The Nuvio service includes a separate tester page at:

```text
http://YOUR_VPS_HOST:17000/nuvio-tester
```

It uses the server-side `TMDB_API_KEY` from `.env` for catalog search and does not ask the browser for that key. The page searches movies or series, accepts season/episode numbers for TV, shows provider status and counts, and groups results by source. An `HTTP(S)` source is classified as playable; a magnet or info-hash is shown as discovered only. A discovery is not playback: the add-on still declares `p2pNotSupported: true`, and no torrent playback engine is part of this deployment.

## Optional Stremio add-ons

Magnetio and AIOStreams are independently disabled by default. To enable either integration, configure its actual Stremio manifest URL in the private `.env` file:

```dotenv
ENABLE_MAGNETIO_ADDON=true
MAGNETIO_MANIFEST_URL=https://your-configured-magnetio-host/manifest.json
ENABLE_AIOSTREAMS_ADDON=true
AIOSTREAMS_MANIFEST_URL=https://your-configured-aiostreams-host/manifest.json
```

Use the real manifest URL supplied by each deployment; do not copy the example hosts literally. If a URL includes a private path or query token, treat it like a credential. The adapter verifies the manifest's `stream` resource, content type, and declared ID prefixes before using the Stremio `/stream/{type}/{id}.json` endpoint. Each upstream has bounded manifest/stream request timeouts and is isolated from the other providers. Configured URLs are not returned to the browser or written to adapter logs; the tester displays only sanitized status summaries such as timeout or HTTP status. The adapter does not import unconfigured upstream add-ons, require debrid, or forward torrent hashes/magnets as playable streams.

The tester route is on the existing Nuvio service and port; it does not add a Docker port or change the root VidSrc tester. The service uses the existing Compose `env_file` mechanism, so these variables belong in `.env`, not in a second configuration source.

Native provider calls remain concurrent and use the existing 45-second per-provider/shared response ceiling; completed provider results are retained when that ceiling is reached. The timeout status shown by the tester is explicit, while an empty native result can remain ambiguous because some existing provider handlers intentionally return an empty list for either no match or an internal failure. Existing failed/empty cache records are treated as misses and retried rather than being permanent empty-result hits.

## Phase B review and deployment commands

From the repository checkout:

```bash
cd ~/stream-test/nuvio-streams-test
npm --prefix nuvio test
git -c core.whitespace=cr-at-eol diff --check
git diff -- README.md nuvio
```

After reviewing and approving the changes, rebuild and recreate only the existing Nuvio service:

```bash
cd ~/stream-test/nuvio-streams-test/nuvio
docker compose config -q
docker compose up -d --build nuvio-streams
docker compose ps nuvio-streams
curl -fsS http://127.0.0.1:17000/health
curl -fsS http://127.0.0.1:17000/nuvio-tester >/dev/null
docker compose logs --tail=100 nuvio-streams
```

The rebuild is needed for changed application source; no other service or host port should be recreated or exposed.
