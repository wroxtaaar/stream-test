# Stream Provider Lab

This branch is an isolated evaluation area for the stream sources requested for Torrent Studio. It does not change `main`.

## Candidates verified

| Candidate | Project | What to test | Notes |
|---|---|---|---|
| VidSrc | [cool-dev-guy/vidsrc.ts](https://github.com/cool-dev-guy/vidsrc.ts) | Availability, identifier input, response shape, and playback compatibility | The repository describes itself as a proof of concept; its README shows a TMDB ID input. |
| Nuvio Streams | [tapframe/NuvioStreamsAddon](https://github.com/tapframe/NuvioStreamsAddon) | Stremio manifest/stream endpoint, latency, returned stream metadata | Direct HTTP Stremio addon; upstream repository is archived. |
| AIOStreams | [Viren070/AIOStreams](https://github.com/Viren070/AIOStreams) | Addon configuration, stream aggregation, output normalization | Aggregator for configured Stremio addons; not itself a torrent indexer. |
| CinePro Core | [cinepro-org/core](https://github.com/cinepro-org/core) | API health, title resolution, response schema, startup footprint | Requires a TMDB API key for media lookup. Its upstream README warns that public hosting is insecure by default and recommends local/personal use. |
| VidCore Stream Resolver | [dineshkumarshukla658-bot/vidcore-io-stream-resolver](https://github.com/dineshkumarshukla658-bot/vidcore-io-stream-resolver) | Resolve API, health/startup, HLS manifest access and referer requirements | Local Node/TypeScript app; upstream README describes a proxying HLS player. |

## Test policy

- Test one candidate at a time and use separate ports. Do not stop or replace the existing RapidBay service.
- Do not put API keys, cookies, passwords, or provider tokens in Git.
- Do not persist short-lived resolved media URLs as durable cache entries.
- Use only content you are authorized to access.
- Record: build/start result, health endpoint, query/resolve latency, result count, response shape, playback result, CPU/RAM, and any external dependency failures.
- A successful HTTP response is not proof of playable media; playback must be tested separately.
- Upstream projects can change or disappear. Pin commits/tags before using any in a durable integration.

## Suggested test order

1. **CinePro Core** — clear API boundary and documented Docker support; configure `TMDB_API_KEY` privately.
2. **VidCore** — evaluate its API and HLS proxy separately from the current app.
3. **Nuvio Streams** — verify its Stremio manifest and stream response.
4. **AIOStreams** — configure one known-good addon first, then test aggregation.
5. **VidSrc** — test its documented module/API behavior independently; do not assume the old `vidsrc-api` repository is current (its README says it was abandoned/moved).

## Current state

The branch is a test-lab baseline. None of these providers has been wired into RapidBay's production search/playback paths yet. Keep integration behind a separate adapter until its tests pass.
