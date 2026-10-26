"""Small ARM64-friendly 1337x search adapter based on Torrent Studio's provider approach.
Returns torrent detail links; RapidBay resolves those to magnets through its existing flow.
"""
import re
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup

HOSTS = ("https://1337x.to", "https://1337x.st", "https://x1337x.ws", "https://x1337x.eu", "https://x1337x.cc")
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"}
TIMEOUT = 8


def search(searchterm: str, limit: int = 30) -> list[dict]:
    query = re.sub(r"\\s+", " ", (searchterm or "").strip())
    if not query:
        return []
    encoded = quote(query, safe="").replace("%20", "+")
    tokens = [t for t in re.findall(r"[a-z0-9]+", query.lower()) if t]
    results: list[dict] = []
    seen: set[str] = set()
    for host in HOSTS:
        try:
            response = requests.get(f"{host}/search/{encoded}/1/", headers=HEADERS, timeout=TIMEOUT)
            if response.status_code >= 400:
                continue
            soup = BeautifulSoup(response.text, "html.parser")
            for link in soup.select('a[href^="/torrent/"]'):
                href = link.get("href", "")
                row = link.find_parent("tr")
                title = link.get_text(" ", strip=True)
                if not href or not row or not title or href in seen:
                    continue
                normalized = " ".join(re.findall(r"[a-z0-9]+", title.lower()))
                if tokens and not all(token in normalized for token in tokens):
                    continue
                cells = row.find_all("td")
                text = " ".join(cell.get_text(" ", strip=True) for cell in cells)
                size_match = re.search(r"[\\d.]+\\s*[KMGT]i?B", text, re.I)
                if not size_match:
                    continue
                numbers = [int(x.replace(",", "")) for x in re.findall(r"(?<![\\w.])\\d[\\d,]*(?![\\w.])", text)]
                seeders = numbers[-2] if len(numbers) >= 2 else 0
                leechers = numbers[-1] if numbers else 0
                detail_url = urljoin(host, href)
                seen.add(href)
                results.append({
                    "title": title,
                    "seeds": max(0, seeders),
                    "magnet": None,
                    "torrent_link": detail_url,
                })
            if results:
                break
        except requests.RequestException:
            continue
    results.sort(key=lambda item: item.get("seeds", 0), reverse=True)
    return results[:max(1, min(limit, 50))]
