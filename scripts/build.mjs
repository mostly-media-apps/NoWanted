// Packs the extension for each store: dist/nowanted-chrome-<version>.zip and dist/nowanted-firefox-<version>.zip.
// The two differ only in the manifest.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SHIP = ['src', 'ui', 'popup', 'options', 'fonts', 'icons', 'art'];
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

function firefox(m) {
  const out = structuredClone(m);
  delete out.minimum_chrome_version;
  out.background = { scripts: [m.background.service_worker] };
  out.host_permissions = ['<all_urls>'];
  out.browser_specific_settings = {
    gecko: {
      id: 'spoilers@nowanted.online',
      strict_min_version: '140.0',
      data_collection_permissions: { required: ['none'] },
    },
    gecko_android: { strict_min_version: '142.0' },
  };
  return out;
}

// Safari runs the background as a non-persistent page, and background.js uses
// nothing that only a service worker has. iOS requires `persistent: false`
// (MDN browser-compat-data); the converter calls the key unsupported but warns
// the page won't run on iOS without it. Options always open in a tab in Safari,
// so open_in_tab goes. match_about_blank stays: the converter flags it, but
// Safari 18.4+ supports it and older versions ignore it.
// dist/safari is not zipped; the Xcode project in safari/ packs it into the app.
function safari(m) {
  const out = structuredClone(m);
  delete out.minimum_chrome_version;
  out.background = { scripts: [m.background.service_worker], persistent: false };
  delete out.options_ui.open_in_tab;
  return out;
}

rmSync(dist, { recursive: true, force: true });
for (const [name, m] of [['chrome', manifest], ['firefox', firefox(manifest)], ['safari', safari(manifest)]]) {
  const dir = join(dist, name);
  mkdirSync(dir, { recursive: true });
  for (const part of SHIP) {
    if (existsSync(join(root, part))) cpSync(join(root, part), join(dir, part), { recursive: true });
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  // Everything the manifest names has to be in the package.
  const named = [m.background.service_worker, ...(m.background.scripts || []), m.action.default_popup, m.options_ui.page, ...Object.values(m.icons),
    ...m.content_scripts.flatMap((c) => [...c.js, ...(c.css || [])]), ...(m.web_accessible_resources || []).flatMap((w) => w.resources)].filter(Boolean);
  for (const file of named) if (!existsSync(join(dir, file))) throw new Error(`${name}: the manifest names ${file}, which is not in the package`);
  if (name === 'safari') { console.log(dir); continue; }
  const zip = join(dist, `nowanted-${name}-${m.version}.zip`);
  execFileSync('zip', ['-rqX', zip, '.', '-x', '.DS_Store', '*/.DS_Store'], { cwd: dir });
  console.log(zip);
}
