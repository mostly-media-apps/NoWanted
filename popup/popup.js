import { api, G, loadSettings, save, onSettings, number } from '../ui/ui.js';
import { GLYPHS } from './glyphs.js';
import { readStats, barList, weekBars, KIND_NAMES } from '../ui/stats.js';

const $ = (id) => document.getElementById(id);

// The menu is drawn at 360x600, and 600 is the tallest a toolbar popup can be.
// With the browser zoomed past 100% the popup inherits the zoom, the window is
// capped at 600 real pixels, and the bottom of the phone (frame included) was
// cut off. When the window is smaller than the drawing, shrink the drawing to
// fit it, so the whole phone always shows at its own proportions.
const MENU = { width: 360, height: 600 };
function fitWindow() {
  // innerWidth/innerHeight follow the browser's zoom but not CSS zoom, so this
  // ratio stays the same after it is applied.
  const w = window.innerWidth, h = window.innerHeight;
  if (!w || !h) return;
  const fit = Math.min(1, w / MENU.width, h / MENU.height);
  const root = document.documentElement;
  if (Math.abs(fit - (Number(root.style.zoom) || 1)) > 0.005) root.style.zoom = fit === 1 ? '' : String(fit);
}
fitWindow();
window.addEventListener('resize', fitWindow);

