# WebTorrent standalone test

This branch is dedicated to the isolated WebTorrent manual demo tested separately from the rest of stream-test.

The working demo currently lives at `/home/ubuntu/stream-evaluations/webtorrent-manual-demo` on the VPS. It uses Node.js and WebTorrent, exposes a local web API on container port 3000 and host port 18080 bound to localhost, and has been verified with the public-domain Sintel test torrent:

`magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10`

Confirmed so far:
- Torrent metadata resolved.
- Peers connected and the torrent downloaded successfully.
- Health endpoint returned `{"status":"ok","engine":"webtorrent","activeTorrents":1}`.
- File endpoint for `Sintel.mp4` returned HTTP 200.
- HTTP Range request returned 206 Partial Content for `bytes=0-1023`.

The current WebTorrent demo may not be committed in this repository yet. Preserve the tested implementation and include its complete source and Docker Compose setup on this branch, rather than only documenting it. Its UI should let the user paste a magnet, inspect active torrent status/progress/peers/files, and open selected media in an HTML5 video player using the existing HTTP file endpoint. Title-based torrent search is not configured yet; do not fabricate search results.

Keep it isolated:
- Do not edit main.
- Do not modify Torrent Studio or Nuvio Streams.
- Keep host port 18080 localhost-only and container port 3000.
- Do not commit secrets, credentials, downloaded torrent data, or node_modules.
- Preserve the currently working torrent engine and range-serving behavior.

When updating this branch, inspect repository files first, then add the WebTorrent implementation under a dedicated directory (for example `webtorrent/`) so the existing Stream Test app on main remains untouched. Include a README with run instructions and the verified Sintel test magnet.