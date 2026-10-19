// ==UserScript==
// @name         SoundCloud player bar on top
// @description  Moves the soundcloud player bar on top instead of bottom
// @version      2026-10-19
// @author       crva
// @match        https://soundcloud.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=soundcloud.com
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

GM_addStyle(`
  .playControls,
  .playControls__inner {
    top: 0 !important;
    bottom: auto !important;
  }
  .header {
    top: 48px !important;
  }
  body {
    padding-top: 48px !important;
  }
  .volume__sliderWrapper {
    top: 100% !important;
    bottom: auto !important;
    margin-top: 4px !important;
  }
`);
