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


# Passwords are always strings. The upstream settings loader eval()s environment
# values to coerce numeric/boolean settings, which turns digit-only passwords
# into integers and makes the login endpoint's string comparison fail.
settings_path = Path("/src/app/settings.py")
settings_source = settings_path.read_text()
old_settings_loop = '''    if _env_var is not _NULL:
        with contextlib.suppress(Exception):
            _env_var = eval(_env_var)
        globals()[_variable] = _env_var
'''
new_settings_loop = '''    if _env_var is not _NULL:
        if _variable != "PASSWORD":
            with contextlib.suppress(Exception):
                _env_var = eval(_env_var)
        globals()[_variable] = _env_var
'''
if old_settings_loop not in settings_source:
    raise SystemExit("Could not find expected settings environment loader; refusing to patch unexpected upstream source")
settings_path.write_text(settings_source.replace(old_settings_loop, new_settings_loop, 1))
