// Keeps the toolbar count for each tab and the running total.
if (!globalThis.GSB?.SITE_KEYS && typeof importScripts === 'function') importScripts('rules.js');
const api = globalThis.browser ?? globalThis.chrome;

const perTab = new Map(); // tabId -> Map(frameId -> count)
let pending = null;
let saving = Promise.resolve();

let badge = true;
api.storage.sync.get({ badge: true }).then((v) => { badge = v.badge; }).catch(() => {});

// Track numeric tabIds where our content script has connected (no URLs or
// hostnames), persisted in local storage so it survives extension reloads and
// store updates. When a setting changes, connected tabs apply it live through
// storage.onChanged; only tabs whose content script is orphaned are reloaded
// so the new setting actually takes effect there.
const KNOWN_TABS_MAX = 200;
let knownTabs = null;
let knownTabsLoading = null;
let knownTabsQueued = false;

function loadKnownTabs() {
  if (knownTabs) return Promise.resolve(knownTabs);
  if (!knownTabsLoading) {
    knownTabsLoading = api.storage.local.get('knownTabs').then((v) => {
      knownTabs = new Set(Array.isArray(v?.knownTabs) ? v.knownTabs.filter((id) => Number.isInteger(id)) : []);
      return knownTabs;
    }, () => {
      knownTabs = new Set();
      return knownTabs;
    });
  }
  return knownTabsLoading;
}

function saveKnownTabsSoon() {
  if (knownTabsQueued || !knownTabs) return;
  knownTabsQueued = true;
  Promise.resolve().then(() => {
    knownTabsQueued = false;
    const list = [...knownTabs].slice(-KNOWN_TABS_MAX);
    knownTabs = new Set(list);
    api.storage.local.set({ knownTabs: list }).catch(() => {});
  });
}

function rememberTab(tabId) {
  if (!Number.isInteger(tabId)) return;
  loadKnownTabs().then((set) => {
    if (set.has(tabId)) return;
    set.add(tabId);
    saveKnownTabsSoon();
  });
}

function forgetTab(tabId) {
  loadKnownTabs().then((set) => {
    if (set.delete(tabId)) saveKnownTabsSoon();
  });
}

// Only a tab that was connected before this copy of the extension was
// installed, updated or reloaded can be orphaned. A tab that cannot answer for
// any other reason (a store page, a tab the system unloaded) is never
// reloaded, and no tab is reloaded twice for the same update.
api.runtime.onInstalled.addListener(() => {
  loadKnownTabs().then((set) => api.storage.local.set({ staleTabs: [...set] })).catch(() => {});
});

let reloadCheck = Promise.resolve();
let popupChangeTabId = null; // tabId of the popup that triggered the next setting change
function reloadStaleTabs() {
  const fromPopupTabId = popupChangeTabId;
  popupChangeTabId = null;
  reloadCheck = reloadCheck.then(async () => {
    const stored = await api.storage.local.get('staleTabs').catch(() => null);
    const stale = new Set(Array.isArray(stored?.staleTabs) ? stored.staleTabs : []);
    if (!stale.size) return 0;
    const known = await loadKnownTabs();
    const tabs = await api.tabs.query({}).catch(() => null);
    if (!tabs) return 0;
    const liveIds = new Set(tabs.map((t) => t.id).filter((id) => Number.isInteger(id)));
    let pruned = false;
    for (const id of [...known]) {
      if (!liveIds.has(id)) { known.delete(id); pruned = true; }
    }
    if (pruned) saveKnownTabsSoon();
    // Never auto-reload a tab that is audible (tab.audible) or is the active
    // tab of a window the person could be typing in unless the change came
    // from that tab's own popup; the popup's "Reload this tab" button handles
    // any skipped active tab.
    const candidates = tabs.filter((t) =>
      stale.has(t.id) && !t.discarded && !t.audible && t.status !== 'loading'
      && (!t.active || t.id === fromPopupTabId));
    let reloaded = 0;
    await Promise.allSettled(candidates.map(async (t) => {
      stale.delete(t.id); // it answers or it is reloaded: either way it is asked once
      try {
        const res = await api.tabs.sendMessage(t.id, { type: 'ping' }, { frameId: 0 });
        if (res?.ok) return;
      } catch {
        // orphaned
      }
      try {
        await api.tabs.reload(t.id);
        reloaded++;
      } catch {}
    }));
    for (const id of stale) if (!liveIds.has(id)) stale.delete(id);
    await api.storage.local.set({ staleTabs: [...stale] }).catch(() => {});
    return reloaded;
  }).catch(() => 0);
  return reloadCheck;
}

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.badge) {
    badge = changes.badge.newValue !== false;
    for (const tabId of perTab.keys()) showCount(tabId);
  }
  const pageKeys = Object.keys(changes).filter((k) => k !== 'badge' && k !== 'ended');
  if (pageKeys.length) reloadStaleTabs();
});

