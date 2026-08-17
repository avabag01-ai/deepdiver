#!/usr/bin/env python3
"""개발용 정적 서버 — ES 모듈 캐시로 인한 stale import 에러 방지용 no-store 헤더."""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
