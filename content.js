// Luminate Highlighter - Content Script

let isEnabled = false;

// Default = Yellow (classic highlight)
let currentColor = '#ffdd00';
let currentColorAlpha = 'rgba(255, 221, 0, 0.35)';

// Only PRIMARY colors: Red, Yellow, Blue
const COLOR_MAP = {
  '#ff0000': 'rgba(255, 0, 0, 0.35)',     // Red
  '#ffdd00': 'rgba(255, 221, 0, 0.35)',   // Yellow
  '#0000ff': 'rgba(0, 0, 255, 0.35)'      // Blue
};

const DEFAULT_COLOR = '#ffdd00';
const DEFAULT_ALPHA = 'rgba(255, 221, 0, 0.35)';

function normalizeColor(c) {
  return COLOR_MAP[c] ? c : DEFAULT_COLOR;
}
function alphaForColor(c) {
  return COLOR_MAP[c] || DEFAULT_ALPHA;
}

function generateId() {
  return 'lum_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function getPageKey() {
  return window.location.origin + window.location.pathname;
}

// ---------- Bridge helpers ----------
async function sendToLocalBridge(payload) {
  try {
    await fetch("http://localhost:8787/highlight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Luminate: bridge not reachable", e);
  }
}

async function notifyBridgeDelete(id) {
  try {
    await fetch("http://localhost:8787/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch (e) {
    console.warn("Luminate: delete bridge not reachable", e);
  }
}

async function notifyBridgeClear(scope) {
  try {
    await fetch("http://localhost:8787/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, pageKey: getPageKey() }),
    });
  } catch (e) {
    console.warn("Luminate: clear bridge not reachable", e);
  }
}

// Load and restore stored highlights for this page
async function restoreHighlights() {
  const result = await chrome.storage.local.get('highlights');
  const allHighlights = result.highlights || {};
  const pageKey = getPageKey();
  const pageHighlights = allHighlights[pageKey] || [];
  if (pageHighlights.length === 0) return;

  pageHighlights.forEach(h => {
    try { applyHighlightById(h); } catch (e) {}
  });
}

function applyHighlightById(highlight) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const idx = node.nodeValue.indexOf(highlight.text);
    if (idx !== -1 && !node.parentElement.dataset.luminateId) {
      wrapTextNode(node, idx, highlight.text, highlight.color, highlight.colorAlpha, highlight.id);
      break;
    }
  }
}

