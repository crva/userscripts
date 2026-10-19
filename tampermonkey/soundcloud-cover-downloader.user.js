// ==UserScript==
// @name         SoundCloud cover downloader
// @namespace    https://github.com/crva/userscripts
// @description  Shows a "Download cover" button when you hover any cover art on SoundCloud
// @version      2026-10-19.1
// @author       crva
// @homepageURL  https://github.com/crva/userscripts
// @supportURL   https://github.com/crva/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/crva/userscripts/main/tampermonkey/soundcloud-cover-downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/crva/userscripts/main/tampermonkey/soundcloud-cover-downloader.user.js
// @match        https://soundcloud.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=soundcloud.com
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @connect      sndcdn.com
// ==/UserScript==

(function () {
  'use strict';

  const MIN_SIZE = 120; // ignore tiny thumbnails (px)
  // artworks- = regular track/playlist covers (i1.sndcdn.com)
  // labs-     = generated covers of system playlists like "Daily Drops" (al.sndcdn.com)
  const ART_RE = /sndcdn\.com\/(?:artworks|labs)-/;

  // ---------- cover detection ----------

  // Returns the artwork URL of an element, whether it's an <img> (new track page)
  // or a span with an inline background-image (playlist preview / old layout).
  function getCoverUrl(el) {
    if (el.tagName === 'IMG') {
      const src = el.currentSrc || el.src;
      return ART_RE.test(src) ? src : null;
    }
    const bg = el.style && el.style.backgroundImage;
    if (bg && bg.includes('sndcdn.com')) {
      const m = bg.match(/url\(["']?(.*?)["']?\)/);
      if (m && ART_RE.test(m[1])) return m[1];
    }
    return null;
  }

  // Uses elementsFromPoint so it still works when an overlay div sits on top of the image.
  function findCoverAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === btn) continue;
      if (!getCoverUrl(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= MIN_SIZE && r.height >= MIN_SIZE) return el;
    }
    return null;
  }

  function getTitle(el, url) {
    if (el.alt) return el.alt.trim();
    const h2 = el.closest('.imageContent')?.querySelector('h2')?.textContent;
    if (h2) return h2.trim();
    const label = el.getAttribute('aria-label');
    if (label) return label.trim();
    const id = url.match(/(?:artworks|labs)-([^./?]+?)-t\d+x\d+/);
    return id ? id[1] : 'cover';
  }

  // ---------- download ----------

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
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function downloadCover(url, title) {
    const candidates = [];
    if (/-t\d+x\d+\./.test(url)) {
      candidates.push(url.replace(/-t\d+x\d+\.\w+/, '-original.jpg'));
      candidates.push(url.replace(/-t\d+x\d+\.\w+/, '-original.png'));
      candidates.push(url.replace(/-t\d+x\d+\./, '-t500x500.'));
    }
    candidates.push(url);

    const safeName = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'cover';
    btn.textContent = 'Downloading…';
    btn.disabled = true;

    for (const u of candidates) {
      try {
        const blob = await fetchBlob(u);
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        saveBlob(blob, `${safeName}.${ext}`);
        resetButton();
        return;
      } catch (e) {
        // try the next candidate
      }
    }
    btn.textContent = 'Download failed';
    setTimeout(resetButton, 2000);
  }

  // ---------- floating button ----------

  const btn = document.createElement('button');
  btn.type = 'button';
  Object.assign(btn.style, {
    position: 'fixed',
    zIndex: '1099',
    display: 'none',
    padding: '6px 10px',
    font: '600 12px/1.2 Inter, "Helvetica Neue", Arial, sans-serif',
    color: '#fff',
    background: 'rgba(0, 0, 0, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: '4px',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  });
  document.documentElement.appendChild(btn);

  function resetButton() {
    btn.textContent = '⬇ Download cover';
    btn.disabled = false;
  }
  resetButton();

  let current = null; // cover element currently hovered

  function show(el) {
    current = el;
    const r = el.getBoundingClientRect();
    btn.style.display = 'block';
    btn.style.top = `${r.top + 8}px`;
    btn.style.left = `${r.right - btn.offsetWidth - 8}px`;
  }

  function hide() {
    if (btn.disabled) return; // keep visible while downloading
    current = null;
    btn.style.display = 'none';
  }

  function inside(el, x, y) {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  let pending = false;
  document.addEventListener('mousemove', (e) => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const { clientX: x, clientY: y } = e;
      if (current && current.isConnected && inside(current, x, y)) {
        show(current);
        return;
      }
      const el = findCoverAt(x, y);
      el ? show(el) : hide();
    });
  }, { passive: true });

  document.addEventListener('scroll', hide, { capture: true, passive: true });
  document.addEventListener('mouseleave', hide);

  // Block the click from reaching the cover (which would play the track / open the preview)
  ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach((t) =>
    btn.addEventListener(t, (e) => e.stopPropagation())
  );
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!current || btn.disabled) return;
    const url = getCoverUrl(current);
    if (url) downloadCover(url, getTitle(current, url));
  });
})();
