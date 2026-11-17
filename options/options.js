import { api, G, loadSettings, save, onSettings, setSeg, bindSeg, number } from '../ui/ui.js';
import { readStats, resetStats, barList, weekBars, KIND_NAMES } from '../ui/stats.js';

const $ = (id) => document.getElementById(id);
let S = await loadSettings();

function draw() {
  document.body.classList.toggle('is-off', !S.enabled);
  $('enabled').checked = S.enabled;
  $('power-word').textContent = S.enabled ? 'On' : 'Off';
  setSeg($('frame'), S.frame);
  setSeg($('tag'), S.tag);
  $('badge').checked = S.badge;
  $('updates').checked = S.updates !== false;
  $('sample-tag').textContent = S.tag;
  $('sample').style.setProperty('--sample-frame', (G.FRAMES[S.frame] || G.FRAMES.sunset)[0]);
  $('blur').value = S.blur;
  $('blur-out').textContent = `${S.blur} px`;
  $('sample').style.setProperty('--sample-blur', `${S.blur}px`);
  for (const input of $('level').querySelectorAll('input')) input.checked = input.value === S.level;
  for (const key of ['hidePages', 'muteMedia', 'maskTitle']) $(key).checked = S[key];
  setSeg($('reveal'), S.reveal);
  if (document.activeElement !== $('extra')) $('extra').value = S.extraTerms.join('\n');
  drawSources();
  drawSites();
}

function row(name, kind, control) {
  const li = document.createElement('li');
  const n = document.createElement('span');
  n.className = 'name';
  n.textContent = name;
  const k = document.createElement('span');
  k.className = 'kind mono';
  k.textContent = kind;
  li.append(n, k, control);
  return li;
}

function removeButton(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Remove';
  b.setAttribute('aria-label', `Remove ${label}`);
  b.addEventListener('click', onClick);
  return b;
}

const KIND = { site: 'Site', handle: 'Handle, on any site', sub: 'Subreddit' };
const sameSource = (a, b) => G.parseSource(a)?.value.toLowerCase() === G.parseSource(b)?.value.toLowerCase();

function drawSources() {
  const presets = $('presets');
  presets.replaceChildren();
  for (const p of G.PRESETS) {
    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = S.sources.some((v) => sameSource(v, p.value));
    input.setAttribute('aria-label', p.name);
    input.addEventListener('change', () => {
      const rest = S.sources.filter((v) => !sameSource(v, p.value));
      set({ sources: input.checked ? [...rest, p.value] : rest });
    });
    const track = document.createElement('span');
    track.className = 'track';
    track.append(Object.assign(document.createElement('span'), { className: 'knob' }));
    label.append(input, track);
    presets.append(row(p.name, p.kind, label));
  }
  const own = $('sources');
  own.replaceChildren();
  for (const value of S.sources) {
    if (G.PRESETS.some((p) => sameSource(p.value, value))) continue;
    const parsed = G.parseSource(value);
    if (!parsed) continue;
    own.append(row(parsed.value, KIND[parsed.kind], removeButton(parsed.value, () => set({ sources: S.sources.filter((v) => v !== value) }))));
  }
}

function drawSites() {
  const list = $('sites');
  list.replaceChildren();
  for (const host of S.offSites) {
    list.append(row(host, '', removeButton(host, () => set({ offSites: S.offSites.filter((h) => h !== host) }))));
  }
  const name = document.createElement('b');
  name.className = 'bold-name';
  name.textContent = 'No Wanted';
  $('sites-empty').replaceChildren(name, S.offSites.length
    ? ' is switched off on these sites'
    : ' runs on every site. Add one here to switch it off there');
}

function set(patch) {
  S = { ...S, ...patch };
  save(patch);
  draw();
}

$('enabled').addEventListener('change', (e) => set({ enabled: e.target.checked }));
$('blur').addEventListener('input', (e) => {
  S.blur = Number(e.target.value);
  $('blur-out').textContent = `${S.blur} px`;
  $('sample').style.setProperty('--sample-blur', `${S.blur}px`);
});
$('blur').addEventListener('change', (e) => set({ blur: Number(e.target.value) }));
$('level').addEventListener('change', (e) => set({ level: e.target.value }));
for (const key of ['hidePages', 'muteMedia', 'maskTitle']) {
  $(key).addEventListener('change', (e) => set({ [key]: e.target.checked }));
}
bindSeg($('reveal'), (reveal) => set({ reveal }));
bindSeg($('frame'), (frame) => set({ frame }));
bindSeg($('tag'), (tag) => set({ tag }));
$('badge').addEventListener('change', (e) => set({ badge: e.target.checked }));
$('updates').addEventListener('change', (e) => set({ updates: e.target.checked }));

