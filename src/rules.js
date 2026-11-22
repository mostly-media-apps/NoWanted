// Shared list of per-site adapter keys in the daily rules file, used by both
// background.js (when cleaning a downloaded file) and sites.js (when applying it).
(() => {
  const G = (globalThis.GSB = globalThis.GSB || {});
  G.SITE_LIST_KEYS = ['cards', 'signals'];
  G.SITE_SEL_KEYS = ['keep', 'by', 'comments', 'blocks', 'plain', 'live', 'leave', 'whole', 'main', 'thread'];
  G.SITE_KEYS = [...G.SITE_LIST_KEYS, ...G.SITE_SEL_KEYS, 'rows', 'off', 'noHide'];
})();