// One app per platform. `profile` turns what someone types (a name, @name,
// or a pasted link) into the path of that account's page, which is what the
// always-blur list stores: "x.com/name", "youtube.com/@name" and so on.
// A pasted link must point at an account, not a post or a section of the
// site: `at` means account paths start with @ (or one of `dirs`), `only`
// means they always start with one of `dirs`, and `notAccounts` lists first
// path segments that are never an account. Without this, a pasted video link
// would block all of youtube.com/watch.
const APPS = [
  { id: 'x', name: 'X', color: '#000000', hosts: ['x.com', 'twitter.com'], prefix: '@', profile: (n) => `/${n}`, notAccounts: ['home', 'i', 'search', 'explore', 'notifications', 'messages', 'settings', 'compose', 'hashtag', 'intent', 'share'] },
  { id: 'youtube', name: 'YouTube', color: '#ff0033', hosts: ['youtube.com'], prefix: '@', profile: (n) => `/@${n}`, dirs: ['channel', 'c', 'user'], at: true },
  { id: 'instagram', name: 'Instagram', color: '#e1306c', hosts: ['instagram.com'], prefix: '@', profile: (n) => `/${n}`, notAccounts: ['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'direct'] },
  { id: 'tiktok', name: 'TikTok', color: '#000000', hosts: ['tiktok.com'], prefix: '@', profile: (n) => `/@${n}`, at: true },
  { id: 'reddit', name: 'Reddit', color: '#ff4500', hosts: ['reddit.com'], prefix: '', profile: (n) => `/user/${n}`, dirs: ['user', 'u', 'r'], only: true },
  { id: 'twitch', name: 'Twitch', color: '#9146ff', hosts: ['twitch.tv'], prefix: '', profile: (n) => `/${n}`, notAccounts: ['videos', 'directory', 'search', 'settings', 'downloads', 'p', 'subscriptions', 'inventory', 'wallet', 'drops'] },
  { id: 'facebook', name: 'Facebook', color: '#0866ff', hosts: ['facebook.com'], prefix: '', profile: (n) => `/${n}`, notAccounts: ['profile.php', 'people', 'pages', 'pg', 'watch', 'reel', 'reels', 'videos', 'photo', 'photo.php', 'story.php', 'stories', 'permalink.php', 'share', 'groups', 'events', 'marketplace', 'gaming', 'hashtag', 'search', 'home.php', 'login'] },
  { id: 'threads', name: 'Threads', color: '#000000', hosts: ['threads.com', 'threads.net'], prefix: '@', profile: (n) => `/@${n}`, at: true, dock: true },
  { id: 'bluesky', name: 'Bluesky', color: '#1185fe', hosts: ['bsky.app'], prefix: '@', profile: (n) => `/profile/${n.includes('.') ? n : n + '.bsky.social'}`, dirs: ['profile'], only: true },
];
const SOCIAL_HOSTS = APPS.flatMap((a) => a.hosts);
const WEB = { id: 'web', name: 'Websites', prefix: '' };
// The allow list: sites No Wanted leaves alone. The same list as Settings.
const ALLOW = { id: 'allow', name: 'Allowed', prefix: '' };
const PLAIN = ['web', 'allow'];

let S;
let site = null;
let onPage = null;
let open = null; // the app on screen, or null for the home screen

// ---- reading what was typed ----

const NAME = /^[a-z0-9_.\-]{1,60}$/i;
// Set when the last link was on the right site but not an account's page.
let notAccount = false;

function entryFor(app, text) {
  const t = text.trim();
  notAccount = false;
  if (!t) return null;
  if (app.id === 'allow') {
    let host;
    try {
      host = new URL(t.includes('://') ? t : `https://${t}`).hostname;
    } catch {
      return null;
    }
    host = G.siteOf(host);
    return host && host.includes('.') ? host : null;
  }
  if (app.id === 'web') {
    const p = G.parseSource(t);
    return p && p.kind === 'site' ? p.value : null;
  }
  if (app.id === 'reddit') {
    const sub = /^\/?r\/([a-z0-9_]{2,40})\/?$/i.exec(t);
    if (sub) return `r/${sub[1]}`;
    const user = /^\/?u(?:ser)?\/([a-z0-9_\-]{2,40})\/?$/i.exec(t);
    if (user) return `reddit.com/user/${user[1].toLowerCase()}`;
  }
  // A pasted link: keep only the part that names the account.
  if (/[/:]/.test(t) || (t.includes('.') && app.hosts.some((h) => t.toLowerCase().includes(h)))) {
    let u;
    try {
      u = new URL(t.includes('://') ? t : `https://${t}`);
    } catch {
      return null;
    }
    const host = G.siteOf(u.hostname).replace(/^(m|mobile)\./, '');
    if (!app.hosts.some((h) => host === h || host.endsWith('.' + h))) return null;
    const segs = u.pathname.split('/').filter(Boolean);
    if (!segs.length) return null;
    const first = segs[0].toLowerCase();
    const inDir = app.dirs?.includes(first);
    if ((app.only && !inDir) || (app.at && !inDir && !first.startsWith('@')) || app.notAccounts?.includes(first)) {
      notAccount = true;
      return null;
    }
    const take = inDir ? 2 : 1;
    if (segs.length < take) return null;
    if (app.id === 'reddit' && segs[0].toLowerCase() === 'r') return `r/${segs[1]}`;
    return `${app.hosts[0]}/${segs.slice(0, take).join('/')}`.toLowerCase();
  }
  const name = t.replace(/^@/, '');
  if (!NAME.test(name)) return null;
  if (app.id === 'reddit') return `r/${name}`;
  return `${app.hosts[0]}${app.profile(name)}`.toLowerCase();
}

// Which saved entries belong to an app, and how to show them.
function entriesOf(app) {
  if (app.id === 'allow') return S.offSites.map((host) => ({ value: host, shown: host }));
  const out = [];
  for (const value of S.sources) {
    const p = G.parseSource(value);
    if (!p) continue;
    if (app.id === 'web') {
      if (p.kind === 'site' && !SOCIAL_HOSTS.some((h) => p.host === h || p.host.endsWith('.' + h))) out.push({ value, shown: p.value });
      continue;
    }
    if (app.id === 'reddit' && p.kind === 'sub') {
      out.push({ value, shown: p.value });
      continue;
    }
    if (p.kind === 'site' && app.hosts.some((h) => p.host === h || p.host.endsWith('.' + h)) && p.path) {
      out.push({ value, shown: shownName(app, p.path) });
    }
  }
  return out;
}

function shownName(app, path) {
  const segs = path.split('/').filter(Boolean);
  const last = app.dirs?.includes(segs[0]) ? segs[1] : segs[0];
  if (app.id === 'reddit') return `u/${last}`;
  return app.prefix === '@' ? `@${last.replace(/^@/, '')}` : last.replace(/^@/, '');
}

const same = (a, b) => G.parseSource(a)?.value.toLowerCase() === G.parseSource(b)?.value.toLowerCase();

// ---- drawing ----

function glyph(app) {
  if (PLAIN.includes(app.id)) return document.querySelector(`[data-app="${app.id}"] svg`).cloneNode(true);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', GLYPHS[app.id]);
  svg.append(path);
  return svg;
}

function drawApps() {
  const grid = $('apps');
  if (!grid.childElementCount) {
    for (const app of APPS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'app';
      b.dataset.app = app.id;
      const tile = document.createElement('span');
      tile.className = 'tile';
      tile.style.background = app.color;
      const badge = document.createElement('span');
      badge.className = 'badge mono';
      tile.append(glyph(app), badge);
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = app.name;
      b.append(tile, label);
      if (app.dock) $('settings').before(b);
      else grid.append(b);
    }
  }
  for (const app of [...APPS, WEB, ALLOW]) {
    const n = entriesOf(app).length;
    const badge = document.querySelector(`[data-app="${app.id}"] .badge`);
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
    document.querySelector(`[data-app="${app.id}"]`).setAttribute('aria-label', n ? `${app.name}, ${n} ${app.id === 'allow' ? 'allowed' : 'blocked'}` : app.name);
  }
}

function drawHome() {
  document.body.classList.toggle('is-off', !S.enabled);
  $('enabled').checked = S.enabled;
  const offHere = site && S.offSites.some((h) => site === h || site.endsWith('.' + h));
  let line;
  if (!S.enabled) line = 'Off. Nothing is being hidden';
  else if (offHere) line = `Off on ${site}`;
  else if (onPage === null) line = site ? 'Reload this tab to start here' : 'Can’t run on this page';
  else line = `${number(onPage)} on this page`;
  $('count').textContent = line;
  drawApps();
}

function drawSheet() {
  if (!open || open === 'stats') return;
  const app = open;
  $('sheet-name').textContent = app.name;
  const tile = $('sheet-tile');
  tile.className = PLAIN.includes(app.id) ? 'tile plain' : 'tile';
  tile.style.background = app.color || '';
  tile.replaceChildren(glyph(app));
  $('prefix').textContent = app.prefix;
  const allow = app.id === 'allow';
  $('handle-label').textContent = allow ? 'Allow a website' : app.id === 'web' ? 'Block a website or page' : 'Block an account';
  $('handle').placeholder = allow ? 'example.com' : app.id === 'web' ? 'example.com/page' : app.id === 'reddit' ? 'r/subreddit or u/name' : 'name or a link';
  document.querySelector('#add button[type="submit"]').textContent = allow ? 'Allow' : 'Block';
  if (!$('note').classList.contains('error')) {
    $('note').textContent = allow
      ? 'Nothing is blurred or covered there. Settings shows the same list'
      : app.id === 'web'
      ? 'Visiting it covers the whole page, and links to it are hidden'
      : 'Everything they post is hidden, and their page is covered';
  }
  const list = $('blocked');
  list.replaceChildren();
  for (const e of entriesOf(app)) {
    const li = document.createElement('li');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = e.shown;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = allow ? 'Remove' : 'Unblock';
    b.setAttribute('aria-label', `${allow ? 'Remove' : 'Unblock'} ${e.shown}`);
    b.addEventListener('click', () => set(allow
      ? { offSites: S.offSites.filter((h) => h !== e.value) }
      : { sources: S.sources.filter((v) => v !== e.value) }));
    li.append(who, b);
    list.append(li);
  }
  $('empty').textContent = list.childElementCount ? '' : allow ? 'No websites allowed yet' : app.id === 'web' ? 'No websites blocked yet' : `No ${app.name} accounts blocked yet`;
}

function draw() {
  drawHome();
  drawSheet();
}

function set(patch) {
  S = { ...S, ...patch };
  save(patch);
  draw();
}

// ---- opening and closing an app ----

let shown = null; // the sheet on screen

function showSheet(sheet) {
  shown = sheet;
  sheet.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('open')));
}

