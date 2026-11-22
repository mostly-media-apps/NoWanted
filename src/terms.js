// What counts as GTA 6. Three levels, each including the one before it.
// Shared by the content script, the popup and the settings page.
(() => {
  // Between "GTA" and the number: spaces and dashes, or one dot or colon
  // ("GTA.6", "GTA:VI"). Not a dot and then a space, which is the end of a
  // sentence about the Greater Toronto Area ("across the GTA. 6 people...").
  const SEP = String.raw`(?:[\s\-_]*|[.:])`;
  const W = String.raw`[\s\-_]+`; // between words of a name (also matches URL slugs)
  const START = String.raw`(?<![a-z0-9])`;
  // A 6 that starts a number or a measure is Toronto news, not the game:
  // "GTA 6.5%", "GTA 6-bedroom", "GTA 6 residents", "the 6ix". Words a video
  // about the game also uses ("GTA 6 deaths", "GTA 6 people", "GTA 6-story")
  // are not on the list: a blurred Toronto headline costs a click, a spoiler
  // that got through can't be unseen.
  const NOT_A_COUNT = String.raw`(?![0-9]|[.,][0-9]|ix|\s*%|-?(?:bedroom|storey|lane|unit|plex)|\s+(?:persons|residents|per\s?cent|percent|cm|mm|km|degrees|°|condos|schools|hospitals|municipalities|injured|arrested|charged))`;
  const SIX = String.raw`(?:6${NOT_A_COUNT}|vi(?![a-z])|six(?![a-z])|sixth(?![a-z]))`;

  // Level 1: the game's title, however it is written.
  const TITLE = [
    // GTA 6, GTA VI, GTA6, gta-6, G.T.A 6, #gta6trailer
    `${START}g[\\s.]?t[\\s.]?a${SEP}${SIX}`,
    // G.T.A. 6
    `${START}g\\.\\s?t\\.\\s?a\\.\\s*${SIX}`,
    // hashtags that glue a word onto "gtavi"
    `${START}gtavi(?=trailer|leak|news|gameplay|online|map|hype|countdown|meme|clip|short|edit|release|launch|day|review|mission|ending|story)`,
    // "GTA: VI". A Roman numeral is never a Toronto head count, so the colon
    // may be followed by a space here ("the GTA: 6 new condos" may not).
    `${START}gta:\\s*vi(?![a-z])`,
    // GTA 5 vs 6, GTA V to VI
    `${START}gta${SEP}(?:5|v)\\s*(?:vs\\.?|versus|and|&|or|to|\\/|->|→)\\s*(?:6|vi)(?![a-z0-9])`,
    // The full name is never Toronto, so "Grand Theft Auto: 6" counts too.
    `${START}grand${W}theft${W}auto(?:[\\s\\-_]*|[.:]\\s*)${SIX}`,
    // Russian, Chinese, Japanese, Korean, Arabic
    `(?:[гґ]та|джи\\s*ти\\s*эй)[\\s\\-]*(?:6|vi|шесть)`,
    `(?:侠盗猎车手|俠盜獵車手|侠盗猎车|横行霸道|橫行霸道|给他爱)\\s*(?:6|vi|六)`,
    `gta\\s*六`,
    `(?:グラセフ|グランド[・\\s]?セフト[・\\s]?オート)\\s*(?:6|vi)`,
    `(?:지티에이|그타)\\s*(?:6|vi)`,
    // Arabic and Persian: either "ya", any hamza on the alef, a trailing "h",
    // and Persian digits. "Grand" by itself counts only in the Gulf spelling,
    // which is what the game is called there; the others need the full name.
    `(?:ج[يی]\\s*ت[يی]\\s*[اأإآ][يی]ه?|قراند|[قجغ]راند\\s*ث[يی]?فت\\s*[اأ]وتو)\\s*(?:6|٦|۶)`,
  ];

  // Level 2: people and places that only exist in this game.
  const NAMES = [
    `${START}jason${W}duval`,
    `${START}lucia${W}caminos`,
    `${START}jason${W}(?:and|&|\\+|x|n)${W}lucia(?![a-z])`,
    `${START}lucia${W}(?:and|&|\\+|x|n)${W}jason(?![a-z])`,
    `${START}cal${W}hampton`,
    `${START}boobie${W}ike(?![a-z])`,
    `${START}dre['’‘\`]?quan${W}priest`,
    `${START}real${W}dimez`,
    `${START}raul${W}bautista`,
    `${START}brian${W}heder`,
    `${START}leonida(?![a-z])`,
    `${START}port${W}gellhorn`,
    `${START}grassrivers`,
    `${START}mount${W}kalaga`,
  ];
  // Vice City, but not the 2002 game ("GTA: Vice City", "Vice City Stories")
  const VICE = `${START}(?<!(?:gta|grand[\\s\\-_]+theft[\\s\\-_]+auto)[\\s:\\-_]*)vice[\\s\\-_]*city(?![a-z])(?![\\s\\-_]*stories)`;

  // A page about the 2002 game (its wiki page, a retro review) says "Vice
  // City" on every line, so there the name alone doesn't count.
  const OLD_VICE = /(?:gta|grand[\s_\-]+theft[\s_\-]+auto)[\s:_\-]*vice[\s_\-]*city/i;
  const NEW_GAME = /(?:gta|grand[\s_\-]+theft[\s_\-]+auto)[\s:_.\-]*(?:6|vi)(?![a-z0-9])/i;
  function aboutOldGame(text) {
    return OLD_VICE.test(text) && !NEW_GAME.test(text);
  }

  // Level 3: the whole series and the companies behind it.
  const WIDE = [
    `${START}gta(?![a-z0-9])`,
    `${START}grand${W}theft${W}auto`,
    `${START}rockstar(?![a-z])`,
    `${START}take[\\s\\-]?two(?![a-z])`,
    `${START}strauss${W}zelnick`,
    `${START}ambrosia(?![a-z])`,
  ];

  // Where the Support link goes. Empty hides the link everywhere.
  const SUPPORT_URL = 'https://ko-fi.com/mostlymedia';

  const LEVELS = ['title', 'names', 'wide'];

  // Sources that are about the game whatever a post says. Offered as switches
  // in settings, and on by default.
  const PRESETS = [
    { value: 'rockstargames.com', name: 'Rockstar Games website', kind: 'Site' },
    { value: '@rockstargames', name: 'Rockstar Games accounts', kind: 'YouTube, X, Instagram, TikTok, Twitch' },
    { value: 'r/GTA6', name: 'r/GTA6', kind: 'Subreddit' },
    { value: 'r/GTA', name: 'r/GTA', kind: 'Subreddit' },
    { value: 'gtaforums.com', name: 'GTAForums', kind: 'Site' },
    { value: 'gtabase.com', name: 'GTA Base', kind: 'Site' },
    { value: 'gtaboom.com', name: 'GTA BOOM', kind: 'Site' },
    { value: 'rockstarintel.com', name: 'Rockstar Intel', kind: 'Site' },
  ];

  const DEFAULTS = {
    enabled: true,
    level: 'names', // title | names | wide
    mode: 'blur', // blur | hide
    blur: 20, // px
    reveal: 'click', // click | locked
    hidePages: true,
    muteMedia: true,
    maskTitle: true,
    extraTerms: [],
    sources: PRESETS.map((p) => p.value), // sites, @handles and r/subreddits that are always blurred
    offSites: [],
    frame: 'sunset', // sunset | pink | white | gray
    tag: 'Spoilers', // the word in the corner of a hidden post
    badge: true, // the count on the toolbar button
    updates: true, // download the daily rules file (new words and site fixes)
    endDate: '', // "Stop hiding on": a day as YYYY-MM-DD, or none
    ended: '', // the day hiding stopped by itself, until the menu has said so once
  };

  // Days are compared as text, in the person's own time zone.
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Has the day set under "Stop hiding on" come?
  const endPassed = (settings, now = new Date()) => /^\d{4}-\d{2}-\d{2}$/.test(settings?.endDate || '') && dayKey(now) >= settings.endDate;
  // What to save when it has: hiding off, the date cleared, and the day kept so the menu can say so once.
  const endPatch = (settings) => ({ enabled: false, endDate: '', ended: settings.endDate });

  // Frame looks. Each is a border-image source and a solid color for the
  // places that can only take one (outlines).
  const FRAMES = {
    sunset: ['linear-gradient(135deg, #ff4fa3, #ff8a3d 55%, #8b3fd9)', '#ff4fa3'],
    pink: ['linear-gradient(#ff4fa3, #ff4fa3)', '#ff4fa3'],
    white: ['linear-gradient(#ededed, #ededed)', '#ededed'],
    gray: ['linear-gradient(#85858b, #85858b)', '#85858b'],
  };
  const TAGS = ['Spoilers', 'GTA 6', 'Hidden'];

  function escapeTerm(term) {
    const body = term
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    return body ? `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])` : '';
  }

  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // One entry of the always-blur list: a site (with an optional path), an
  // @handle or an r/subreddit. Returns null when it is none of those.
  function parseSource(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const sub = /^\/?r\/([a-z0-9_]{2,40})\/?$/i.exec(t);
    if (sub) return { kind: 'sub', name: sub[1].toLowerCase(), value: `r/${sub[1]}` };
    if (t[0] !== '@' && (t.includes('.') || t.includes('://'))) {
      let u;
      try {
        u = new URL(t.includes('://') ? t : `https://${t}`);
      } catch {
        return null;
      }
      const host = siteOf(u.hostname);
      if (!host.includes('.')) return null;
      const path = decode(u.pathname).replace(/\/+$/, '').toLowerCase();
      return { kind: 'site', host, path, value: host + path };
    }
    const name = t.replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.\-]{2,60}$/.test(name)) return null;
    return { kind: 'handle', name, value: `@${name}` };
  }

  // Sites that answer to two names. An entry for one covers the other.
  const ALIAS = { 'twitter.com': 'x.com', 'threads.net': 'threads.com', 'youtu.be': 'youtube.com' };
  const canon = (host) => {
    for (const [from, to] of Object.entries(ALIAS)) {
      if (host === from || host.endsWith('.' + from)) return to;
    }
    return host;
  };

  const PROFILE_DIRS = new Set(['user', 'u', 'c', 'channel', 'profile', 'people', 'users']);

  // except: names whose handle should not count as a word (the account whose
  // own page is open, where its handle is on every line).
  function buildSources(list, except) {
    const items = (list || []).map(parseSource).filter(Boolean);
    const sites = items.filter((i) => i.kind === 'site').map((i) => ({ ...i, host: canon(i.host) }));
    const handles = new Set(items.filter((i) => i.kind === 'handle').map((i) => i.name));
    const subs = new Set(items.filter((i) => i.kind === 'sub').map((i) => i.name));
    const tokens = [...sites.flatMap((i) => [i.host, ...Object.keys(ALIAS).filter((k) => ALIAS[k] === i.host)]), ...handles, ...subs].map(esc);
    const quick = tokens.length ? new RegExp(tokens.join('|'), 'i') : null;

    function test(href, base) {
      if (!quick || !quick.test(href)) return false;
      let u;
      try {
        u = new URL(href, base);
      } catch {
        return false;
      }
      if (!/^https?:$/.test(u.protocol)) return false;
      const host = canon(siteOf(u.hostname));
      const path = decode(u.pathname).replace(/\/+$/, '').toLowerCase();
      for (const s of sites) {
        if (host !== s.host && !host.endsWith('.' + s.host)) continue;
        if (!s.path || path === s.path || path.startsWith(s.path + '/')) return true;
      }
      const segs = path.split('/').filter(Boolean);
      if (!segs.length) return false;
      if (segs[0] === 'r' && segs[1] && subs.has(segs[1])) return true;
      const first = segs[0].replace(/^@/, '');
      if (handles.has(first)) return true;
      if (PROFILE_DIRS.has(segs[0]) && segs[1]) {
        const who = segs[1].replace(/^@/, '');
        if (handles.has(who) || handles.has(who.split('.')[0])) return true;
      }
      return false;
    }

    // "@name" and "r/name" written out in a post count too.
    const terms = [
      ...[...handles].filter((n) => !except?.has(n)).map((n) => `(?<![a-z0-9_])@${esc(n)}(?![a-z0-9_])`),
      ...[...subs].map((n) => `(?<![a-z0-9_/])r/${esc(n)}(?![a-z0-9_])`),
    ];
    return { any: !!quick, test, terms };
  }

  // Takes every "not followed by" rule out of a pattern, nested ones included.
  function withoutNotAfter(source) {
    let out = '';
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\\') {
        out += source.slice(i, i + 2);
        i++;
      } else if (source.startsWith('(?!', i)) {
        let depth = 0;
        let inClass = false;
        for (; i < source.length; i++) {
          const c = source[i];
          if (c === '\\') i++;
          else if (inClass) inClass = c !== ']';
          else if (c === '[') inClass = true;
          else if (c === '(') depth++;
          else if (c === ')' && --depth === 0) break;
        }
      } else out += source[i];
    }
    return out;
  }

  // loose: drop the "nothing before it" and "nothing after it" rules. Used only
  // to decide whether a container is worth looking inside, because a
  // container's text runs its pieces together: "48:19" + "GTA 6 ending" reads
  // as "48:19GTA 6 ending", and a title with the line under it reads as
  // "Download GTA VIOpen world" or "GTA 612 views". The loose matcher must
  // never say no where the strict one would say yes to a piece inside, or
  // that piece is never looked at.
  function buildMatcher(level, extraTerms, sourceTerms, loose, oldGame) {
    const depth = Math.max(0, LEVELS.indexOf(level));
    const parts = [...TITLE];
    if (depth >= 1) parts.push(...NAMES);
    if (depth >= 1 && !oldGame) parts.push(VICE);
    if (depth >= 2) parts.push(...WIDE);
    for (const term of extraTerms || []) {
      const p = escapeTerm(String(term));
      if (p) parts.push(p);
    }
    if (sourceTerms) parts.push(...sourceTerms);
    const source = parts.join('|');
    return new RegExp(loose ? withoutNotAfter(source.replace(/\(\?<!\[[^\]]*\]\)/g, '')) : source, 'iu');
  }

  // Styled letters (𝗚𝗧𝗔 𝟲, ＧＴＡ６, Ⅵ) and invisible characters hide the title
  // from a plain match. Only pay for normalising when they are present.
  const ODD = /[​-‍⁠﻿­Ⅰ-ⅿ＀-￯]|[\uD835][\uDC00-\uDFFF]/;
  const INVISIBLE = /[​-‍⁠﻿­]/g;
  function normalize(text) {
    if (!ODD.test(text)) return text;
    return text.replace(INVISIBLE, '').normalize('NFKC');
  }

  // The readable part of a URL: its path plus any search words.
  const SEARCH_PARAMS = ['q', 'query', 'search_query', 'search', 's', 'k', 'keyword', 'keywords', 'text', 'term', 'p'];
  function decode(s) {
    try {
      return decodeURIComponent(s.replace(/\+/g, ' '));
    } catch {
      return s;
    }
  }
  function urlText(href, base) {
    let u;
    try {
      u = new URL(href, base);
    } catch {
      return '';
    }
    let out = decode(u.pathname);
    for (const key of SEARCH_PARAMS) {
      const v = u.searchParams.get(key);
      if (v) out += ' ' + v;
    }
    return out;
  }

  function siteOf(hostname) {
    return String(hostname || '').replace(/^www\./, '').toLowerCase();
  }

  globalThis.GSB = { dayKey, endPassed, endPatch, SUPPORT_URL, DEFAULTS, FRAMES, TAGS, LEVELS, PRESETS, buildMatcher, aboutOldGame, buildSources, parseSource, normalize, urlText, siteOf };
})();