function showCount(tabId) {
  const frames = perTab.get(tabId);
  let n = 0;
  if (frames) for (const v of frames.values()) n += v;
  const text = !badge || n === 0 ? '' : n > 999 ? '999+' : String(n);
  api.action.setBadgeText({ tabId, text }).catch(() => {});
}

// Stats, kept only in this browser: the running total, a count per day
// (the last 120 days), per kind and per site.
const KINDS = ['video', 'post', 'comment', 'mention', 'page'];

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function addToTotal(counts, site) {
  const added = KINDS.map(k => [k, Number(counts?.[k]) || 0]).filter(([, n]) => n > 0);
  const total = added.reduce((sum, [, n]) => sum + n, 0);
  if (!total) return;
  if (!pending) {
    const batch = { total: 0, kinds: {}, sites: {} };
    pending = batch;
    saving = saving.then(() => {
      if (pending === batch) pending = null;
      return saveStats(batch);
    }).catch(() => {});
  }
  pending.total += total;
  for (const [k, n] of added) pending.kinds[k] = (pending.kinds[k] || 0) + n;
  if (site) pending.sites[site] = (pending.sites[site] || 0) + total;
}

async function saveStats(batch) {
  const { total = 0, stats = {} } = await api.storage.local.get(['total', 'stats']);
  const days = stats.days || {};
  const today = dayKey();
  days[today] = (days[today] || 0) + batch.total;
  const keep = Object.keys(days).sort().slice(-120);
  const kinds = stats.kinds || {};
  for (const [k, v] of Object.entries(batch.kinds)) kinds[k] = (kinds[k] || 0) + v;
  const sites = stats.sites || {};
  for (const [k, v] of Object.entries(batch.sites)) sites[k] = (sites[k] || 0) + v;
  // Only the 200 busiest sites are kept.
  const topSites = Object.fromEntries(Object.entries(sites).sort((a, b) => b[1] - a[1]).slice(0, 200));
  await api.storage.local.set({
    total: total + batch.total,
    stats: { since: stats.since || today, days: Object.fromEntries(keep.map((k) => [k, days[k]])), kinds, sites: topSites },
  });
}

api.runtime.onMessage.addListener((msg, sender, respond) => {
  if (!msg) return;
  if (msg.type === 'resetStats') {
    // Counts arriving after Reset belong to a new batch, behind the reset.
    pending = null;
    const reset = saving.then(() => api.storage.local.set({ total: 0, stats: {} }));
    saving = reset.catch(() => {});
    reset.then(() => respond(true), () => respond(false));
    return true;
  }
  if (msg.type === 'rememberTab' && Number.isInteger(msg.tabId)) {
    rememberTab(msg.tabId);
    return;
  }
  if (msg.type === 'popupSettingChange' && Number.isInteger(msg.tabId)) {
    popupChangeTabId = msg.tabId;
    rememberTab(msg.tabId);
    return;
  }
  if (msg.type === 'pick') {
    const targetTab = Number.isInteger(msg.tabId) ? msg.tabId : sender.tab?.id;
    if (targetTab != null) api.tabs.sendMessage(targetTab, { type: 'pick', on: !!msg.on }).catch(() => {});
    return;
  }
  const tabId = sender.tab?.id;
  if (tabId == null) return;
  if (msg.type === 'veilAssets') {
    loadVeilAssets().then(respond, () => respond(null));
    return true;
  }
  if (msg.type === 'menuTarget') return void nameMenu(!!msg.hidden);
  if (msg.type === 'cover') return void tellFrames(tabId, msg.on);
  if (msg.type === 'coverAsk') {
    // Only the page itself knows; a sleeping worker has nothing to remember.
    api.tabs.sendMessage(tabId, { type: 'coverQuery' }, { frameId: 0 }).then((v) => respond(!!v?.on), () => respond(false));
    return true;
  }
  if (msg.type === 'count') {
    if (RULES_URL && (rulesNext === null || Date.now() >= rulesNext)) refreshRules();
    rememberTab(tabId);
    if (!perTab.has(tabId)) perTab.set(tabId, new Map());
    perTab.get(tabId).set(sender.frameId ?? 0, msg.n || 0);
    showCount(tabId);
    if (msg.added && typeof msg.added === 'object') addToTotal(msg.added, msg.site);
  } else if (msg.type === 'closeTab') {
    api.tabs.remove(tabId).catch(() => {});
  }
});