// The date on the rules file in use, and the Support link when there is one.
async function drawRules() {
  const { rules } = await api.storage.local.get('rules');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rules?.updated || '') ? new Date(`${rules.updated}T12:00:00`) : null;
  $('rules-date').textContent = day ? `Using the rules from ${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : '';
}
drawRules();
api.storage.onChanged.addListener((changes, area) => area === 'local' && changes.rules && drawRules());
if (G.SUPPORT_URL) {
  $('support').href = G.SUPPORT_URL;
  $('support').hidden = false;
}

let typing = 0;
$('extra').addEventListener('input', (e) => {
  clearTimeout(typing);
  typing = setTimeout(() => {
    const extraTerms = [...new Set(e.target.value.split('\n').map((t) => t.trim()).filter(Boolean))].slice(0, 200);
    S.extraTerms = extraTerms;
    save({ extraTerms });
  }, 400);
});

$('add-site').addEventListener('submit', (e) => {
  e.preventDefault();
  let text = $('new-site').value.trim().toLowerCase();
  if (!text) return;
  try {
    text = new URL(text.includes('://') ? text : `https://${text}`).hostname;
  } catch {
    return;
  }
  const host = G.siteOf(text);
  $('new-site').value = '';
  if (host && !S.offSites.includes(host)) set({ offSites: [...S.offSites, host] });
});

$('add-source').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('new-source').value.trim();
  if (!text) return;
  const parsed = G.parseSource(text);
  if (!parsed) {
    $('source-error').textContent = 'That is not a link, an @handle or an r/subreddit';
    return;
  }
  $('source-error').textContent = '';
  $('new-source').value = '';
  if (!S.sources.some((v) => sameSource(v, parsed.value))) set({ sources: [...S.sources, parsed.value] });
});
$('new-source').addEventListener('input', () => ($('source-error').textContent = ''));

// One highlight for the radio list, gliding to the row under the pointer.
const choices = $('level');
const glide = choices.querySelector('.glide');
for (const row of choices.querySelectorAll('.choice')) {
  row.addEventListener('pointerenter', () => {
    const moving = choices.classList.contains('hovering');
    if (!moving) glide.style.transitionProperty = 'opacity';
    glide.style.setProperty('--y', `${row.offsetTop}px`);
    glide.style.setProperty('--h', `${row.offsetHeight}px`);
    choices.classList.add('hovering');
    if (!moving) requestAnimationFrame(() => (glide.style.transitionProperty = ''));
  });
}
choices.addEventListener('pointerleave', () => choices.classList.remove('hovering'));

// ---- stats ----
async function drawStats() {
  const st = await readStats();
  document.querySelector('section.stats').classList.toggle('no-stats', !st.total);
  $('s-total').textContent = number(st.total);
  $('s-since').textContent = st.total ? `Since ${st.since}. Counted only in this browser` : 'Nothing blocked yet. Counted only in this browser';
  $('s-today').textContent = number(st.today);
  $('s-week').textContent = number(st.week);
  weekBars($('s-days'), st.last7);
  barList($('s-kinds'), st.kinds, (k) => KIND_NAMES[k] || k, 'Nothing yet');
  barList($('s-sites'), st.sites, (k) => k, 'Nothing yet');
}
let resetAsk = 0;
$('reset-stats').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  if (!resetAsk) {
    b.textContent = 'Reset all stats?';
    resetAsk = setTimeout(() => { resetAsk = 0; b.textContent = 'Reset'; }, 3000);
    return;
  }
  clearTimeout(resetAsk);
  resetAsk = 0;
  b.textContent = 'Reset';
  await resetStats();
});
api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.total || changes.stats)) drawStats();
});
drawStats();

$('version').textContent = api.runtime.getManifest().version;
onSettings((next) => {
  S = next;
  draw();
});
draw();
