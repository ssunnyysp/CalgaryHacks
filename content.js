// Luminate Highlighter - Content Script

let isEnabled = false;
let currentColor = "#f5e642";
let currentColorAlpha = "rgba(245, 230, 66, 0.35)";

const COLOR_MAP = {
  "#f5e642": "rgba(245, 230, 66, 0.35)",
  "#ff6b9d": "rgba(255, 107, 157, 0.35)",
  "#42f5a4": "rgba(66, 245, 164, 0.35)",
  "#42c5f5": "rgba(66, 197, 245, 0.35)",
  "#ff9142": "rgba(255, 145, 66, 0.35)",
  "#c084fc": "rgba(192, 132, 252, 0.35)",
};

function generateId() {
  return "lum_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function getPageKey() {
  return window.location.origin + window.location.pathname;
}

// ✅ TOP-LEVEL bridge sender (available everywhere)
async function sendToLocalBridge(payload) {
  try {
    await fetch("http://localhost:8787/highlight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Luminate: bridge not reachable (is it running?)", e);
  }
}

// Load and restore stored highlights for this page
async function restoreHighlights() {
  const result = await chrome.storage.local.get("highlights");
  const allHighlights = result.highlights || {};
  const pageKey = getPageKey();
  const pageHighlights = allHighlights[pageKey] || [];

  if (pageHighlights.length === 0) return;

  pageHighlights.forEach((h) => {
    try {
      applyHighlightById(h);
    } catch (e) {
      // skip if no longer matches
    }
  });
}

function applyHighlightById(highlight) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const idx = node.nodeValue.indexOf(highlight.text);
    if (idx !== -1 && !node.parentElement.dataset.luminateId) {
      wrapTextNode(
        node,
        idx,
        highlight.text,
        highlight.color,
        highlight.colorAlpha,
        highlight.id
      );
      break;
    }
  }
}

function wrapTextNode(textNode, startIdx, text, color, colorAlpha, id) {
  const parent = textNode.parentNode;
  if (!parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE") return;

  const before = textNode.nodeValue.slice(0, startIdx);
  const after = textNode.nodeValue.slice(startIdx + text.length);

  const span = document.createElement("mark");
  span.className = "luminate-highlight";
  span.dataset.luminateId = id;
  span.dataset.color = color;
  span.style.cssText = `
    background: ${colorAlpha} !important;
    border-bottom: 2px solid ${color} !important;
    border-radius: 2px !important;
    padding: 1px 0 !important;
    cursor: pointer !important;
    transition: background 0.15s !important;
  `;
  span.textContent = text;

  span.addEventListener("mouseenter", () => {
    span.style.background = colorAlpha.replace("0.35", "0.55") + " !important";
  });
  span.addEventListener("mouseleave", () => {
    span.style.background = colorAlpha + " !important";
  });
  span.addEventListener("dblclick", () => {
    removeHighlightFromPage(id);
    removeHighlightFromStorage(id);
  });

  const fragment = document.createDocumentFragment();
  if (before) fragment.appendChild(document.createTextNode(before));
  fragment.appendChild(span);
  if (after) fragment.appendChild(document.createTextNode(after));

  parent.replaceChild(fragment, textNode);
}

function highlightSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  if (!text || text.length < 1) return;

  // Prevent highlighting inside existing highlights
  const container = range.commonAncestorContainer;
  const parentMark =
    container.nodeType === 3
      ? container.parentElement?.closest(".luminate-highlight")
      : container?.closest?.(".luminate-highlight");
  if (parentMark) return;

  const id = generateId();

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
      span.style.background =
        currentColorAlpha.replace("0.35", "0.55") + " !important";
    });
    span.addEventListener("mouseleave", () => {
      span.style.background = currentColorAlpha + " !important";
    });
    span.addEventListener("dblclick", () => {
      removeHighlightFromPage(id);
      removeHighlightFromStorage(id);
    });

    range.surroundContents(span);
    selection.removeAllRanges();

    span.animate(
      [
        { opacity: 0.3, transform: "scale(0.98)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 200, easing: "ease-out" }
    );

    // Save to storage
    saveHighlight({ id, text, color: currentColor, colorAlpha: currentColorAlpha });

    // ✅ ALSO send to local bridge
    sendToLocalBridge({
      id,
      text,
      color: currentColor,
      url: window.location.href,
      pageKey: getPageKey(),
      ts: Date.now(),
    });
  } catch (e) {
    // surroundContents fails for cross-element selections
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

      saveHighlight({ id, text, color: currentColor, colorAlpha: currentColorAlpha });

      // ✅ send to local bridge here too
      sendToLocalBridge({
        id,
        text,
        color: currentColor,
        url: window.location.href,
        pageKey: getPageKey(),
        ts: Date.now(),
      });
    } catch (e2) {
      console.warn("Luminate: could not highlight selection", e2);
    }
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

// Mouseup handler for selection
document.addEventListener("mouseup", () => {
  if (!isEnabled) return;
  setTimeout(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      highlightSelection();
    }
  }, 10);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message) => {
  switch (message.action) {
    case "setEnabled":
      isEnabled = message.enabled;
      if (message.color) currentColor = message.color;
      if (message.colorAlpha) currentColorAlpha = message.colorAlpha;
      document.body.style.cursor = isEnabled ? "text" : "";
      break;

    case "setColor":
      currentColor = message.color;
      currentColorAlpha = message.colorAlpha;
      break;

    case "clearPage":
      clearAllHighlightsFromPage();
      break;

    case "removeHighlight":
      removeHighlightFromPage(message.id);
      break;
  }
});

// Init: load persisted state
async function init() {
  const result = await chrome.storage.local.get(["enabled", "color"]);
  isEnabled = result.enabled || false;
  currentColor = result.color || "#f5e642";
  currentColorAlpha = COLOR_MAP[currentColor] || "rgba(245, 230, 66, 0.35)";

  if (isEnabled) document.body.style.cursor = "text";

  restoreHighlights();
}

init();
