// Luminate Highlighter - Background Service Worker (MV3)

const BRIDGE_BASE = "http://localhost:8787";

// Default storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["highlights", "enabled", "color"], (result) => {
    const defaults = {};
    if (!result.highlights) defaults.highlights = {};
    if (result.enabled === undefined) defaults.enabled = false;

    // ✅ IMPORTANT: must be one of your allowed palette colors
    if (!result.color) defaults.color = "#ffdd00";

    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults);
    }
  });
});

// Helper: POST to local bridge (server must be running)
async function bridgePost(path, payload) {
  const res = await fetch(`${BRIDGE_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return await res.json().catch(() => ({}));
}

// Route bridge calls through background so sites can't block them
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || !msg.action) {
        sendResponse({ ok: false, error: "no action" });
        return;
      }

      switch (msg.action) {
        case "bridgeHighlight": {
          const data = await bridgePost("/highlight", msg.payload);
          sendResponse(data);
          return;
        }

        case "bridgeDelete": {
          const data = await bridgePost("/delete", { id: msg.id });
          sendResponse(data);
          return;
        }

        case "bridgeClear": {
          const data = await bridgePost("/clear", msg.payload);
          sendResponse(data);
          return;
        }

        case "analyze": {
          const data = await bridgePost("/analyze", { text: msg.text });
          sendResponse(data);
          return;
        }

        default:
          sendResponse({ ok: false, error: `unknown action: ${msg.action}` });
          return;
      }
    } catch (e) {
      sendResponse({
        ok: false,
        error: "bridge request failed",
        details: String(e?.message || e),
      });
    }
  })();

  // Keep the message channel open for async response
  return true;
});
