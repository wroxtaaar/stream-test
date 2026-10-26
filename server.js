import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 10081);
const API_ORIGIN = "https://api.ezvidapi.com";
const EMBED_ORIGIN = "https://ezvidapi.com";

const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stream Test Lab — ezvidapi</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#090d18;color:#eef2ff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 10% 0,#1b2850 0,transparent 42%),#090d18}
main{max-width:1120px;margin:auto;padding:30px 18px 64px}.eyebrow{color:#a8b7ff;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:800}
h1{font-size:clamp(30px,5vw,46px);letter-spacing:-.04em;margin:8px 0}h2,h3{margin-top:0}p{color:#aeb9d2;line-height:1.55}.panel{border:1px solid #283451;background:#11192b;border-radius:16px;padding:20px;margin-top:16px}
.fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}label{display:block;font-size:12px;color:#b7c2dc;margin-bottom:7px}input,select,button{font:inherit;border-radius:9px;padding:12px;border:1px solid #344264;background:#0a1120;color:#eef2ff;width:100%}button{background:#8798ff;color:#080e20;font-weight:800;border:0;cursor:pointer}button:disabled{opacity:.5;cursor:wait}button.secondary{background:#202b45;color:#e2e8ff;border:1px solid #344264}.actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.actions button{width:auto}.status{margin-top:14px;color:#c4d0eb;white-space:pre-wrap;overflow-wrap:anywhere}.tag{display:inline-block;border:1px solid #344264;border-radius:999px;padding:5px 10px;font-size:12px;color:#c5d0ee;margin:4px 5px 4px 0}.layout{display:grid;grid-template-columns:1fr 1fr;gap:16px}.url,pre{font:12px ui-monospace,SFMono-Regular,monospace;overflow-wrap:anywhere;white-space:pre-wrap;background:#090f1c;padding:12px;border-radius:9px;color:#dbe4ff;max-height:360px;overflow:auto}iframe,video{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#050812}a{color:#bdc8ff}.muted{color:#8794b4;font-size:12px}.wide{grid-column:1/-1}
@media(max-width:720px){.fields,.layout{grid-template-columns:1fr 1fr}}@media(max-width:480px){.fields,.layout{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body><main>
<div class="eyebrow">Stream Test Lab / Provider 01</div>
<h1>ezvidapi test bench</h1>
<p>Test the provider’s documented TMDB-ID workflow independently from Torrent Studio. Compare its embed player with a resolved HLS URL, inspect the response, and record real availability.</p>
<div><span class="tag">No API key documented</span><span class="tag">Movies + TV episodes</span><span class="tag">Server-side requests</span></div>
<section class="panel">
<h2>1. Select a title</h2>
<div class="fields">
<div><label for="kind">Content type</label><select id="kind"><option value="movie">Movie</option><option value="tv">TV episode</option></select></div>
<div><label for="id">TMDB ID</label><input id="id" value="550" inputmode="numeric" placeholder="e.g. 550"></div>
<div><label for="season">Season</label><input id="season" value="1" inputmode="numeric"></div>
<div><label for="episode">Episode</label><input id="episode" value="1" inputmode="numeric"></div>
<div><label for="provider">HLS provider</label><select id="provider"><option value="vidsrc">vidsrc</option></select></div>
<div class="wide"><label for="custom">Optional embed URL override</label><input id="custom" placeholder="Leave blank to use the official documented embed pattern"></div>
</div>
<div class="actions"><button id="resolve">Resolve HLS URL</button><button id="loadEmbed" class="secondary">Load embed player</button><button id="loadList" class="secondary">Refresh provider list</button></div>
<div id="status" class="status" role="status">Ready. Test a title ID you are authorized to access.</div>
</section>
<div class="layout">
<section class="panel"><h2>2. Embed player</h2><iframe id="embed" title="ezvidapi embed preview" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe><p class="muted">The embed is hosted by ezvidapi. Availability and player behavior are controlled by the provider.</p><div id="embedUrl" class="url">No embed loaded.</div></section>
<section class="panel"><h2>3. Direct HLS preview</h2><video id="video" controls playsinline></video><p class="muted">HLS playback is browser-dependent. Safari may play HLS natively; other browsers generally need hls.js.</p><div id="streamUrl" class="url">No stream resolved.</div></section>
<section class="panel"><h2>Provider list response</h2><pre id="providers">Select “Refresh provider list” to query the API.</pre></section>
<section class="panel"><h2>Last resolve response</h2><pre id="raw">No resolve request yet.</pre></section>
</div>
<section class="panel"><h3>Test notes</h3><p>HTTP success does not guarantee that a stream exists or is playable. Hosted upstreams can change or become unavailable. Use only content you are authorized to access. This app is a test harness, not a content catalog.</p></section>
</main>
<script>
const $=id=>document.getElementById(id);
let hls=null;
const status=s=>$('status').textContent=s;
const json=(value)=>JSON.stringify(value,null,2);
function stopVideo(){if(hls){hls.destroy();hls=null}$('video').pause();$('video').removeAttribute('src');$('video').load()}
function setEmbed(){
 const id=$('id').value.trim(),kind=$('kind').value,s=$('season').value.trim(),ep=$('episode').value.trim();
 if(!/^\d+$/.test(id)){status('Enter a numeric TMDB ID.');return}
 if(kind==='tv'&&(!/^\d+$/.test(s)||! /^\d+$/.test(ep))){status('Season and episode must be numeric.');return}
 const custom=$('custom').value.trim();
 const src=custom||(kind==='movie'?'https://ezvidapi.com/embed/movie/'+id:'https://ezvidapi.com/embed/tv/'+id+'/'+s+'/'+ep+'?provider='+encodeURIComponent($('provider').value));
 $('embed').src=src;$('embedUrl').textContent=src;status('Embed loaded. It may take a moment for the upstream player to initialize.');
}
$('loadEmbed').onclick=setEmbed;
$('resolve').onclick=async()=>{
 const id=$('id').value.trim(),kind=$('kind').value,s=$('season').value.trim(),ep=$('episode').value.trim(),provider=$('provider').value;
 if(!/^\d+$/.test(id)){status('Enter a numeric TMDB ID.');return}
 if(kind==='tv'&&(!/^\d+$/.test(s)||! /^\d+$/.test(ep))){status('Season and episode must be numeric.');return}
 const b=$('resolve');b.disabled=true;status('Requesting HLS stream from ezvidapi…');$('raw').textContent='Loading…';$('streamUrl').textContent='Resolving…';stopVideo();
 try{
  const q=new URLSearchParams({kind,id,provider});if(kind==='tv'){q.set('season',s);q.set('episode',ep)}
  const r=await fetch('/api/resolve?'+q);const data=await r.json();$('raw').textContent=json({httpStatus:r.status,data});
  if(!r.ok)throw new Error(data.error||('HTTP '+r.status));
  const u=data.stream_url||data.streamUrl||data.url||data.src||data.m3u8||'';
  if(typeof u!=='string'||!/^https?:\/\//i.test(u)){$('streamUrl').textContent='No recognized direct URL field. Inspect the raw response; provider may return a different shape.';status('API responded, but no known direct URL field was found.');return}
  $('streamUrl').textContent=u;
  const v=$('video');
  if(v.canPlayType('application/vnd.apple.mpegurl')){v.src=u}
  else if(window.Hls&&Hls.isSupported()){hls=new Hls();hls.loadSource(u);hls.attachMedia(v);hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)status('HLS player reported a fatal playback error: '+d.details)})}
  else {status('Stream URL resolved, but this browser does not support HLS playback. Copy the URL to a compatible player.');return}
  status('Stream URL resolved. Press play to test playback; a URL alone does not guarantee that the upstream will serve media.');
 }catch(e){status('Resolve failed: '+e.message);$('streamUrl').textContent='Resolve failed.'}
 finally{b.disabled=false}
};
$('loadList').onclick=async()=>{
 status('Loading provider list…');$('providers').textContent='Loading…';
 try{const r=await fetch('/api/list');const data=await r.json();$('providers').textContent=json({httpStatus:r.status,data});if(!r.ok)throw new Error(data.error||('HTTP '+r.status));
 const items=Array.isArray(data)?data:(data.providers||data.results||data.data||[]);
 if(items.length){const sel=$('provider'),current=sel.value;sel.replaceChildren(...items.map(item=>{const name=typeof item==='string'?item:(item.id||item.name||item.provider);const opt=document.createElement('option');opt.value=name;opt.textContent=name;return opt}));if([...sel.options].some(o=>o.value===current))sel.value=current}
 status('Provider-list request completed: HTTP '+r.status+'. Check the response to confirm its schema.');
 }catch(e){status('Provider-list request failed: '+e.message)}
};
$('kind').onchange=()=>{const tv=$('kind').value==='tv';$('season').disabled=!tv;$('episode').disabled=!tv};
$('kind').dispatchEvent(new Event('change'));
</script></body></html>`;

function send(res, code, type, body) {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(body);
}
async function requestProvider(path) {
  const upstream = await fetch(new URL(path, API_ORIGIN), {
    headers: { accept: "application/json,text/plain,*/*" },
    signal: AbortSignal.timeout(15000)
  });
  const body = await upstream.text();
  return { status: upstream.status, contentType: upstream.headers.get("content-type") || "text/plain; charset=utf-8", body };
}
const server = http.createServer(async (req, res) => {
  const base = new URL(req.url || "/", `http://localhost:${PORT}`);
  if (base.pathname === "/health") return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ status: "ok", provider: "ezvidapi", apiOrigin: API_ORIGIN }));
  if (base.pathname === "/") return send(res, 200, "text/html; charset=utf-8", html);
  if (base.pathname === "/api/list" || base.pathname === "/api/resolve") {
    let path;
    if (base.pathname === "/api/list") {
      path = "/list";
    } else {
      const kind = base.searchParams.get("kind");
      const id = base.searchParams.get("id");
      const provider = base.searchParams.get("provider") || "vidsrc";
      if (!["movie", "tv"].includes(kind) || !id || !/^\d+$/.test(id) || !/^[a-zA-Z0-9_-]{1,40}$/.test(provider)) {
        return send(res, 400, "application/json; charset=utf-8", JSON.stringify({ error: "Valid kind, numeric TMDB id, and provider are required." }));
      }
      if (kind === "movie") path = `/movie/${encodeURIComponent(provider)}/${id}`;
      else {
        const season = base.searchParams.get("season");
        const episode = base.searchParams.get("episode");
        if (!season || !episode || !/^\d+$/.test(season) || !/^\d+$/.test(episode)) {
          return send(res, 400, "application/json; charset=utf-8", JSON.stringify({ error: "TV requests require numeric season and episode values." }));
        }
        path = `/tv/${encodeURIComponent(provider)}/${id}?season=${season}&episode=${episode}`;
      }
    }
    try {
      const result = await requestProvider(path);
      res.writeHead(result.status, { "content-type": result.contentType, "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(result.body);
    } catch (e) {
      send(res, 502, "application/json; charset=utf-8", JSON.stringify({ error: "ezvidapi request failed", detail: e instanceof Error ? e.message : String(e), attemptedPath: path }));
    }
    return;
  }
  send(res, 404, "text/plain; charset=utf-8", "Not found");
});
server.listen(PORT, "0.0.0.0", () => console.log(`Stream Test listening on 0.0.0.0:${PORT}`));
