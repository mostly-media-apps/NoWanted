// Keeps the toolbar count for each tab and the running total.
const api = globalThis.browser ?? globalThis.chrome;

const perTab = new Map(); // tabId -> Map(frameId -> count)
let pending = null;
let saving = Promise.resolve();

let badge = true;
api.storage.sync.get({ badge: true }).then((v) => { badge = v.badge; }).catch(() => {});
api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.badge) return;
  badge = changes.badge.newValue !== false;
  for (const tabId of perTab.keys()) showCount(tabId);
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
  const tabId = sender.tab?.id;
  if (tabId == null) return;
  if (msg.type === 'count') {
    if (RULES_URL && (rulesNext === null || Date.now() >= rulesNext)) refreshRules();
    if (!perTab.has(tabId)) perTab.set(tabId, new Map());
    perTab.get(tabId).set(sender.frameId ?? 0, msg.n || 0);
    showCount(tabId);
    if (msg.added && typeof msg.added === 'object') addToTotal(msg.added, msg.site);
  } else if (msg.type === 'closeTab') {
    api.tabs.remove(tabId).catch(() => {});
  }
});

api.tabs.onRemoved.addListener((tabId) => perTab.delete(tabId));

api.runtime.onInstalled.addListener(() => {
  api.action.setBadgeBackgroundColor({ color: '#232325' }).catch(() => {});
  api.action.setBadgeTextColor?.({ color: '#ededed' })?.catch?.(() => {});
});

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

function cleanRules(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) return null;
  const strings = (v, max, len) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim() && s.length <= len).slice(0, max) : []);
  const one = (s) => (typeof s === 'string' && s.trim() && s.length <= 400 ? s : null);
  const sites = {};
  if (raw.sites && typeof raw.sites === 'object' && !Array.isArray(raw.sites)) {
    for (const [host, v] of Object.entries(raw.sites).slice(0, 100)) {
      if (!/^[a-z0-9.-]{3,80}$/.test(host) || !v || typeof v !== 'object') continue;
      sites[host] = { cards: strings(v.cards, 60, 200), signals: strings(v.signals, 20, 200), keep: one(v.keep), by: one(v.by), comments: one(v.comments) };
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
