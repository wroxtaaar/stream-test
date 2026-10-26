import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 3000);

const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Stream Test Lab — Yenime</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#eef2ff;background:#090d18}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 8% 0,#24315c 0,transparent 42%),#090d18}
main{max-width:1100px;margin:auto;padding:30px 18px 60px}.eyebrow{color:#a8b7ff;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:800}
h1{font-size:clamp(30px,5vw,46px);letter-spacing:-.04em;margin:8px 0}h2{margin:0 0 14px}p{color:#aeb9d2;line-height:1.55}
.panel{border:1px solid #283451;background:#11192b;border-radius:16px;padding:20px;margin-top:16px}
.fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
label{display:block;font-size:12px;color:#b7c2dc;margin-bottom:7px}
input,select,button{font:inherit;border-radius:9px;padding:12px;border:1px solid #344264;background:#0a1120;color:#eef2ff;width:100%}
button{background:#8798ff;color:#080e20;font-weight:800;border:0;cursor:pointer}button.secondary{background:#202b45;color:#e2e8ff;border:1px solid #344264}
.actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.actions button{width:auto}
.status{margin-top:14px;color:#c4d0eb;white-space:pre-wrap;overflow-wrap:anywhere}
.tag{display:inline-block;border:1px solid #344264;border-radius:999px;padding:5px 10px;font-size:12px;color:#c5d0ee;margin:4px 5px 4px 0}
.layout{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.url,pre{font:12px ui-monospace,SFMono-Regular,monospace;overflow-wrap:anywhere;white-space:pre-wrap;background:#090f1c;padding:12px;border-radius:9px;color:#dbe4ff}
iframe{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#050812}
.muted{color:#8794b4;font-size:12px}.wide{grid-column:1/-1}
a{color:#bdc8ff}
.presets{display:flex;gap:8px;flex-wrap:wrap}.presets button{width:auto}
@media(max-width:720px){.fields,.layout{grid-template-columns:1fr 1fr}}@media(max-width:480px){.fields,.layout{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
</head>
<body><main>
<div class="eyebrow">Stream Test Lab / Provider: Yenime</div>
<h1>Anime embed test bench</h1>
<p>A standalone test for Yenime's public anime embed. Start with a MyAnimeList ID, choose an episode and compare the SUB and DUB URL attempts. Playback is served by Yenime, not this app.</p>
<div><span class="tag">No API key advertised</span><span class="tag">MAL ID + episode</span><span class="tag">SUB / DUB test</span></div>
<section class="panel">
<h2>1. Choose an anime</h2>
<div class="fields">
  <div><label for="malId">MyAnimeList (MAL) ID</label><input id="malId" type="number" min="1" step="1" value="1535"></div>
  <div><label for="episode">Episode</label><input id="episode" type="number" min="1" step="1" value="1"></div>
  <div><label for="mode">Audio mode</label><select id="mode"><option value="sub">SUB — Japanese audio</option><option value="dub">DUB — English dub (experimental URL flag)</option></select></div>
  <div><label for="autoplay">Autoplay parameter</label><select id="autoplay"><option value="true">Enabled (muted where required)</option><option value="false">Disabled</option></select></div>
</div>
<p class="muted">Quick tests</p>
<div class="presets">
<button class="secondary" type="button" data-id="1535">Death Note · MAL 1535</button>
<button class="secondary" type="button" data-id="20">Naruto · MAL 20</button>
<button class="secondary" type="button" data-id="52991">Frieren · MAL 52991</button>
</div>
<div class="actions"><button id="load">Load Yenime player</button><button id="open" class="secondary">Open URL in new tab</button><button id="clear" class="secondary">Clear player</button></div>
<div id="status" class="status" role="status">Ready. Load a title to test the player.</div>
</section>
<div class="layout">
<section class="panel">
<h2>2. Yenime player</h2>
<iframe id="player" title="Yenime anime player" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
<p class="muted">If the selected mode doesn't play, try switching audio inside the provider's own player if that control is available.</p>
</section>
<section class="panel">
<h2>3. Generated embed URL</h2>
<div id="url" class="url">No URL generated yet.</div>
<p class="muted">SUB uses the observed public integration URL pattern. DUB adds <code>dub=true</code> as an experimental parameter; Yenime's published parameter list doesn't document that flag, so the result must be verified.</p>
<h2 style="margin-top:22px">Test notes</h2>
<p class="muted">An iframe loading successfully does not guarantee that a playable source exists. Record whether the player loads, whether playback starts, and whether the selected audio language works.</p>
</section>
</div>
<section class="panel">
<h2>Provider documentation</h2>
<p><a href="https://api.yenime.net/" target="_blank" rel="noreferrer">Open Yenime's official demo and docs</a>. The provider advertises an embeddable player for anime by MAL or AniList ID, with SUB/DUB support.</p>
</section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let currentUrl = "";
function buildUrl() {
  const id = $("malId").value.trim();
  const ep = $("episode").value.trim();
  const mode = $("mode").value;
  const autoplay = $("autoplay").value;
  if (!/^\d{1,8}$/.test(id) || Number(id) < 1) throw new Error("Enter a positive numeric MAL ID.");
  if (!/^\d{1,4}$/.test(ep) || Number(ep) < 1) throw new Error("Episode must be a positive number.");
  const params = new URLSearchParams();
  params.set("autoplay", autoplay);
  if (mode === "dub") params.set("dub", "true");
  return "https://api.yenime.net/anime/" + encodeURIComponent(id) + "/" + encodeURIComponent(ep) + "?" + params.toString();
}
function loadPlayer(openInTab) {
  try {
    currentUrl = buildUrl();
    $("url").textContent = currentUrl;
    $("status").textContent = $("mode").value === "dub"
      ? "Loading DUB test. The dub URL flag is experimental because Yenime does not document it in its public parameter list."
      : "Loading SUB test using Yenime's documented anime embed route.";
    if (openInTab) window.open(currentUrl, "_blank", "noopener,noreferrer");
    else $("player").src = currentUrl;
  } catch (error) {
    $("status").textContent = error.message;
  }
}
$("load").addEventListener("click", () => loadPlayer(false));
$("open").addEventListener("click", () => loadPlayer(true));
$("clear").addEventListener("click", () => {
  $("player").removeAttribute("src");
  $("url").textContent = "No URL generated yet.";
  $("status").textContent = "Player cleared.";
  currentUrl = "";
});
document.querySelectorAll("[data-id]").forEach((button) => {
  button.addEventListener("click", () => {
    $("malId").value = button.dataset.id;
    $("episode").value = "1";
    $("mode").value = "sub";
    loadPlayer(false);
  });
});
$("mode").addEventListener("change", () => {
  $("status").textContent = $("mode").value === "dub"
    ? "DUB test selected. The generated dub flag is experimental; the official docs don't list a URL parameter for choosing audio mode."
    : "SUB test selected.";
});
</script>
</body></html>`;

function send(res, status, type, body) {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src https://api.yenime.net https://player.yenime.net; img-src 'self' data: https:; connect-src 'self'"
  });
  res.end(body);
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost:" + PORT);
  if (url.pathname === "/health") {
    return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ status: "ok", provider: "yenime" }));
  }
  if (url.pathname === "/") return send(res, 200, "text/html; charset=utf-8", html);
  return send(res, 404, "application/json; charset=utf-8", JSON.stringify({ error: "Not found" }));
});
server.listen(PORT, "0.0.0.0", () => console.log("Yenime Test Lab listening on 0.0.0.0:" + PORT));
