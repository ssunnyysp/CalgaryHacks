from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os, csv
from datetime import datetime, timezone

OUT_CSV = os.path.join(os.getcwd(), "highlights.csv")
FIELDS = ["ts_iso", "ts_ms", "id", "pageKey", "url", "text", "color"]

def ensure_csv_header():
    if (not os.path.exists(OUT_CSV)) or os.path.getsize(OUT_CSV) == 0:
        with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDS)
            writer.writeheader()

def load_rows():
    ensure_csv_header()
    with open(OUT_CSV, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)

def write_rows(rows):
    # rows is list[dict] with keys in FIELDS
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in FIELDS})

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def ts_to_iso(ts_ms):
    if isinstance(ts_ms, (int, float)):
        return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat()
    return now_iso()

def normalize_row(obj):
    ts_ms = obj.get("ts")
    ts_iso = ts_to_iso(ts_ms)

    text = (obj.get("text") or "").replace("\n", " ").replace("\r", " ")
    return {
        "ts_iso": ts_iso,
        "ts_ms": str(ts_ms) if ts_ms is not None else "",
        "id": obj.get("id", "") or "",
        "pageKey": obj.get("pageKey", "") or "",
        "url": obj.get("url", "") or "",
        "text": text,
        "color": obj.get("color", "") or "",
    }

def upsert_highlight(obj):
    """Insert/replace by id so duplicates don't accumulate."""
    row = normalize_row(obj)
    rows = load_rows()
    rows = [r for r in rows if r.get("id") != row["id"]]
    rows.append(row)
    write_rows(rows)
    return row

def delete_by_id(del_id):
    rows = load_rows()
    new_rows = [r for r in rows if r.get("id") != del_id]
    write_rows(new_rows)

def clear_scope(scope, pageKey=None):
    if scope == "all":
        write_rows([])
        return
    if scope == "page" and pageKey:
        rows = load_rows()
        new_rows = [r for r in rows if r.get("pageKey") != pageKey]
        write_rows(new_rows)

def sync_from_storage(payload):
    """
    payload expected:
      { highlights: { pageKey: [ {id,text,color,url,pageKey,ts}, ... ], ... } }
    This rewrites CSV as current snapshot.
    """
    highlights = payload.get("highlights") or {}
    rows = []
    for pageKey, arr in highlights.items():
        if not isinstance(arr, list):
            continue
        for h in arr:
            if not isinstance(h, dict):
                continue
            # ensure pageKey/url are present if not included
            h = dict(h)
            h.setdefault("pageKey", pageKey)
            rows.append(normalize_row(h))
    write_rows(rows)
    return len(rows)

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
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"

        try:
            obj = json.loads(body) if body else {}
        except Exception:
            obj = {}

        # --- Add/Update highlight ---
        if self.path == "/highlight":
            try:
                row = upsert_highlight(obj)
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "row": row}, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self._cors()
                self.end_headers()
            return

        # --- Delete highlight by id ---
        if self.path == "/delete":
            try:
                del_id = obj.get("id", "")
                if del_id:
                    delete_by_id(del_id)
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"ok": true}')
            except Exception:
                self.send_response(400)
                self._cors()
                self.end_headers()
            return

        # --- Clear page/all ---
        if self.path == "/clear":
            try:
                scope = obj.get("scope")
                pageKey = obj.get("pageKey")
                clear_scope(scope, pageKey)
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"ok": true}')
            except Exception:
                self.send_response(400)
                self._cors()
                self.end_headers()
            return

        # --- Sync snapshot from chrome.storage.local ---
        if self.path == "/sync":
            try:
                count = sync_from_storage(obj)
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "count": count}).encode("utf-8"))
            except Exception:
                self.send_response(400)
                self._cors()
                self.end_headers()
            return

        self.send_response(404)
        self._cors()
        self.end_headers()

if __name__ == "__main__":
    ensure_csv_header()
    print("Bridge running on http://localhost:8787")
    print("Writing to:", OUT_CSV)
    HTTPServer(("127.0.0.1", 8787), Handler).serve_forever()
