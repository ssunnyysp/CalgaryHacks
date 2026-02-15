// Luminate Highlighter - Content Script

let isEnabled = false;

// Default = Yellow
let currentColor = "#ffdd00";
let currentColorAlpha = "rgba(255, 221, 0, 0.35)";

// Only PRIMARY colors: Red, Yellow, Blue
const COLOR_MAP = {
  "#ff0000": "rgba(255, 0, 0, 0.35)",     // Red
  "#ffdd00": "rgba(255, 221, 0, 0.35)",   // Yellow
  "#0000ff": "rgba(0, 0, 255, 0.35)"      // Blue
};

const DEFAULT_COLOR = "#ffdd00";
const DEFAULT_ALPHA = "rgba(255, 221, 0, 0.35)";

function normalizeColor(c) {
  return COLOR_MAP[c] ? c : DEFAULT_COLOR;
}
function alphaForColor(c) {
  return COLOR_MAP[c] || DEFAULT_ALPHA;
}

function generateId() {
  return "lum_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function getPageKey() {
  return window.location.origin + window.location.pathname;
}

// ---------- Background bridge helpers ----------
function bgMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (resp) => resolve(resp || { ok: false }));
    } catch (e) {
      resolve({ ok: false, error: String(e?.message || e) });
    }
  });
}

async function sendToLocalBridge(payload) {
  // no silent fail; just return ok=false if bridge down
  return await bgMessage({ action: "bridgeHighlight", payload });
}

async function notifyBridgeDelete(id) {
  return await bgMessage({ action: "bridgeDelete", id });
}

async function notifyBridgeClear(scope) {
  return await bgMessage({
    action: "bridgeClear",
    payload: { scope, pageKey: getPageKey() }
  });
}

// ---------- Model analyze + UI ----------
async function analyzeHighlight(text) {
  return await bgMessage({ action: "analyze", text });
}

function showSideCard(highlightId, selectedText, result) {
  const existing = document.getElementById("luminate-card");
  if (existing) existing.remove();

  const card = document.createElement("div");
  card.id = "luminate-card";
  card.className = "luminate-card";

  const confidencePct = Math.round(((result?.confidence ?? 0) * 100));

  card.innerHTML = `
    <button class="luminate-card-close" title="Close">×</button>
    <div class="luminate-card-title">Luminate • Fallacy Check</div>

    <div class="luminate-card-body">
      <div class="luminate-card-kv"><strong>Type:</strong> ${result?.title || result?.fallacy || "Unknown"}</div>
      <div class="luminate-card-kv"><strong>Confidence:</strong> ${Number.isFinite(confidencePct) ? confidencePct : 0}%</div>

      <div class="luminate-card-kv"><strong>Explanation</strong></div>
      <div class="luminate-card-quote">${(result?.explanation || "").trim() || "—"}</div>

      <div class="luminate-card-kv"><strong>Try asking:</strong></div>
      <div class="luminate-card-prompt">${(result?.prompt || "").trim() || "—"}</div>

      <div class="luminate-card-kv"><strong>Selected text</strong></div>
      <div class="luminate-card-quote">“${selectedText.slice(0, 260)}${selectedText.length > 260 ? "…" : ""}”</div>
    </div>
  `;

  card.querySelector(".luminate-card-close").onclick = () => card.remove();
  document.body.appendChild(card);
}

// Load and restore stored highlights for this page
async function restoreHighlights() {
  const result = await chrome.storage.local.get("highlights");
  const allHighlights = result.highlights || {};
  const pageKey = getPageKey();
  const pageHighlights = allHighlights[pageKey] || [];
  if (pageHighlights.length === 0) return;

  pageHighlights.forEach((h) => {
    try { applyHighlightById(h); } catch (e) {}
  });
}

function applyHighlightById(highlight) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const idx = node.nodeValue.indexOf(highlight.text);
    if (idx !== -1 && !node.parentElement?.dataset?.luminateId) {
      wrapTextNode(node, idx, highlight.text, highlight.color, highlight.colorAlpha, highlight.id);
      break;
    }
  }
}

