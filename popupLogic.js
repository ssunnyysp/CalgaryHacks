const COLOR_MAP = {
    '#f5e642': 'rgba(245, 230, 66, 0.35)',
    '#ff6b9d': 'rgba(255, 107, 157, 0.35)',
    '#42f5a4': 'rgba(66, 245, 164, 0.35)',
    '#42c5f5': 'rgba(66, 197, 245, 0.35)',
    '#ff9142': 'rgba(255, 145, 66, 0.35)',
    '#c084fc': 'rgba(192, 132, 252, 0.35)'
  };
  
  let selectedColor = '#f5e642';
  let isEnabled = false;
  let currentTabId = null;
  let currentUrl = '';
  
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
  
    const pageKey = getPageKey(currentUrl);
    const result = await chrome.storage.local.get(['enabled', 'color', 'highlights']);
    
    isEnabled = result.enabled || false;
    selectedColor = result.color || '#f5e642';
    
    const allHighlights = result.highlights || {};
    const pageHighlights = allHighlights[pageKey] || [];
  
    // Calculate totals
    const totalCount = Object.values(allHighlights).reduce((acc, arr) => acc + arr.length, 0);
    
    // Update UI
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
    // Show most recent first
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
  
    // Remove from page
    if (highlightId) {
      chrome.tabs.sendMessage(currentTabId, {
        action: 'removeHighlight',
        id: highlightId
      });
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
    
    const totalCount = Object.values(allHighlights).reduce((acc, arr) => acc + arr.length, 0);
    updateStats(0, totalCount);
    renderHighlights([], pageKey);
  });
  
  // Clear all
  document.getElementById('clearAllBtn').addEventListener('click', async () => {
    await chrome.storage.local.set({ highlights: {} });
    chrome.tabs.sendMessage(currentTabId, { action: 'clearPage' });
    updateStats(0, 0);
    renderHighlights([], getPageKey(currentUrl));
  });
  
  // Init
  loadState();