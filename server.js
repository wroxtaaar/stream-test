import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const html = String.raw\`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stream Test Lab — Search & Play</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#090d18;color:#eef2ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 10% 0,#1b2850 0,transparent 42%),#090d18}main{max-width:1050px;margin:auto;padding:28px 18px 60px}h1{font-size:clamp(30px,5vw,46px);margin:8px 0}p{color:#aeb9d2;line-height:1.55}.panel{border:1px solid #283451;background:#11192b;border-radius:16px;padding:20px;margin-top:16px}.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}label{display:block;font-size:12px;color:#b7c2dc;margin-bottom:7px}input,select,button{font:inherit;border-radius:9px;padding:12px;border:1px solid #344264;background:#0a1120;color:#eef2ff;width:100%}button{background:#8798ff;color:#080e20;font-weight:800;border:0;cursor:pointer}.secondary{background:#202b45;color:#e2e8ff;border:1px solid #344264}.actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.actions button{width:auto}.status{margin-top:12px;overflow-wrap:anywhere;color:#c4d0eb}.result{border:1px solid #344264;border-radius:10px;padding:14px;margin-top:10px;background:#0a1120}.muted{font-size:12px;color:#aeb9d2}.tag{display:inline-block;border:1px solid #344264;border-radius:999px;padding:5px 10px;font-size:12px;color:#c5d0ee;margin:4px 5px 4px 0}.notice{border-left:3px solid #8798ff;padding:10px 12px;background:#0a1120;border-radius:7px}@media(max-width:720px){.fields{grid-template-columns:1fr 1fr}}@media(max-width:480px){.fields{grid-template-columns:1fr}}
</style></head><body><main>
<div style="color:#a8b7ff;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:800">Stream Test Lab</div>
<h1>Search & Play</h1><p>Search by title or IMDb ID, choose a movie or episode, then test the available source. No add-on URL needs to be pasted into this page.</p>
<div><span class="tag">Title search</span><span class="tag">IMDb IDs</span><span class="tag">Movies + TV</span></div>
<section class="panel"><h2>1. Find a title</h2><div class="fields">
<div><label for="kind">Content type</label><select id="kind"><option value="movie">Movie</option><option value="series">TV series</option></select></div>
<div><label for="query">Title or IMDb ID</label><input id="query" placeholder="e.g. Avengers: Endgame or tt4154796"></div>
<div><label>&nbsp;</label><button id="search">Search</button></div>
</div><div id="searchStatus" class="status">Enter a title or IMDb ID to begin.</div><div id="results"></div></section>
<section class="panel"><h2>2. Playback source</h2><div class="notice"><strong>Why no Play button yet?</strong><p style="margin-bottom:0">A title/IMDb ID identifies the movie, but it does not contain a video. Playback requires a source that returns a playable stream. There is no universal API that provides streams for every title. This tester will only show playable results when a compatible source is available; it won't invent a stream URL.</p></div>
<div class="fields" style="margin-top:14px">
<div><label for="id">Selected IMDb ID</label><input id="id" placeholder="Select a title above"></div>
<div><label for="season">Season (TV)</label><input id="season" type="number" min="1" value="1"></div>
<div><label for="episode">Episode (TV)</label><input id="episode" type="number" min="1" value="1"></div>
</div>
<div class="actions"><button id="check">Check playback sources</button><button id="clear" class="secondary">Clear</button></div>
<div id="sourceStatus" class="status">Select a title, then check for sources.</div><div id="sources"></div></section>
<section class="panel"><h3>What's currently configured</h3><p>This branch includes title search and the Stremio stream protocol tester. It does not yet include a verified, built-in playback provider. A source must be connected before the page can play arbitrary movies or series.</p></section>
</main><script>
const $=id=>document.getElementById(id);let selectedType="movie";
function msg(id,text){$(id).textContent=text;}
async function search(){const q=$("query").value.trim();if(!q){msg("searchStatus","Enter a title or IMDb ID.");return;}selectedType=$("kind").value;msg("searchStatus","Searching titles…");$("results").replaceChildren();if(/^tt\\d{7,}$/.test(q)){$("id").value=q;const d=document.createElement("div");d.className="result";d.textContent="IMDb ID selected: "+q;const b=document.createElement("button");b.textContent="Use this ID";b.style.marginTop="10px";b.addEventListener("click",()=>{msg("searchStatus","IMDb ID ready. Now check playback sources.");msg("sourceStatus","Ready to check "+q);});d.append(b);$("results").append(d);return;}try{const r=await fetch("/api/search?q="+encodeURIComponent(q)+"&type="+encodeURIComponent(selectedType));const data=await r.json();if(!r.ok)throw Error(data.error||"Search failed");if(!data.results.length){msg("searchStatus","No results. Try another title or enter an IMDb ID.");return;}msg("searchStatus","Choose a title to use its IMDb ID.");for(const item of data.results){const d=document.createElement("div");d.className="result";const title=document.createElement("strong");title.textContent=item.name;const meta=document.createElement("p");meta.className="muted";meta.textContent=[item.year,item.id].filter(Boolean).join(" · ");const b=document.createElement("button");b.textContent="Select title";b.addEventListener("click",()=>{$("id").value=item.id;msg("sourceStatus","Selected "+item.name+" ("+item.id+").");});d.append(title,meta,b);$("results").append(d);}}catch(e){msg("searchStatus","Search failed: "+e.message);}}
$("search").addEventListener("click",search);$("query").addEventListener("keydown",e=>{if(e.key==="Enter")search();});$("check").addEventListener("click",()=>{const id=$("id").value.trim();if(!/^tt\\d{7,}$/.test(id)){msg("sourceStatus","Search and select a title first, or enter a valid IMDb ID.");return;}msg("sourceStatus","No built-in playback providers are connected in this branch yet. The IMDb ID is ready, but a compatible stream source must be configured before playback can work.");$("sources").replaceChildren();const d=document.createElement("div");d.className="result";d.textContent="No source configured — no playable URL can be returned for "+id+"."; $("sources").append(d);});$("clear").addEventListener("click",()=>{$("id").value="";$("results").replaceChildren();$("sources").replaceChildren();msg("searchStatus","Enter a title or IMDb ID to begin.");msg("sourceStatus","Cleared.");});
</script></body></html>\`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/api/search") {
    const q = (url.searchParams.get("q") || "").trim();
    const type = url.searchParams.get("type") === "series" ? "series" : "movie";
    if (!q) { res.writeHead(400, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ error: "Missing search query" })); return; }
    try {
      const upstream = await fetch("https://v3-cinemeta.strem.io/catalog/" + type + "/top/search=" + encodeURIComponent(q) + ".json", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) throw new Error("Metadata catalog returned HTTP " + upstream.status);
      const data = await upstream.json();
      const results = (data.metas || []).slice(0, 12).map(item => ({ id: item.imdb_id || item.id, name: item.name, year: item.releaseInfo || item.year || "" })).filter(item => item.id);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify({ results }));
    } catch (error) { res.writeHead(502, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ error: "Title search failed: " + error.message })); }
    return;
  }
  if (url.pathname === "/health") { res.writeHead(200, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ status: "ok", provider: "stremio-addon-ecosystem" })); return; }
  if (url.pathname !== "/") { res.writeHead(404, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ error: "Not found" })); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); res.end(html);
});
server.listen(PORT, "0.0.0.0", () => console.log(`Stremio Add-on Explorer listening on ${PORT}`));