function wrapTextNode(textNode, startIdx, text, color, colorAlpha, id) {
  const parent = textNode.parentNode;
  if (!parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE") return;

  const safeColor = normalizeColor(color || DEFAULT_COLOR);
  const safeAlpha = colorAlpha || alphaForColor(safeColor);

  const before = textNode.nodeValue.slice(0, startIdx);
  const after = textNode.nodeValue.slice(startIdx + text.length);

  const span = document.createElement("mark");
  span.className = "luminate-highlight";
  span.dataset.luminateId = id;
  span.dataset.color = safeColor;
  span.style.cssText = `
    background: ${safeAlpha} !important;
    border-bottom: 2px solid ${safeColor} !important;
    border-radius: 2px !important;
    padding: 1px 0 !important;
    cursor: pointer !important;
    transition: background 0.15s !important;
  `;
  span.textContent = text;

  span.addEventListener("mouseenter", () => {
    span.style.background = safeAlpha.replace("0.35", "0.55") + " !important";
  });
  span.addEventListener("mouseleave", () => {
    span.style.background = safeAlpha + " !important";
  });
  span.addEventListener("dblclick", () => {
    removeHighlightFromPage(id);
    removeHighlightFromStorage(id);
    notifyBridgeDelete(id);
  });

  const fragment = document.createDocumentFragment();
  if (before) fragment.appendChild(document.createTextNode(before));
  fragment.appendChild(span);
  if (after) fragment.appendChild(document.createTextNode(after));

  parent.replaceChild(fragment, textNode);
}

async function highlightSelection() {
  currentColor = normalizeColor(currentColor);
  currentColorAlpha = currentColorAlpha || alphaForColor(currentColor);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  if (!text) return;

  // prevent highlighting inside highlights
  const container = range.commonAncestorContainer;
  const parentMark =
    container.nodeType === 3
      ? container.parentElement?.closest(".luminate-highlight")
      : container?.closest?.(".luminate-highlight");
  if (parentMark) return;

  const id = generateId();

  const bridgePayload = {
    id,
    text,
    color: currentColor,
    url: window.location.href,
    pageKey: getPageKey(),
    ts: Date.now(),
  };

  try {
    const span = document.createElement("mark");
    span.className = "luminate-highlight";
    span.dataset.luminateId = id;
    span.dataset.color = currentColor;
    span.style.cssText = `
      background: ${currentColorAlpha} !important;
      border-bottom: 2px solid ${currentColor} !important;
      border-radius: 2px !important;
      padding: 1px 0 !important;
      cursor: pointer !important;
      transition: background 0.2s !important;
    `;

    span.addEventListener("mouseenter", () => {
      span.style.background = currentColorAlpha.replace("0.35", "0.55") + " !important";
    });
    span.addEventListener("mouseleave", () => {
      span.style.background = currentColorAlpha + " !important";
    });
    span.addEventListener("dblclick", () => {
      removeHighlightFromPage(id);
      removeHighlightFromStorage(id);
      notifyBridgeDelete(id);
    });

    range.surroundContents(span);
    selection.removeAllRanges();

    await saveHighlight({ id, text, color: currentColor, colorAlpha: currentColorAlpha });
    await sendToLocalBridge(bridgePayload);

  } catch (e) {
    // fallback
    try {
      const extracted = range.extractContents();
      const span = document.createElement("mark");
      span.className = "luminate-highlight";
      span.dataset.luminateId = id;
      span.dataset.color = currentColor;
      span.style.cssText = `
        background: ${currentColorAlpha} !important;
        border-bottom: 2px solid ${currentColor} !important;
        border-radius: 2px !important;
        padding: 1px 0 !important;
        cursor: pointer !important;
      `;
      span.appendChild(extracted);
      range.insertNode(span);
      selection.removeAllRanges();

      await saveHighlight({ id, text, color: currentColor, colorAlpha: currentColorAlpha });
      await sendToLocalBridge(bridgePayload);

      span.addEventListener("dblclick", () => {
        removeHighlightFromPage(id);
        removeHighlightFromStorage(id);
        notifyBridgeDelete(id);
      });

    } catch (e2) {
      console.warn("Luminate: could not highlight selection", e2);
      return;
    }
  }

  // analyze after saving
  const analysis = await analyzeHighlight(text);

  if (analysis?.ok) {
    showSideCard(id, text, analysis.result);
  } else {
    // ✅ Show a useful card if bridge is down
    showSideCard(id, text, {
      title: "Analysis unavailable",
      fallacy: "Bridge not running",
      confidence: 0,
      explanation:
        "Your highlight saved, but the local analysis server (http://localhost:8787) didn’t respond. Start bridge.py and refresh the page.",
      prompt: "Try: Is the bridge server running? Can I reach http://localhost:8787/analyze ?"
    });
  }
}

async function saveHighlight(highlight) {
  const result = await chrome.storage.local.get("highlights");
  const allHighlights = result.highlights || {};
  const pageKey = getPageKey();

  if (!allHighlights[pageKey]) allHighlights[pageKey] = [];
  allHighlights[pageKey].push(highlight);

  await chrome.storage.local.set({ highlights: allHighlights });
}

function removeHighlightFromPage(id) {
  const el = document.querySelector(`[data-luminate-id="${id}"]`);
  if (!el) return;
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
  parent.normalize();
}

async function removeHighlightFromStorage(id) {
  const result = await chrome.storage.local.get("highlights");
  const allHighlights = result.highlights || {};
  const pageKey = getPageKey();

  if (allHighlights[pageKey]) {
    allHighlights[pageKey] = allHighlights[pageKey].filter((h) => h.id !== id);
    await chrome.storage.local.set({ highlights: allHighlights });
  }
}

function clearAllHighlightsFromPage() {
  document.querySelectorAll(".luminate-highlight").forEach((el) => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  document.body.normalize();
}

// Listen for popup messages
chrome.runtime.onMessage.addListener((message) => {
  switch (message.action) {
    case "setEnabled": {
      isEnabled = message.enabled;
      if (message.color) currentColor = normalizeColor(message.color);
      currentColorAlpha = message.colorAlpha || alphaForColor(currentColor);
      document.body.style.cursor = isEnabled ? "text" : "";
      break;
    }

    case "setColor": {
      currentColor = normalizeColor(message.color);
      currentColorAlpha = message.colorAlpha || alphaForColor(currentColor);
      break;
    }

    case "clearPage":
      clearAllHighlightsFromPage();
      notifyBridgeClear("page");
      break;

    case "removeHighlight":
      removeHighlightFromPage(message.id);
      notifyBridgeDelete(message.id);
      break;
  }
});

// Register listeners after init (avoids first-run issues)
function registerInteractionListenersOnce() {
  if (window.__luminateListenersRegistered) return;
  window.__luminateListenersRegistered = true;

  document.addEventListener("mouseup", () => {
    if (!isEnabled) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        highlightSelection();
      }
    }, 10);
  });

  document.addEventListener("keydown", (e) => {
    if (!isEnabled) return;
    const isCopy = (e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C");
    if (!isCopy) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        highlightSelection();
      }
    }, 0);
  });
}

async function init() {
  const result = await chrome.storage.local.get(["enabled", "color"]);
  isEnabled = !!result.enabled;

  const storedColor = result.color || DEFAULT_COLOR;
  const normalized = normalizeColor(storedColor);

  currentColor = normalized;
  currentColorAlpha = alphaForColor(currentColor);

  // write back normalized color if old palette value exists
  if (storedColor !== normalized) {
    chrome.storage.local.set({ color: normalized }).catch(() => {});
  }

  if (isEnabled) document.body.style.cursor = "text";

  registerInteractionListenersOnce();
  restoreHighlights();
}

init();
