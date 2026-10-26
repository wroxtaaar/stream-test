import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const html = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stream Test Lab — Videasy</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#090d18;color:#eef2ff}*{box-sizing:border-box}
body{margin:0;background:radial-gradient(ellipse at 10% 0,#1b2850 0,transparent 42%),#090d18}
main{max-width:1100px;margin:auto;padding:28px 18px 60px}h1{font-size:clamp(30px,5vw,46px);margin:8px 0}p{color:#aeb9d2;line-height:1.55}
.panel{border:1px solid #283451;background:#11192b;border-radius:16px;padding:20px;margin-top:16px}
.fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}label{display:block;font-size:12px;color:#b7c2dc;margin-bottom:7px}
input,select,button{font:inherit;border-radius:9px;padding:12px;border:1px solid #344264;background:#0a1120;color:#eef2ff;width:100%}
button{background:#8798ff;color:#080e20;font-weight:800;border:0;cursor:pointer}.secondary{background:#202b45;color:#e2e8ff;border:1px solid #344264}
.actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.actions button{width:auto}.status{margin-top:12px;overflow-wrap:anywhere;color:#c4d0eb}
.layout{display:grid;grid-template-columns:1fr 1fr;gap:16px}iframe{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#050812}
.url,pre{font:12px ui-monospace,monospace;overflow-wrap:anywhere;white-space:pre-wrap;background:#090f1c;padding:12px;border-radius:9px;color:#dbe4ff}
.tag{display:inline-block;border:1px solid #344264;border-radius:999px;padding:5px 10px;font-size:12px;color:#c5d0ee;margin:4px 5px 4px 0}
@media(max-width:720px){.fields,.layout{grid-template-columns:1fr 1fr}}@media(max-width:480px){.fields,.layout{grid-template-columns:1fr}}
</style></head><body><main>
<div style="color:#a8b7ff;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:800">Stream Test Lab / Provider</div>
<h1>Videasy test bench</h1><p>Isolated test harness for Videasy movie and TV embeds. Test playback and audio/subtitle options here before considering any integration into another project.</p>
<div><span class="tag">Movie + TV</span><span class="tag">TMDB / IMDb ID</span><span class="tag">No API key configured</span></div>
<section class="panel"><h2>1. Search for a title</h2><div class="fields">
<div><label for="searchKind">Search type</label><select id="searchKind"><option value="movie">Movies</option><option value="series">TV series</option></select></div>
<div style="grid-column:span 2"><label for="searchQuery">Title</label><input id="searchQuery" placeholder="e.g. Breaking Bad or Avengers: Endgame"></div>
<div><label>&nbsp;</label><button id="searchButton">Search titles</button></div>
</div><div id="searchStatus" class="status">Search by name, then select a result to fill in its ID.</div><div id="searchResults" class="fields"></div></section>
<section class="panel"><h2>2. Configure test</h2><div class="fields">
<div><label for="kind">Content type</label><select id="kind"><option value="movie">Movie</option><option value="tv">TV episode</option></select></div>
<div><label for="id">TMDB or IMDb ID</label><input id="id" value="299534" placeholder="e.g. 299534 or tt1234567"></div>
<div id="seasonWrap" hidden><label for="season">Season</label><input id="season" type="number" min="1" value="1"></div>
<div id="episodeWrap" hidden><label for="episode">Episode</label><input id="episode" type="number" min="1" value="1"></div>
<div><label for="autoplay">Autoplay</label><select id="autoplay"><option value="0">Off</option><option value="1">On</option></select></div>
<div><label for="autonext">Auto-next (TV)</label><select id="autonext"><option value="0">Off</option><option value="1">On</option></select></div>
<div><label for="subtitles">Default subtitles</label><select id="subtitles"><option value="">Provider default</option><option value="en">English</option><option value="hi">Hindi</option><option value="es">Spanish</option></select></div>
</div><div class="actions"><button id="load">Load player</button><button class="secondary" id="open">Open embed in new tab</button><button class="secondary" id="clear">Clear</button></div>
<div id="status" class="status" role="status">Search for a title above or enter an ID manually. Preset: Avengers: Endgame (299534).</div></section>
<div class="layout"><section class="panel"><h2>Player</h2><iframe id="player" title="Videasy player" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe><p>Audio tracks depend on the provider's source for each title. The subtitle parameter requests a default subtitle language; it does not force a dubbed audio track.</p></section>
<section class="panel"><h2>Generated URL</h2><div id="url" class="url">No URL generated yet.</div><h3>Test checklist</h3><ul><li>Does playback start?</li><li>Can you switch audio tracks, including Hindi if present?</li><li>Are subtitles selectable?</li><li>Does TV episode navigation work?</li><li>Does the same title work in a new tab and iframe?</li></ul></section></div>
<section class="panel"><h3>Known limitations</h3><p>This harness only constructs the documented embed URL and loads the provider-hosted player. A successful HTTP response does not guarantee a playable stream. Test only content you are authorized to access; third-party embeds may include ads and can change without notice.</p></section>
</main><script>
const $=id=>document.getElementById(id);let currentUrl="";
async function searchTitles(){const q=$("searchQuery").value.trim();if(!q){$("searchStatus").textContent="Enter a title to search.";return;}const kind=$("searchKind").value;$("searchStatus").textContent="Searching titles…";$("searchResults").replaceChildren();try{const r=await fetch("/api/search?q="+encodeURIComponent(q)+"&type="+encodeURIComponent(kind));const data=await r.json();if(!r.ok)throw new Error(data.error||"Search failed");if(!data.results?.length){$("searchStatus").textContent="No results found. Try another title or enter an ID manually.";return;}$("searchStatus").textContent="Choose a result to fill in the ID and content type.";for(const item of data.results){const card=document.createElement("div");card.style.cssText="border:1px solid #344264;border-radius:10px;padding:12px;background:#0a1120";const title=document.createElement("strong");title.textContent=item.name||item.id;const meta=document.createElement("p");meta.style.cssText="font-size:12px;margin:6px 0";meta.textContent=[item.year,item.id].filter(Boolean).join(" · ");const btn=document.createElement("button");btn.textContent="Use this title";btn.addEventListener("click",()=>{$("kind").value=kind==="movie"?"movie":"tv";$("id").value=item.id;sync();$("status").textContent="Selected "+(item.name||item.id)+". If the provider expects a different ID type, try its TMDB ID manually.";window.scrollTo({top:$("id").getBoundingClientRect().top+window.scrollY-100,behavior:"smooth"});});card.append(title,meta,btn);$("searchResults").append(card);}}catch(e){$("searchStatus").textContent="Search unavailable: "+e.message;}}
$("searchButton").addEventListener("click",searchTitles);$("searchQuery").addEventListener("keydown",e=>{if(e.key==="Enter")searchTitles();});
function sync(){const tv=$("kind").value==="tv";$("seasonWrap").hidden=!tv;$("episodeWrap").hidden=!tv;}
function build(){const kind=$("kind").value,id=$("id").value.trim();if(!id)throw new Error("Enter a TMDB or IMDb ID.");
if(!/^(tt\\d{7,}|\\d+)$/.test(id))throw new Error("Use a numeric TMDB ID or IMDb ID starting with tt.");
let path=kind==="movie"?"/embed/movie/"+encodeURIComponent(id):"/embed/tv/"+encodeURIComponent(id)+"/"+Math.max(1,Number($("season").value)||1)+"/"+Math.max(1,Number($("episode").value)||1);
const q=new URLSearchParams();q.set("autoplay",$("autoplay").value);if(kind==="tv")q.set("autonext",$("autonext").value);if($("subtitles").value)q.set("ds_lang",$("subtitles").value);
return "https://player.videasy.ws"+path+"?"+q.toString();}
$("kind").addEventListener("change",sync);sync();
$("load").addEventListener("click",()=>{try{currentUrl=build();$("player").src=currentUrl;$("url").textContent=currentUrl;$("status").textContent="Embed loaded. Check playback and available audio tracks manually.";}catch(e){$("status").textContent=e.message;}});
$("open").addEventListener("click",()=>{try{currentUrl=build();$("url").textContent=currentUrl;window.open(currentUrl,"_blank","noopener");}catch(e){$("status").textContent=e.message;}});
$("clear").addEventListener("click",()=>{$("player").src="about:blank";$("url").textContent="No URL generated yet.";$("status").textContent="Player cleared.";currentUrl="";});
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/api/search") {
    const q = (url.searchParams.get("q") || "").trim();
    const type = url.searchParams.get("type") === "series" ? "series" : "movie";
    if (!q) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Missing search query" }));
      return;
    }
    try {
      const upstream = await fetch("https://v3-cinemeta.strem.io/catalog/" + type + "/top/search=" + encodeURIComponent(q) + ".json", { headers: { "accept": "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) throw new Error("Metadata catalog returned HTTP " + upstream.status);
      const data = await upstream.json();
      const results = (data.metas || []).slice(0, 12).map(item => ({ id: item.imdb_id || item.id, name: item.name, year: item.releaseInfo || item.year || "" })).filter(item => item.id);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ results }));
    } catch (error) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Title search failed: " + error.message }));
    }
    return;
  }
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", provider: "videasy" }));
    return;
  }
  if (url.pathname !== "/") {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(html);
});
server.listen(PORT, "0.0.0.0", () => console.log(`Videasy test bench listening on ${PORT}`));
