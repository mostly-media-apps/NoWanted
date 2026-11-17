// Shared by the popup and the settings page: read and write settings, and
// wire the two controls (switch and segmented choice) to them.
const api = globalThis.browser ?? globalThis.chrome;
const G = globalThis.GSB;

export async function loadSettings() {
  return { ...G.DEFAULTS, ...(await api.storage.sync.get(G.DEFAULTS)) };
}

export function save(patch) {
  return api.storage.sync.set(patch);
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
