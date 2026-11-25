// Shared by the popup and the settings page: read and write settings, and
// wire the two controls (switch and segmented choice) to them.
const api = globalThis.browser ?? globalThis.chrome;
const G = globalThis.GSB;

export async function loadSettings() {
  return { ...G.DEFAULTS, ...(await api.storage.sync.get(G.DEFAULTS)) };
}

// The browser's synced storage holds 8,192 bytes per setting and 102,400 in
// all. A list that would not fit is cut to what does, so a long list is never
// lost whole, and the page is told (see onSaved) so it can say so. A save the
// browser refuses is told the same way.
const LIST_BYTES = 7600;
const LISTS = ['extraTerms', 'sources', 'offSites', 'onSites'];
const bytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;
export function fitList(list) {
  const out = [];
  let size = 2;
  for (const v of list) {
    const n = bytes(v) + 1;
    if (size + n > LIST_BYTES) break;
    out.push(v);
    size += n;
  }
  return out;
}

const savedListeners = [];
export const onSaved = (fn) => savedListeners.push(fn);
const tell = (result) => savedListeners.forEach((fn) => fn(result));

// also: how many entries the page itself left out before saving (a list's own limit)
export async function save(patch, also = 0) {
  const fitted = { ...patch };
  let dropped = also;
  for (const key of LISTS) {
    if (!Array.isArray(fitted[key])) continue;
    const kept = fitList(fitted[key]);
    dropped += fitted[key].length - kept.length;
    fitted[key] = kept;
  }
  try {
    await api.storage.sync.set(fitted);
    tell({ ok: true, dropped });
    return true;
  } catch (e) {
    const why = String(e?.message || e || '');
    tell({ ok: false, full: /quota|QUOTA_BYTES|MAX_ITEMS/i.test(why) && !/PER_MINUTE|PER_HOUR/i.test(why), busy: /PER_MINUTE|PER_HOUR/i.test(why) });
    return false;
  }
}

// The words for what onSaved reports, or '' when there is nothing to say.
export function saveNote(result) {
  if (result.ok) {
    return result.dropped ? `The list is too long to keep in full. The last ${result.dropped} ${result.dropped === 1 ? 'entry was' : 'entries were'} not saved` : '';
  }
  if (result.full) return 'Not saved. The browser’s storage for settings is full: remove some words, sites or accounts, then try again';
  if (result.busy) return 'Not saved. The browser takes only so many changes a minute: try again shortly';
  return 'Not saved. The browser refused the change: try again';
}

export function onSettings(fn) {
  api.storage.onChanged.addListener(async (_changes, area) => {
    if (area === 'sync') fn(await loadSettings());
  });
}

export function setSeg(seg, value) {
  const inputs = [...seg.querySelectorAll('input')];
  const i = Math.max(0, inputs.findIndex((el) => el.value === value));
  inputs[i].checked = true;
  seg.style.setProperty('--i', i);
}

export function bindSeg(seg, onPick) {
  seg.addEventListener('change', (e) => {
    setSeg(seg, e.target.value);
    onPick(e.target.value);
  });
}

export const number = (n) => new Intl.NumberFormat('en-US').format(n);
export { api, G };
