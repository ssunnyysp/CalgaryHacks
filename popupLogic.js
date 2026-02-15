const COLOR_MAP = {
  '#ff0000': 'rgba(255, 0, 0, 0.35)',     // Red
  '#ffdd00': 'rgba(255, 221, 0, 0.35)',   // Yellow
  '#0000ff': 'rgba(0, 0, 255, 0.35)'      // Blue
};

let selectedColor = '#ffdd00';
let isEnabled = false;
let currentTabId = null;
let currentUrl = '';

async function bridgePost(path, payload) {
  try {
    await fetch(`http://localhost:8787${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
  } catch (e) {}
}

async function syncCsvWithStorage() {
  const result = await chrome.storage.local.get(['highlights']);
  const highlights = result.highlights || {};
  await bridgePost("/sync", { highlights });
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getPageKey(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

async function loadState() {
  const tab = await getCurrentTab();
  currentTabId = tab.id;
  currentUrl = tab.url || '';

  await syncCsvWithStorage();

  const pageKey = getPageKey(currentUrl);
  const result = await chrome.storage.local.get(['enabled', 'color', 'highlights']);

  isEnabled = result.enabled || false;

  const storedColor = result.color || '#ffdd00';
  selectedColor = COLOR_MAP[storedColor] ? storedColor : '#ffdd00';

  const allHighlights = result.highlights || {};
  const pageHighlights = allHighlights[pageKey] || [];

  const totalCount = Object.values(allHighlights).reduce((acc, arr) => acc + arr.length, 0);

  document.getElementById('highlightToggle').checked = isEnabled;
  document.getElementById('statusDot').classList.toggle('active', isEnabled);
  updateHint();
  updateStats(pageHighlights.length, totalCount);
  renderHighlights(pageHighlights, pageKey);
  selectSwatch(selectedColor);
}

function selectSwatch(color) {
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === color);
  });
}

function updateHint() {
  const hint = document.getElementById('hintText');
  if (isEnabled) {
    hint.innerHTML = '<strong>On</strong> — Select any text on the page to highlight';
  } else {
    hint.innerHTML = '<strong>Off</strong> — Toggle on to begin highlighting';
  }
}

function updateStats(pageCount, totalCount) {
  document.getElementById('pageCount').textContent = pageCount;
  document.getElementById('totalCount').textContent = totalCount;
}

function renderHighlights(highlights, pageKey) {
  const list = document.getElementById('highlightsList');

  if (!highlights || highlights.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        Enable highlighting, then<br>select any text on the page
      </div>`;
    return;
  }

  list.innerHTML = '';
  [...highlights].reverse().forEach((h, i) => {
    const originalIndex = highlights.length - 1 - i;

    const item = document.createElement('div');
    item.className = 'highlight-item';

    const bar = document.createElement('div');
    bar.className = 'highlight-color-bar';
    bar.style.background = h.color;

    const text = document.createElement('span');
    text.className = 'highlight-text';
    text.textContent = h.text;

    const remove = document.createElement('span');
    remove.className = 'highlight-remove';
    remove.textContent = '×';
    remove.title = 'Remove highlight';
    remove.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeHighlight(pageKey, originalIndex);
    });

    item.appendChild(bar);
    item.appendChild(text);
    item.appendChild(remove);
    list.appendChild(item);
  });
}

async function removeHighlight(pageKey, index) {
  const result = await chrome.storage.local.get('highlights');
  const allHighlights = result.highlights || {};
  const pageHighlights = allHighlights[pageKey] || [];

  const highlightId = pageHighlights[index]?.id;

  pageHighlights.splice(index, 1);
  allHighlights[pageKey] = pageHighlights;

  await chrome.storage.local.set({ highlights: allHighlights });

  if (highlightId) {
    chrome.tabs.sendMessage(currentTabId, { action: 'removeHighlight', id: highlightId });
    await bridgePost("/delete", { id: highlightId });
  }

  const totalCount = Object.values(allHighlights).reduce((acc, arr) => acc + arr.length, 0);
  updateStats(pageHighlights.length, totalCount);
  renderHighlights(pageHighlights, pageKey);
}

// Toggle
document.getElementById('highlightToggle').addEventListener('change', async (e) => {
  isEnabled = e.target.checked;
  document.getElementById('statusDot').classList.toggle('active', isEnabled);
  updateHint();

  await chrome.storage.local.set({ enabled: isEnabled });

  chrome.tabs.sendMessage(currentTabId, {
    action: 'setEnabled',
    enabled: isEnabled,
    color: selectedColor,
    colorAlpha: COLOR_MAP[selectedColor]
  });
});

// Swatch selection
document.querySelectorAll('.swatch').forEach(swatch => {
  swatch.addEventListener('click', async () => {
    selectedColor = swatch.dataset.color;
    selectSwatch(selectedColor);

    await chrome.storage.local.set({ color: selectedColor });

    chrome.tabs.sendMessage(currentTabId, {
      action: 'setColor',
      color: selectedColor,
      colorAlpha: COLOR_MAP[selectedColor]
    });
  });
});

// Clear page
document.getElementById('clearPageBtn').addEventListener('click', async () => {
  const pageKey = getPageKey(currentUrl);
  const result = await chrome.storage.local.get('highlights');
  const allHighlights = result.highlights || {};

  allHighlights[pageKey] = [];
  await chrome.storage.local.set({ highlights: allHighlights });

  chrome.tabs.sendMessage(currentTabId, { action: 'clearPage' });
  await bridgePost("/clear", { scope: "page", pageKey });

  const totalCount = Object.values(allHighlights).reduce((acc, arr) => acc + arr.length, 0);
  updateStats(0, totalCount);
  renderHighlights([], pageKey);
});

// Clear all
document.getElementById('clearAllBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ highlights: {} });
  chrome.tabs.sendMessage(currentTabId, { action: 'clearPage' });
  await bridgePost("/clear", { scope: "all" });

  updateStats(0, 0);
  renderHighlights([], getPageKey(currentUrl));
});

// Init
loadState();
