// Luminate Highlighter - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
    // Initialize default storage
    chrome.storage.local.get(['highlights', 'enabled', 'color'], (result) => {
      const defaults = {};
      if (!result.highlights) defaults.highlights = {};
      if (result.enabled === undefined) defaults.enabled = false;
      if (!result.color) defaults.color = '#f5e642';
      
      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults);
      }
    });
  });