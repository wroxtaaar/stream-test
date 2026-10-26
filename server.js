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
<section class="panel"><h2>Configure test</h2><div class="fields">
<div><label for="kind">Content type</label><select id="kind"><option value="movie">Movie</option><option value="tv">TV episode</option></select></div>
<div><label for="id">TMDB or IMDb ID</label><input id="id" value="299534" placeholder="e.g. 299534 or tt1234567"></div>
<div id="seasonWrap" hidden><label for="season">Season</label><input id="season" type="number" min="1" value="1"></div>
<div id="episodeWrap" hidden><label for="episode">Episode</label><input id="episode" type="number" min="1" value="1"></div>
<div><label for="autoplay">Autoplay</label><select id="autoplay"><option value="0">Off</option><option value="1">On</option></select></div>
<div><label for="autonext">Auto-next (TV)</label><select id="autonext"><option value="0">Off</option><option value="1">On</option></select></div>
<div><label for="subtitles">Default subtitles</label><select id="subtitles"><option value="">Provider default</option><option value="en">English</option><option value="hi">Hindi</option><option value="es">Spanish</option></select></div>
</div><div class="actions"><button id="load">Load player</button><button class="secondary" id="open">Open embed in new tab</button><button class="secondary" id="clear">Clear</button></div>
<div id="status" class="status" role="status">Ready. The default preset is Avengers: Endgame (TMDB 299534).</div></section>
<div class="layout"><section class="panel"><h2>Player</h2><iframe id="player" title="Videasy player" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe><p>Audio tracks depend on the provider's source for each title. The subtitle parameter requests a default subtitle language; it does not force a dubbed audio track.</p></section>
<section class="panel"><h2>Generated URL</h2><div id="url" class="url">No URL generated yet.</div><h3>Test checklist</h3><ul><li>Does playback start?</li><li>Can you switch audio tracks, including Hindi if present?</li><li>Are subtitles selectable?</li><li>Does TV episode navigation work?</li><li>Does the same title work in a new tab and iframe?</li></ul></section></div>
<section class="panel"><h3>Known limitations</h3><p>This harness only constructs the documented embed URL and loads the provider-hosted player. A successful HTTP response does not guarantee a playable stream. Test only content you are authorized to access; third-party embeds may include ads and can change without notice.</p></section>
</main><script>
const $=id=>document.getElementById(id);let currentUrl="";
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
