import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 10080);
const EZVIDAPI = "https://ezvidapi.com";

const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stream Test · Provider 01</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#0b1020;color:#edf2ff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 0,#1d2850 0,transparent 35%),#0b1020}
main{max-width:1050px;margin:auto;padding:28px 18px 60px}.eyebrow{color:#9fb1ff;text-transform:uppercase;letter-spacing:.15em;font-size:12px;font-weight:700}
h1{margin:.45rem 0;font-size:clamp(28px,5vw,44px)}p{color:#aeb9d5;line-height:1.55}.panel{border:1px solid #293352;background:#111a30;border-radius:16px;padding:20px;margin-top:18px}
.fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}label{display:block;font-size:12px;color:#aeb9d5;margin-bottom:7px}input,select,button{font:inherit;border-radius:9px;padding:12px;border:1px solid #344264;background:#0c1427;color:#edf2ff;width:100%}button{background:#6f84ff;color:#071022;font-weight:800;border:0;cursor:pointer}button.secondary{background:#202c4a;color:#dce4ff;border:1px solid #344264}.actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.actions button{width:auto}.status{margin-top:14px;color:#b9c6e5;white-space:pre-wrap;overflow-wrap:anywhere}.results{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.url{font:12px ui-monospace,monospace;overflow-wrap:anywhere;background:#0a1121;padding:12px;border-radius:9px}
iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#050812}.tag{display:inline-block;border:1px solid #344264;border-radius:999px;padding:4px 9px;font-size:12px;color:#c5d0ee}
@media(max-width:700px){.fields,.results{grid-template-columns:1fr 1fr}}@media(max-width:430px){.fields,.results{grid-template-columns:1fr}}
</style>
</head>
<body><main>
<div class="eyebrow">Stream Test Lab · Provider 01</div>
<h1>ezvidapi evaluator</h1>
<p>A standalone test bench for checking whether the provider returns an embed/player or a direct HLS stream. This is separate from Torrent Studio.</p>
<span class="tag">No API key documented</span> <span class="tag">Movies + TV episodes</span>
<section class="panel">
<h2>Test a title</h2>
<div class="fields">
<div><label for="kind">Content type</label><select id="kind"><option value="movie">Movie</option><option value="tv">TV episode</option></select></div>
<div><label for="id">TMDB ID</label><input id="id" value="550" inputmode="numeric" placeholder="e.g. 550"></div>
<div><label for="season">Season (TV)</label><input id="season" value="1" inputmode="numeric"></div>
<div><label for="episode">Episode (TV)</label><input id="episode" value="1" inputmode="numeric"></div>
</div>
<div class="fields" style="margin-top:12px">
<div><label for="provider">HLS provider name</label><input id="provider" value="vidsrc" placeholder="Provider from /list"></div>
<div style="grid-column:span 3"><label for="custom">Optional explicit embed or stream URL</label><input id="custom" placeholder="Paste a URL to test it in the player"></div>
</div>
<div class="actions"><button id="run">Resolve & preview</button><button class="secondary" id="list">Load provider list</button><button class="secondary" id="health">Check API reachability</button></div>
<div id="status" class="status" role="status">Ready. Choose a movie or TV episode and run a test.</div>
</section>
<section class="results">
<div class="panel"><h3>Player preview</h3><iframe id="player" title="Provider playback preview" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe><p>Playback depends on provider availability, browser support, and the legality of the source in your region.</p></div>
<div class="panel"><h3>Resolved response</h3><div id="links" class="url">No request yet.</div><h3>Raw API result</h3><pre id="raw" class="url" style="max-height:340px;overflow:auto;white-space:pre-wrap">—</pre></div>
</section>
<section class="panel"><h3>Test notes</h3><p>This harness tries the documented public endpoints from the browser. CORS policies may block direct requests; if so, the next iteration will proxy the request through this server. A successful HTTP response does not by itself prove that a stream is playable or authorized.</p></section>
</main>
<script>
const $=id=>document.getElementById(id);
const status=(s)=>$('status').textContent=s;
function endpoint(path){return '/api/proxy?url='+encodeURIComponent('https://ezvidapi.com'+path)}
async function call(path){
 status('Requesting '+path+' …'); $('raw').textContent='Loading…'; $('links').textContent='—';
 try{
  const r=await fetch(endpoint(path)); const text=await r.text(); let data;
  try{data=JSON.parse(text)}catch{data=text}
  $('raw').textContent=typeof data==='string'?data:JSON.stringify(data,null,2);
  $('links').textContent='HTTP '+r.status+' · '+r.headers.get('content-type');
  status('Request finished: HTTP '+r.status);
  return {r,data,text};
 }catch(e){status('Request failed: '+e.message+'\nThis may be a CORS/network issue.');$('raw').textContent=String(e);return null}
}
$('run').onclick=async()=>{
 const id=$('id').value.trim(); if(!/^\d+$/.test(id)){status('Enter a numeric TMDB ID.');return}
 const kind=$('kind').value, s=$('season').value.trim(), ep=$('episode').value.trim();
 if(kind==='tv'&&(!/^\d+$/.test(s)||!/^\d+$/.test(ep))){status('Season and episode must be numeric.');return}
 let custom=$('custom').value.trim();
 let embed=kind==='movie'?'/embed/movie/'+id:'/embed/tv/'+id+'/'+s+'/'+ep;
 let resolve=kind==='movie'?'/movie/'+encodeURIComponent($('provider').value.trim()||'vidsrc')+'/'+id:'/tv/'+encodeURIComponent($('provider').value.trim()||'vidsrc')+'/'+id+'?season='+s+'&episode='+ep;
 const chosen=custom||('https://ezvidapi.com'+embed);
 $('player').src=chosen;
 const result=await call(resolve);
 if(result){const data=result.data;const u=typeof data==='string'?data:(data?.url||data?.streamUrl||data?.stream_url||data?.src||data?.m3u8||'');if(u&&typeof u==='string'){$('links').textContent=u;if(!custom&&/^https?:/.test(u))$('player').src=u;}}
};
$('list').onclick=()=>call('/list');
$('health').onclick=async()=>{const r=await call('/list');if(r)status('Reachability check returned HTTP '+r.r.status+'. Check the raw response/provider list above.');};
$('kind').onchange=()=>{const tv=$('kind').value==='tv';$('season').disabled=!tv;$('episode').disabled=!tv};
$('kind').dispatchEvent(new Event('change'));
</script></body></html>`;

function send(res, code, type, body) {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const base = new URL(req.url || "/", `http://localhost:${PORT}`);
  if (base.pathname === "/health") return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ status: "ok", provider: "ezvidapi" }));
  if (base.pathname === "/") return send(res, 200, "text/html; charset=utf-8", html);
  if (base.pathname === "/api/proxy") {
    const target = base.searchParams.get("url");
    let parsed;
    try { parsed = new URL(target); } catch { return send(res, 400, "application/json; charset=utf-8", JSON.stringify({ error: "Provide a valid url parameter" })); }
    if (parsed.origin !== EZVIDAPI) return send(res, 400, "application/json; charset=utf-8", JSON.stringify({ error: "Only ezvidapi.com URLs are permitted" }));
    try {
      const upstream = await fetch(parsed.toString(), { headers: { accept: "application/json,text/plain,*/*" }, signal: AbortSignal.timeout(12000) });
      const body = await upstream.text();
      send(res, upstream.status, upstream.headers.get("content-type") || "text/plain; charset=utf-8", body);
    } catch (e) {
      send(res, 502, "application/json; charset=utf-8", JSON.stringify({ error: "Provider request failed", detail: e instanceof Error ? e.message : String(e) }));
    }
    return;
  }
  send(res, 404, "text/plain; charset=utf-8", "Not found");
});
server.listen(PORT, "0.0.0.0", () => console.log(`Stream Test listening on 0.0.0.0:${PORT}`));