api.tabs.onRemoved.addListener((tabId) => {
  perTab.delete(tabId);
  forgetTab(tabId);
});

// ---------- the right-click menu ----------
// One entry. What it does is decided by the page, which knows what is under
// the pointer: something hidden is shown ("This is not a spoiler"), anything
// else is hidden. With two entries the wrong one could be on the menu, because
// this worker may be asleep when the menu opens and the page's note about what
// is under the pointer can arrive after it. With one entry only its words can
// lag: they say both until the note arrives, and then the one that applies.
// Nothing is sent anywhere. Browsers without this menu (Safari on iPhone)
// simply have none.
const MENU = {
  entries: { act: {} },
  any: 'Hide or show this with No Wanted',
  hide: 'Hide this with No Wanted',
  show: 'This is not a spoiler',
};
const MENU_WORDS_MS = 4000; // exact words are for the menu being opened now, not for the next one
const menuTitle = (hidden) => (hidden === true ? MENU.show : hidden === false ? MENU.hide : MENU.any);
function buildMenu() {
  if (!api.contextMenus?.create) return;
  try {
    api.contextMenus.removeAll(() => {
      api.contextMenus.create({ id: 'nw-act', title: MENU.any, contexts: ['all'], documentUrlPatterns: ['http://*/*', 'https://*/*'] }, () => void api.runtime.lastError);
    });
  } catch {
    // no menu in this browser
  }
}
api.runtime.onInstalled.addListener(buildMenu);
api.runtime.onStartup?.addListener(buildMenu);
api.contextMenus?.onClicked?.addListener((info, tab) => {
  if (info.menuItemId !== 'nw-act' || tab?.id == null) return;
  api.tabs.sendMessage(tab.id, { type: 'menuAction' }, { frameId: info.frameId ?? 0 }).catch(() => {});
  nameMenu(null);
});
let menuWords = 0;
function nameMenu(hidden) {
  if (!api.contextMenus?.update) return;
  clearTimeout(menuWords);
  try {
    api.contextMenus.update('nw-act', { title: menuTitle(hidden) }, () => void api.runtime.lastError);
  } catch {
    // the entry is not there yet
  }
  if (hidden !== null) menuWords = setTimeout(() => nameMenu(null), MENU_WORDS_MS);
}

// ---------- a covered page and the frames in it ----------
// The cover is drawn by the page itself (the top frame). A player embedded
// from another site lives in a frame of its own, which cannot see the cover,
// so the page says "covered" or "shown" here and every frame of that tab is
// told. A frame that arrives later asks, and the answer comes from the page.
function tellFrames(tabId, on) {
  api.tabs.sendMessage(tabId, { type: 'cover', on: !!on }).catch(() => {});
}

api.runtime.onInstalled.addListener(() => {
  api.action.setBadgeBackgroundColor({ color: '#232325' }).catch(() => {});
  api.action.setBadgeTextColor?.({ color: '#ededed' })?.catch?.(() => {});
});

