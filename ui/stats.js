// Turns the stored stats into what the phone and settings show.
import { api } from './ui.js';

export const KIND_NAMES = { video: 'Videos', post: 'Posts', comment: 'Comments', mention: 'Lines in articles', page: 'Pages covered' };

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function readStats() {
  const saved = await api.storage.local.get(['total', 'stats']);
  const total = saved.total || 0;
  const stats = saved.stats || {};
  const days = stats.days || {};
  const now = new Date();
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    last7.push({ key: dayKey(d), label: new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(d), n: days[dayKey(d)] || 0, today: i === 0 });
  }
  const kinds = Object.entries(stats.kinds || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const sites = Object.entries(stats.sites || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  let since = '';
  if (stats.since) {
    const [y, m, d] = stats.since.split('-').map(Number);
    since = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: y === now.getFullYear() ? undefined : 'numeric' }).format(new Date(y, m - 1, d));
  }
  return { total, today: last7[6].n, week: last7.reduce((a, d) => a + d.n, 0), last7, kinds, sites, since };
}

export async function resetStats() {
  const reset = await api.runtime.sendMessage({ type: 'resetStats' });
  if (!reset) throw new Error('Could not reset stats');
}

// A list of names with a count and a thin bar, largest first.
export function barList(list, items, name, empty, max = 5) {
  list.replaceChildren();
  const top = items.slice(0, max);
  const most = top[0]?.[1] || 1;
  for (const [key, n] of top) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = name(key);
    const count = document.createElement('span');
    count.className = 'n';
    count.textContent = new Intl.NumberFormat('en-US').format(n);
    const track = document.createElement('span');
    track.className = 'track';
    const fill = document.createElement('span');
    fill.className = 'fill';
    fill.style.width = `${Math.max(2, (n / most) * 100)}%`;
    track.append(fill);
    li.append(label, count, track);
    list.append(li);
  }
  if (!top.length) {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = empty;
    list.append(li);
  }
}

// Seven columns, today in the accent.
export function weekBars(box, last7) {
  box.replaceChildren();
  const most = Math.max(1, ...last7.map((d) => d.n));
  for (const d of last7) {
    const day = document.createElement('div');
    day.className = 'day' + (d.today ? ' today' : '');
    day.title = `${d.n} on ${d.key}`;
    const col = document.createElement('i');
    col.className = 'col';
    col.style.height = `${d.n ? Math.max(6, (d.n / most) * 100) : 3}%`;
    const label = document.createElement('span');
    label.textContent = d.label;
    day.append(col, label);
    box.append(day);
  }
}
