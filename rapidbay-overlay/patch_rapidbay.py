"""Patch RapidBay's upstream app to add the Torrent Studio 1337x provider."""
from pathlib import Path

path = Path("/src/app/app.py")
source = path.read_text()

if "import torrentstudio_search" not in source:
    source = source.replace("import torrent\n", "import torrent\nimport torrentstudio_search\n", 1)

start = source.index("def _indexer_search(searchterm: str)")
end = source.index('\n\n@app.get("/health")', start)
replacement = '''def _indexer_search(searchterm: str) -> List[Dict[str, Any]]:
    """Merge configured Jackett/Prowlarr sources with Torrent Studio's 1337x provider."""
    results: List[Dict[str, Any]] = []
    if settings.JACKETT_HOST:
        results.extend(jackett.search(searchterm))
    if settings.PROWLARR_HOST:
        results.extend(prowlarr.search(searchterm))
    if os.getenv("TORRENT_STUDIO_SEARCH_ENABLED", "1").lower() in {"1", "true", "yes", "on"}:
        try:
            results.extend(torrentstudio_search.search(searchterm))
        except Exception as exc:
            print(f"Torrent Studio search provider failed: {exc}")
    return _dedup_and_sort(results)
'''
source = source[:start] + replacement + source[end:]

old = '''if settings.JACKETT_HOST or settings.PROWLARR_HOST:
        results: List[Dict[str, Any]] = _indexer_search(searchterm)
    else:
        results = _NO_BACKEND_RESULTS'''
new = '''if settings.JACKETT_HOST or settings.PROWLARR_HOST or os.getenv("TORRENT_STUDIO_SEARCH_ENABLED", "1").lower() in {"1", "true", "yes", "on"}:
        results: List[Dict[str, Any]] = _indexer_search(searchterm)
    else:
        results = _NO_BACKEND_RESULTS'''
if old not in source:
    raise SystemExit("Could not find RapidBay search() conditional; refusing to patch unexpected upstream source")
source = source.replace(old, new, 1)
path.write_text(source)