// Cover artwork and display font, read inside the extension's own origin so
// content scripts never load chrome-extension:// URLs in a web page's context.
let veilAssetsPromise = null;
function bytesToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}
function loadVeilAssets() {
  return (veilAssetsPromise ??= Promise.all([
    fetch(api.runtime.getURL('art/scene.svg')).then((r) => (r.ok ? r.text() : '')),
    fetch(api.runtime.getURL('fonts/anton-latin-400-normal.woff2')).then((r) => (r.ok ? r.arrayBuffer() : null)),
  ]).then(([svg, buf]) => ({
    svg,
    font: buf ? bytesToBase64(buf) : '',
  })).catch(() => {
    veilAssetsPromise = null;
    return null;
  }));
}

// ---------- the daily rules file ----------
// New words, always-blur accounts and per-site selectors, so a site's redesign
// or a new leak account can be handled without waiting for a store update.
// It is data only: plain words, names, hosts and CSS selectors. Nothing in it
// is run, and nothing is sent with the request (no cookies, no ids).
const RULES_URL = 'https://nowanted.online/rules.json'; // empty means no request is ever made
const RULES_EVERY = 24 * 60 * 60 * 1000;
const RULES_RETRY = 60 * 60 * 1000;
const RULES_MAX_BYTES = 100 * 1024;
let rulesNext = null; // when the next check is due; null until read from storage

const SITE_LIST_LIMITS = { cards: [60, 200], signals: [20, 200] };

function cleanRules(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) return null;
  const strings = (v, max, len) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim() && s.length <= len).slice(0, max) : []);
  const one = (s) => (typeof s === 'string' && s.trim() && s.length <= 400 ? s : null);
  const { SITE_LIST_KEYS, SITE_SEL_KEYS } = globalThis.GSB;
  const sites = {};
  if (raw.sites && typeof raw.sites === 'object' && !Array.isArray(raw.sites)) {
    for (const [host, v] of Object.entries(raw.sites).slice(0, 100)) {
      if (!/^[a-z0-9.-]{3,80}$/.test(host) || !v || typeof v !== 'object') continue;
      const entry = {};
      for (const key of SITE_LIST_KEYS) {
        const [max, len] = SITE_LIST_LIMITS[key] || [20, 200];
        entry[key] = strings(v[key], max, len);
      }
      for (const key of SITE_SEL_KEYS) entry[key] = one(v[key]);
      entry.rows = Array.isArray(v.rows)
        ? v.rows.slice(0, 30).reduce((acc, r) => {
          if (!r || typeof r !== 'object') return acc;
          const within = one(r.in);
          if (!within) return acc;
          const only = r.only == null ? null : one(r.only);
          if (r.only != null && !only) return acc;
          acc.push({ in: within, only, open: r.open === true });
          return acc;
        }, [])
        : [];
      entry.off = strings(v.off, 50, 120).filter((p) => p.startsWith('/'));
      entry.noHide = typeof v.noHide === 'boolean' ? v.noHide : null;
      sites[host] = entry;
    }
  }
  return {
    version: 1,
    updated: typeof raw.updated === 'string' ? raw.updated.slice(0, 10) : '',
    words: strings(raw.words, 200, 60),
    sources: strings(raw.sources, 200, 120),
    off: strings(raw.off, 100, 80),
    sites,
  };
}

async function refreshRules(url = RULES_URL, force = false) {
  if (!url) return null;
  const { updates } = await api.storage.sync.get({ updates: true });
  if (updates === false) return null;
  if (rulesNext === null) {
    const saved = await api.storage.local.get('rulesNext');
    rulesNext ??= saved.rulesNext || 0;
  }
  if (!force && Date.now() < rulesNext) return null;
  rulesNext = Date.now() + RULES_RETRY; // one request at a time, and an hour before another try
  await api.storage.local.set({ rulesNext });
  try {
    const res = await fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > RULES_MAX_BYTES) return null;
    const rules = cleanRules(JSON.parse(text));
    if (!rules) return null;
    rulesNext = Date.now() + RULES_EVERY;
    await api.storage.local.set({ rules, rulesNext });
    return rules;
  } catch {
    return null; // offline or a bad file: the last good rules stay
  }
}

api.runtime.onInstalled.addListener(() => refreshRules());
api.runtime.onStartup?.addListener(() => refreshRules());