function openApp(app) {
  if (app === 'stats') {
    open = 'stats';
    drawStats();
    showSheet($('stats'));
    setTimeout(() => $('stats').querySelector('[data-back]').focus(), 0);
    return;
  }
  open = app;
  $('note').classList.remove('error');
  document.querySelector('.entry').classList.remove('bad');
  $('handle').value = '';
  drawSheet();
  showSheet($('sheet'));
  setTimeout(() => $('handle').focus(), 0);
}

function closeApp() {
  const sheet = shown;
  const from = open;
  open = null;
  shown = null;
  if (!sheet) return;
  sheet.classList.remove('open');
  const done = () => {
    if (shown !== sheet) sheet.hidden = true;
  };
  sheet.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 200);
  document.querySelector(`[data-app="${from === 'stats' ? 'stats' : from?.id}"]`)?.focus();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-app]');
  if (!b || open) return;
  const id = b.dataset.app;
  openApp(id === 'stats' ? 'stats' : id === 'web' ? WEB : id === 'allow' ? ALLOW : APPS.find((a) => a.id === id));
});
$('back').addEventListener('click', closeApp);
document.querySelector('[data-back]').addEventListener('click', closeApp);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && open) {
    e.preventDefault();
    closeApp();
  }
});

// ---- stats ----

