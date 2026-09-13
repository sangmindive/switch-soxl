# -*- coding: utf-8 -*-
"""Static files + Google Finance SOXL quote. Run: python server.py"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

GF_URL = "https://www.google.com/finance/quote/SOXL:NYSEARCA"


def fetch_google_finance(symbol: str = "SOXL") -> dict:
    url = f"https://www.google.com/finance/quote/{symbol}:NYSEARCA"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
    m = re.search(
        r'jsname="Pdsbrc"[^>]*>\s*<span>\$([0-9][0-9,]+\.[0-9]+)</span>'
        r'[\s\S]{0,900}?jsname="vY9t3b"[^>]*>\s*<span[^>]*>\s*([+-]?[0-9]+\.[0-9]+)%',
        html,
    )
    if not m:
        raise ValueError("google finance parse failed")
    price = float(m.group(1).replace(",", ""))
    change_pct = float(m.group(2)) / 100
    return {"price": price, "changePct": change_pct, "source": "google-finance"}


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/quote":
            try:
                qs = ""
                if "?" in self.path:
                    qs = self.path.split("?", 1)[1]
                symbol = "SOXL"
                for part in qs.split("&"):
                    if part.startswith("symbol="):
                        symbol = urllib.parse.unquote(part.split("=", 1)[1]).upper() or "SOXL"
                data = fetch_google_finance(symbol)
                body = json.dumps(data).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as exc:
                body = json.dumps({"error": str(exc)}).encode("utf-8")
                self.send_response(502)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            return
        return SimpleHTTPRequestHandler.do_GET(self)

    def log_message(self, fmt, *args):
        if args and str(args[0]).startswith("GET /quote"):
            SimpleHTTPRequestHandler.log_message(self, fmt, *args)


if __name__ == "__main__":
    port = 8765
    print(f"Switch  http://127.0.0.1:{port}/")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
