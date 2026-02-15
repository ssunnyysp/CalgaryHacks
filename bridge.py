from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os, csv
from datetime import datetime, timezone

OUTFILE = os.path.join(os.getcwd(), "highlights.csv")

FIELDS = [
    "ts_iso",
    "ts_ms",
    "id",
    "pageKey",
    "url",
    "text",
    "color"
]

def ensure_csv_header():
    # Create file + header if it doesn't exist or is empty
    if (not os.path.exists(OUTFILE)) or os.path.getsize(OUTFILE) == 0:
        with open(OUTFILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDS)
            writer.writeheader()

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/highlight":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")

        try:
            obj = json.loads(body)

            ts_ms = obj.get("ts")
            if isinstance(ts_ms, (int, float)):
                ts_iso = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat()
            else:
                ts_ms = ""
                ts_iso = datetime.now(timezone.utc).isoformat()

            row = {
                "ts_iso": ts_iso,
                "ts_ms": ts_ms,
                "id": obj.get("id", ""),
                "pageKey": obj.get("pageKey", ""),
                "url": obj.get("url", ""),
                "text": obj.get("text", "").replace("\n", " ").replace("\r", " "),
                "color": obj.get("color", ""),
            }

            ensure_csv_header()
            with open(OUTFILE, "a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=FIELDS)
                writer.writerow(row)

            print("RECEIVED:", row)

            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok": true}')
        except Exception as e:
            print("ERROR:", e)
            self.send_response(400)
            self._cors()
            self.end_headers()

if __name__ == "__main__":
    ensure_csv_header()
    print("Bridge running on http://localhost:8787")
    print("Writing to:", OUTFILE)
    HTTPServer(("127.0.0.1", 8787), Handler).serve_forever()
