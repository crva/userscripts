// ==UserScript==
// @name         SoundCloud cover downloader
// @description  Implements a "download cover" button when you open a cover preview by clicking on it
// @version      2026-10-19
// @author       crva
// @match        https://soundcloud.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=soundcloud.com
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @connect      sndcdn.com
// ==/UserScript==


(function () {
  'use strict';

  function getImageUrl(container) {
    const span = container.querySelector('.image__full');
    if (!span) return null;
    const match = span.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    return match ? match[1] : null;
  }

  function fetchBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'blob',
        onload: (r) => (r.status === 200 ? resolve(r.response) : reject(r.status)),
        onerror: reject,
      });
    });
  }

  function saveBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function downloadCover(url, title, btn) {
    const candidates = [];
    // Normal artwork (i1.sndcdn.com) has an "original" full-size version
    if (/-t\d+x\d+\./.test(url)) {
      candidates.push(url.replace(/-t\d+x\d+\.\w+/, '-original.jpg'));
      candidates.push(url.replace(/-t\d+x\d+\.\w+/, '-original.png'));
      candidates.push(url.replace(/-t\d+x\d+\./, '-t500x500.'));
    }
    candidates.push(url);

    const safeName = (title || 'cover').replace(/[\\/:*?"<>|]/g, '_').trim();
    btn.textContent = 'Downloading…';

    for (const u of candidates) {
      try {
        const blob = await fetchBlob(u);
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        saveBlob(blob, `${safeName}.${ext}`);
        btn.textContent = 'Download cover';
        return;
      } catch (e) {
        // try the next one
      }
    }
    btn.textContent = 'Download failed';
  }

  function addButton(container) {
    if (container.dataset.coverBtn) return;
    const url = getImageUrl(container);
    if (!url) return;
    container.dataset.coverBtn = '1';

    const title = container.querySelector('h2')?.textContent;
    const btn = document.createElement('button');
    btn.className = 'sc-button sc-button-medium';
    btn.textContent = 'Download cover';
    btn.style.marginTop = '12px';
    btn.addEventListener('click', () => downloadCover(getImageUrl(container) || url, title, btn));

    const image = container.querySelector('.image');
    (image || container).after(btn);
  }

  new MutationObserver(() => {
    document.querySelectorAll('.imageContent').forEach(addButton);
  }).observe(document.body, { childList: true, subtree: true });
})();