let stats = null;
async function loadStats() {
  stats = await readStats();
  $('total').textContent = number(stats.total);
  if (open === 'stats') drawStats();
}

function drawStats() {
  if (!stats) return;
  $('stats').classList.toggle('no-stats', !stats.total);
  $('s-total').textContent = number(stats.total);
  $('s-since').textContent = stats.total ? `Spoilers blocked since ${stats.since}` : 'Nothing blocked yet. Visit a page that mentions the game';
  $('s-today').textContent = number(stats.today);
  $('s-week').textContent = number(stats.week);
  $('s-page').textContent = onPage === null ? '–' : number(onPage);
  weekBars($('s-days'), stats.last7);
  barList($('s-kinds'), stats.kinds, (k) => KIND_NAMES[k] || k, 'Nothing yet');
  barList($('s-sites'), stats.sites, (k) => k, 'Nothing yet');
}
api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.total || changes.stats)) loadStats();
});

$('add').addEventListener('submit', (e) => {
  e.preventDefault();
  const value = entryFor(open, $('handle').value);
  const note = $('note');
  if (!value) {
    note.classList.add('error');
    document.querySelector('.entry').classList.add('bad');
    note.textContent = PLAIN.includes(open.id) ? 'That doesn’t look like a website'
      : notAccount ? 'Paste the account’s page, not a post'
      : `That doesn’t look like ${/^[aeiox]/i.test(open.name) ? 'an' : 'a'} ${open.name} name or link`;
    return;
  }
  note.classList.remove('error');
  document.querySelector('.entry').classList.remove('bad');
  $('handle').value = '';
  if (open.id === 'allow') {
    if (!S.offSites.includes(value)) set({ offSites: [...S.offSites, value] });
    else drawSheet();
  } else if (!S.sources.some((v) => same(v, value))) set({ sources: [...S.sources, value] });
  else drawSheet();
});
$('handle').addEventListener('input', () => {
  if ($('note').classList.contains('error')) {
    $('note').classList.remove('error');
    document.querySelector('.entry').classList.remove('bad');
    drawSheet();
  }
});

$('enabled').addEventListener('change', (e) => set({ enabled: e.target.checked }));
$('settings').addEventListener('click', () => api.runtime.openOptionsPage());

// ---- the tab, the clock ----

async function readTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const url = new URL(tab.url);
    if (/^https?:$/.test(url.protocol)) site = G.siteOf(url.hostname);
  } catch {}
  try {
    const answer = await api.tabs.sendMessage(tab.id, { type: 'count' }, { frameId: 0 });
    if (answer) onPage = answer.n;
  } catch {}
}

function tick() {
  $('clock').textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()).replace(/\s?[AP]M$/i, '');
}
tick();
setInterval(tick, 10000);

[S] = await Promise.all([loadSettings(), readTab(), loadStats()]);
draw();
onSettings((next) => {
  S = next;
  draw();
});
setInterval(async () => {
  const before = onPage;
  await readTab();
  if (onPage !== before) drawHome();
}, 1000);

// Exposed for the tests.
globalThis.__nowanted = { openApp: (id) => openApp(id), entryFor: (id, text) => entryFor(id === 'web' ? WEB : id === 'allow' ? ALLOW : APPS.find((a) => a.id === id), text) };