function wrapTextNode(textNode, startIdx, text, color, colorAlpha, id) {
  const parent = textNode.parentNode;
  if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;

  const safeColor = normalizeColor(color || DEFAULT_COLOR);
  const safeAlpha = colorAlpha || alphaForColor(safeColor);

  const before = textNode.nodeValue.slice(0, startIdx);
  const after = textNode.nodeValue.slice(startIdx + text.length);

  const span = document.createElement('mark');
  span.className = 'luminate-highlight';
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

  span.addEventListener('mouseenter', () => {
    span.style.background = safeAlpha.replace('0.35', '0.55') + ' !important';
  });
  span.addEventListener('mouseleave', () => {
    span.style.background = safeAlpha + ' !important';
  });
  span.addEventListener('dblclick', () => {
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

function highlightSelection() {
  // ✅ guarantee we always have a valid color + alpha before doing anything
  currentColor = normalizeColor(currentColor);
  currentColorAlpha = currentColorAlpha || alphaForColor(currentColor);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  if (!text || text.length < 1) return;

  // Prevent highlighting inside existing highlights
  const container = range.commonAncestorContainer;
  const parentMark = container.nodeType === 3
    ? container.parentElement?.closest('.luminate-highlight')
    : container?.closest?.('.luminate-highlight');
  if (parentMark) return;

  const id = generateId();

  const bridgePayload = {
    id,
    text,
    color: currentColor,
    url: window.location.href,
    pageKey: getPageKey(),
    ts: Date.now()
  };

  try {
    const span = document.createElement('mark');
    span.className = 'luminate-highlight';
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

    span.addEventListener('mouseenter', () => {
      span.style.background = currentColorAlpha.replace('0.35', '0.55') + ' !important';
    });
    span.addEventListener('mouseleave', () => {
      span.style.background = currentColorAlpha + ' !important';
    });
    span.addEventListener('dblclick', () => {
      removeHighlightFromPage(id);
      removeHighlightFromStorage(id);
      notifyBridgeDelete(id);
    });

    range.surroundContents(span);
    selection.removeAllRanges();

    span.animate(
      [
        { opacity: 0.3, transform: 'scale(0.98)' },
        { opacity: 1, transform: 'scale(1)' }
      ],
      { duration: 200, easing: 'ease-out' }
    );

    saveHighlight({ id, text, color: currentColor, colorAlpha: currentColorAlpha });

    // ✅ write/update CSV row
    sendToLocalBridge(bridgePayload);

  } catch (e) {
    // Fallback if surroundContents fails
    try {
      const extracted = range.extractContents();
      const span = document.createElement('mark');
      span.className = 'luminate-highlight';
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

      saveHighlight({ id, text, color: currentColor, colorAlpha: currentColorAlpha });

      // ✅ write/update CSV row
      sendToLocalBridge(bridgePayload);

      span.addEventListener('dblclick', () => {
        removeHighlightFromPage(id);
        removeHighlightFromStorage(id);
        notifyBridgeDelete(id);
      });

    } catch (e2) {
      console.warn('Luminate: could not highlight selection', e2);
    }
  }
}

async function saveHighlight(highlight) {
  const result = await chrome.storage.local.get('highlights');
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
  const result = await chrome.storage.local.get('highlights');
  const allHighlights = result.highlights || {};
  const pageKey = getPageKey();

  if (allHighlights[pageKey]) {
    allHighlights[pageKey] = allHighlights[pageKey].filter(h => h.id !== id);
    await chrome.storage.local.set({ highlights: allHighlights });
  }
}

function clearAllHighlightsFromPage() {
  document.querySelectorAll('.luminate-highlight').forEach(el => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  document.body.normalize();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message) => {
  switch (message.action) {
    case 'setEnabled': {
      isEnabled = message.enabled;

      // If popup passed a color, use it; otherwise keep ours
      if (message.color) currentColor = normalizeColor(message.color);
      // ✅ Always compute alpha if missing
      currentColorAlpha = message.colorAlpha || alphaForColor(currentColor);

      document.body.style.cursor = isEnabled ? 'text' : '';
      break;
    }

    case 'setColor': {
      currentColor = normalizeColor(message.color);
      currentColorAlpha = message.colorAlpha || alphaForColor(currentColor);
      break;
    }

    case 'clearPage':
      clearAllHighlightsFromPage();
      notifyBridgeClear("page");
      break;

    case 'removeHighlight':
      removeHighlightFromPage(message.id);
      notifyBridgeDelete(message.id);
      break;
  }
});

// ✅ Register listeners only AFTER init() loads the enabled state
function registerInteractionListenersOnce() {
  if (window.__luminateListenersRegistered) return;
  window.__luminateListenersRegistered = true;

  // Mouseup highlight
  document.addEventListener('mouseup', () => {
    if (!isEnabled) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        highlightSelection();
      }
    }, 10);
  });

  // Ctrl/Cmd+C highlight
  document.addEventListener('keydown', (e) => {
    if (!isEnabled) return;
    const isCopy = (e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C');
    if (!isCopy) return;

    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        highlightSelection();
      }
    }, 0);
  });
}

// Init: load persisted state
async function init() {
  const result = await chrome.storage.local.get(['enabled', 'color']);
  isEnabled = !!result.enabled;

  // ✅ normalize stored color (handles old stored colors like #f5e642)
  const storedColor = result.color || DEFAULT_COLOR;
  const normalized = normalizeColor(storedColor);

  currentColor = normalized;
  currentColorAlpha = alphaForColor(currentColor);

  // ✅ optional: write back normalized color so storage is clean
  if (storedColor !== normalized) {
    chrome.storage.local.set({ color: normalized }).catch(() => {});
  }

  if (isEnabled) document.body.style.cursor = 'text';

  registerInteractionListenersOnce();
  restoreHighlights();
}

init();
