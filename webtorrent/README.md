# WebTorrent Lab

Standalone WebTorrent manual-testing UI and API. It is isolated from the
repository's main Stream Test service: use this directory's Compose file and
the `webtorrent-lab` Compose project name. The host binding is localhost-only
on port `18080`; the container listens on port `3000`.

## Run

```bash
cd webtorrent
mkdir -p data
chmod 700 data
HOST_UID="$(id -u)" HOST_GID="$(id -g)" \
  docker compose -p webtorrent-lab -f compose.yaml up -d --build
```

Open `http://127.0.0.1:18080/`. In VS Code Remote SSH, forward port `18080` to
open the page in a local browser. Check the health endpoint at
`http://127.0.0.1:18080/health`.

## Try the documented Sintel test torrent

The WebTorrent project uses Sintel as its free, Creative Commons test movie.
Paste this magnet into the UI, or submit it with curl:

```bash
curl -sS -X POST http://127.0.0.1:18080/torrents \
  -H 'content-type: application/json' \
  -d '{"magnet":"magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10"}'
```

The UI shows torrent state, progress, peers, transfer rates, and files. Open
details for file URLs, copy/open/download actions, or the HTML5 player for
likely video files. HTTP byte ranges are supported for seeking. Playback
depends on browser and codec support and is not guaranteed. Title-based torrent
search is not configured; no results are fabricated. Only submit content you
are authorized to access.

The API also accepts a 40-character hexadecimal BitTorrent info hash. It
allows up to three active torrents, times out metadata discovery after
90 seconds, and rejects torrents larger than 2 GiB. Downloaded data is kept
in the ignored `data/` directory. Removing an active torrent preserves its
downloaded data.

## Networking and limits

The container uses DHT, TCP peer connections, and two fixed WebSocket trackers
from the upstream WebTorrent Sintel example. It does not publish BitTorrent
peer ports, uses no uTP, and ignores tracker or web-seed URLs from submitted
magnets. Peer availability and network policy can limit discovery and speed.
The Compose service is limited to 1 CPU, 768 MiB RAM, 128 processes, 16 peer
connections, 2 MiB/s download, and 64 KiB/s upload. A non-fatal `utp-native`
warning may appear because uTP is disabled.

## Logs and stop

```bash
docker compose -p webtorrent-lab -f compose.yaml logs -f
docker compose -p webtorrent-lab -f compose.yaml down
```

Press Ctrl+C to stop following logs before running `down`. This stops only the
WebTorrent Lab Compose service and leaves `data/` intact. Do not use
volume-prune commands.
