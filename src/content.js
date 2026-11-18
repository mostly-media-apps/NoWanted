// Finds GTA 6 on the page and blurs the post, card or paragraph around it.
// Runs before the page draws, and handles every DOM change inside the
// mutation callback, which the browser runs before the next paint. So a match
// is blurred in the same frame it would have appeared in.
(() => {
  if (globalThis.__gsbLoaded) return;
  globalThis.__gsbLoaded = true;

  const G = globalThis.GSB;
  const api = globalThis.browser ?? globalThis.chrome;
  const site = G.siteOf(location.hostname);
  // No Wanted's own site talks about the game on every line and spoils nothing.
  const OWN_SITES = ['nowanted.online', 'offtheradar.app', 'offtheradar.live'];
  let adapter = G.adapterFor(location.hostname);
  // The daily rules file, as the background saved it: extra words, always-blur
  // sources, per-site selectors and sites to stay off. Data only.
  let rulesRaw = null;
  let R = null;
  const isTop = window === window.top;
  const root = document.documentElement;

  let S = { ...G.DEFAULTS };
  let src, re, loose;
  // The handle of the account whose page is open does not count as a word on
  // that page; the page itself is covered instead.
  function build() {
    const sources = R ? [...S.sources, ...R.sources] : S.sources;
    const words = R ? [...S.extraTerms, ...R.words] : S.extraTerms;
    src = G.buildSources(sources);
    const here = (location.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '').toLowerCase();
    const except = here && src.test(location.href) ? new Set([here]) : null;
    const terms = except ? G.buildSources(sources, except).terms : src.terms;
    oldGame = G.aboutOldGame(G.urlText(location.href) + ' ' + document.title);
    re = G.buildMatcher(S.level, words, terms, false, oldGame);
    loose = G.buildMatcher(S.level, words, terms, true, oldGame);
  }
  let oldGame = false;
  build();
  let active = !OWN_SITES.includes(site);
  let pageOn = false; // the whole page is covered
  let pageShown = false; // the person chose to see this page
  let lastUrl = location.href;
  let realTitle = null; // the page's own title while ours is in its place
  let added = {}; // blurs since the last report, by kind
  const counted = new WeakSet(); // each thing counts once, even when re-hidden
  const VIDEO_LINK = 'video,a[href*="/watch"],a[href*="/shorts/"],a[href*="/reel"],a[href*="/video/"],a[href*="/videos/"],[data-e2e*="video"]';
  function tally(el, kind) {
    if (counted.has(el)) return;
    counted.add(el);
    added[kind] = (added[kind] || 0) + 1;
  }
  function kindOf(el, mode) {
    if (mode === '3') return 'mention';
    if (el.matches(COMMENT_ZONE) || el.closest(COMMENT_ZONE)) return 'comment';
    if (el.matches(VIDEO_LINK) || el.querySelector(VIDEO_LINK)) return 'video';
    return 'post';
  }

  const blurred = new Set();
  const REPLACED = new Set(['IMG', 'VIDEO', 'IFRAME', 'CANVAS', 'PICTURE', 'SVG', 'svg', 'BUTTON', 'TR', 'TD', 'TBODY', 'TABLE']);
  const HIDDEN_PAGE_TITLE = 'Hidden page';
  const ATTRS = ['alt', 'title', 'aria-label', 'href'];
  const ATTR_SEL = '[alt],[title],[aria-label],a[href]';
  const SKIP_TAG = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'HEAD', 'TITLE', 'META', 'LINK']);
  const SKIP_SEL = 'script,style,noscript,textarea,input,select,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"],#gsb-veil,#gsb-ask';
  const INLINE = new Set(['A', 'SPAN', 'B', 'I', 'EM', 'STRONG', 'MARK', 'SMALL', 'CODE', 'U', 'S', 'SUP', 'SUB', 'FONT', 'LABEL', 'TIME', 'ABBR', 'CITE', 'Q', 'BDI', 'BDO', 'YT-FORMATTED-STRING', 'YT-ATTRIBUTED-STRING']);
  const WALL = new Set(['BODY', 'HTML', 'MAIN', 'NAV', 'HEADER', 'FOOTER', 'FORM', 'ASIDE']);
  const CARD_TAG = new Set(['ARTICLE', 'LI', 'TR', 'FIGURE', 'BLOCKQUOTE', 'DD', 'P']);
  const CARD_ROLE = new Set(['article', 'listitem', 'row', 'option', 'comment']);

  const hit = (text) => !!text && text.length >= 4 && re.test(G.normalize(text));
  // Might a match be somewhere inside? Never says no when hit() would say yes.
  const maybe = (text) => !!text && text.length >= 4 && loose.test(G.normalize(text));

  // ---------- finding matches ----------

  // Walk down to the smallest elements that contain a whole match.
  function findMatches(el, out) {
    const before = out.length;
    for (const c of el.children) {
      if (SKIP_TAG.has(c.tagName)) continue;
      if (maybe(c.textContent)) findMatches(c, out);
    }
    if (ownTextHits(el)) out.push(el);
    else if (out.length === before && hit(el.textContent) && spansChildren(el)) out.push(el);
  }

  function ownTextHits(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && hit(n.nodeValue)) return true;
    }
    return false;
  }

  // The match runs across several child nodes ("GTA <b>6</b>"). textContent
  // glues separate blocks together, so confirm it line by line as rendered.
  function spansChildren(el) {
    if (el === document.body || el === root) return false;
    const shown = el.innerText;
    if (typeof shown !== 'string') return true;
    for (const line of shown.split('\n')) {
      if (hit(line)) return true;
    }
    return false;
  }

  // A link back to the account or site this page belongs to. On that page
  // every tab and button links there, and the page cover already decided.
  function ownLink(href) {
    let u;
    try {
      u = new URL(href, location.href);
    } catch {
      return false;
    }
    if (u.host !== location.host) return false;
    const first = (p) => p.split('/').filter(Boolean)[0]?.toLowerCase() || '';
    return first(u.pathname) === first(location.pathname) && src.test(location.href);
  }

  function attrHits(el) {
    for (const name of ATTRS) {
      const v = el.getAttribute(name);
      if (!v || v.length < 4) continue;
      if (name === 'href') {
        if (v[0] === '#' || v.startsWith('javascript:')) continue;
        if (hit(v) || (/[+%]/.test(v) && hit(G.urlText(v, location.href)))) return true;
        if (src.any && src.test(v, location.href) && !ownLink(v)) return true;
      } else if (hit(v)) return true;
    }
    return false;
  }

  function collect(node, out) {
    if (node.nodeType !== 1 || SKIP_TAG.has(node.tagName)) return out;
    if (maybe(node.textContent)) findMatches(node, out);
    findShadows(node, out);
    if (node.matches(ATTR_SEL) && attrHits(node)) out.push(node);
    for (const el of node.querySelectorAll(ATTR_SEL)) {
      if (attrHits(el)) out.push(el);
    }
    return out;
  }

  // ---------- shadow DOM ----------

  const watchedRoots = new WeakSet();
  function scanShadow(shadow, out) {
    if (!watchedRoots.has(shadow)) {
      watchedRoots.add(shadow);
      observer.observe(shadow, OBSERVE);
      listenMedia(shadow);
      const style = document.createElement('style');
      style.textContent = G.CSS;
      shadow.appendChild(style);
    }
    for (const c of shadow.children) collect(c, out);
  }

  function findShadows(node, out) {
    if (node.shadowRoot) scanShadow(node.shadowRoot, out);
    if (!node.firstElementChild) return;
    for (const el of node.getElementsByTagName('*')) {
      if (el.shadowRoot) scanShadow(el.shadowRoot, out);
    }
  }

  // ---------- choosing what to blur ----------

  function sameKind(a, b) {
    if (a.tagName !== b.tagName) return false;
    const ca = a.classList[0] || '';
    const cb = b.classList[0] || '';
    if (ca || cb) return ca === cb;
    if (a.tagName !== 'DIV' && a.tagName !== 'SPAN') return true;
    return a.childElementCount > 0 && a.firstElementChild?.tagName === b.firstElementChild?.tagName;
  }

  // One of several look-alike siblings: a list row, a grid tile, a feed post.
  function isRepeated(el) {
    const parent = el.parentElement;
    if (!parent || parent.childElementCount < 2) return false;
    let seen = 0;
    for (const sib of parent.children) {
      if (sib !== el && sameKind(el, sib)) return true;
      if (++seen > 60) break;
    }
    return false;
  }

  function isCard(el) {
    if (CARD_TAG.has(el.tagName)) return true;
    const role = el.getAttribute('role');
    if (role && CARD_ROLE.has(role)) return true;
    return !INLINE.has(el.tagName) && isRepeated(el);
  }

  // A comment inside a post is hidden by itself, not with the whole post.
  const COMMENT_ZONE = '[class*="comment" i],[id*="comment" i],[aria-label*="comment" i],[data-testid*="comment" i],[data-e2e*="comment" i],[class*="replies" i],[class*="chat" i]';

  // closest(), carried on through shadow roots to the elements that host them.
  // A site's own elements keep part of a post inside a shadow root (Reddit's
  // row of buttons), and from in there plain closest() never finds the post.
  function closestAcross(el, sel) {
    for (let n = el; n; ) {
      const found = n.closest(sel);
      if (found) return found;
      const top = n.getRootNode();
      n = top instanceof ShadowRoot ? top.host : null;
    }
    return null;
  }

  function pickTarget(match) {
    if (adapter) {
      const card = closestAcross(match, adapter.cards);
      if (card) {
        const zone = match.closest(adapter.comments ? `${adapter.comments},${COMMENT_ZONE}` : COMMENT_ZONE);
        if (zone && zone !== card && card.contains(zone)) {
          const comment = pickGeneric(match, zone);
          if (comment && comment !== zone && zone.contains(comment)) return comment;
        }
        return card;
      }
    }
    return pickGeneric(match, null);
  }

  function pickGeneric(match, limit) {
    if (match === limit) return null;
    let block = match;
    while (INLINE.has(block.tagName) && block.parentElement && block.parentElement !== limit && !WALL.has(block.parentElement.tagName)) {
      block = block.parentElement;
    }
    if (WALL.has(block.tagName)) return null;

    // Climb to the post this belongs to: the outermost short card, stopping at
    // the first one that is an item in a list. A paragraph alone never ends
    // the climb, so a short post is taken whole while a long article loses
    // only the paragraph.
    let best = null;
    let el = block;
    for (let depth = 0; el && el !== limit && depth < 12 && !WALL.has(el.tagName); depth++, el = el.parentElement) {
      const len = el.textContent.length;
      if (len > 2500) break;
      if (!isCard(el)) continue;
      if (len > 700) {
        if (!best) best = el;
        break;
      }
      best = el;
      if (el.tagName !== 'P') break;
    }
    const target = best || block;
    if (target.textContent.length > 6000 && target.childElementCount > 20) return null;
    return target;
  }

  // ---------- blurring ----------

  const stateOf = (el) => el.getAttribute('data-gsb');

  const HIDDEN = '[data-gsb="1"],[data-gsb="2"],[data-gsb="3"]';
  const isHiddenState = (v) => v === '1' || v === '2' || v === '3';

  // "1" a framed box with a label, "2" no box of its own, "3" small or bare text.
  function modeFor(el) {
    if (!el.isConnected) return '1';
    const cs = getComputedStyle(el);
    if (cs.display === 'contents') return '2';
    // The frame is drawn on the element, so it needs to be positioned.
    if (cs.position === 'static') el.setAttribute('data-gsb-rel', '');
    if (cs.display === 'inline') return '3';
    if (REPLACED.has(el.tagName) || !el.firstElementChild) return '3';
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return '3'; // bare text: blurred with its element
    }
    const box = el.getBoundingClientRect();
    // A tile that holds a picture is a card with a label even when it is
    // narrow (a profile grid); anything else this small is blurred as it is.
    const tile = box.width >= 96 && box.height >= 96 && !!el.querySelector(PART_MEDIA);
    if (box.width && (box.width < 160 || (box.height && box.height < 48)) && !tile) return '3';
    // Room for the question: the panel with its button needs 192 by 88, the
    // button alone 168 across, and a narrower card asks in the bubble.
    if (box.width && box.width < 168) el.setAttribute('data-gsb-b', '');
    else if (box.height && (box.height < 88 || box.width < 192)) el.setAttribute('data-gsb-sm', '');
    const around = [];
    const [inset, radius] = frameFor(el, cs, box, around);
    el.style.setProperty('--gsb-in', inset);
    el.style.setProperty('--gsb-r', radius);
    for (const n of around) reframe(n);
    if (adapter?.tag) {
      el.style.setProperty('--gsb-tag-y', adapter.tag[0] + 'px');
      el.style.setProperty('--gsb-tag-x', adapter.tag[1] + 'px');
    }
    if (!markKeep(el) && (!box.height || box.height >= 72)) {
      const by = bylineOf(el);
      if (by) el.setAttribute('data-gsb-by', by);
    }
    return '1';
  }

  // Does this element cut off what is drawn outside its box?
  function clipsPaint(cs) {
    return cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none'
      || /paint|strict|content/.test(cs.contain) || cs.contentVisibility === 'auto' || cs.contentVisibility === 'hidden';
  }

  // ---------- where the frame sits ----------

  // The frame is a 2px line that sits 4px outside the card, with 4px between
  // it and anything else. Each side is worked out on its own, from the room
  // that side has, and the result goes to the CSS as --gsb-in (the inset of
  // each side, so a negative number is outside the card).
  const FRAME_OUT = 4;
  const SIDES = ['top', 'right', 'bottom', 'left'];

  // Room on each side before something that clips, up to the limit. Looks a
  // few levels up, through shadow roots too. A side the card already sticks
  // out of is being scrolled past, not resting against the edge, so that edge
  // does not count: the frame would be scrolled out of view there anyway.
  function clipRoom(el, box, limit) {
    const room = { top: limit, right: limit, bottom: limit, left: limit };
    let up = el.parentElement || el.getRootNode().host;
    for (let i = 0; up && i < 8 && up !== root; i++) {
      if (clipsPaint(getComputedStyle(up))) {
        const r = up.getBoundingClientRect();
        const d = { top: box.top - r.top, right: r.right - box.right, bottom: r.bottom - box.bottom, left: box.left - r.left };
        for (const k of SIDES) if (d[k] > -1 && d[k] < room[k]) room[k] = Math.max(0, Math.floor(d[k]));
      }
      up = up.parentElement || up.getRootNode().host;
    }
    return room;
  }

  // The gap to the nearest look-alike on each side: the cards before and after
  // this one in its row, column or grid. Wrappers that hold one card each are
  // stepped through, so the gap is measured card to card. Also returns the
  // neighbours that are close enough to matter (near).
  function neighbourGaps(el, box) {
    const gap = { top: Infinity, right: Infinity, bottom: Infinity, left: Infinity };
    const near = [];
    let cell = el;
    let depth = 0;
    while (depth < 4 && cell.parentElement && cell.parentElement.childElementCount === 1 && !WALL.has(cell.parentElement.tagName)) {
      cell = cell.parentElement;
      depth++;
    }
    const measure = (sib) => {
      let inner = sib;
      for (let i = 0; i < depth && inner.childElementCount === 1; i++) inner = inner.firstElementChild;
      const s = inner.getBoundingClientRect();
      if (!s.width || !s.height) return;
      const gx = Math.max(s.left - box.right, box.left - s.right);
      const gy = Math.max(s.top - box.bottom, box.top - s.bottom);
      let k = null;
      if (gx > -1 && gy < 0) k = s.left >= box.right - 1 ? 'right' : 'left';
      else if (gy > -1 && gx < 0) k = s.top >= box.bottom - 1 ? 'bottom' : 'top';
      if (!k) return;
      const g = Math.max(0, k === 'left' || k === 'right' ? gx : gy);
      gap[k] = Math.min(gap[k], g);
      if (g < 12) near.push(inner);
    };
    const STEPS = ['previousElementSibling', 'nextElementSibling'];
    for (const step of STEPS) {
      let sib = cell[step];
      for (let n = 0; sib && n < 12; n++, sib = sib[step]) {
        if (sameKind(cell, sib)) measure(sib); // not a heading, a divider or a spacer
      }
    }
    // A grid built from rows: the cards above and below are in the next rows.
    const row = cell.parentElement;
    if (row && !WALL.has(row.tagName)) {
      for (const step of STEPS) {
        const other = row[step];
        if (!other || !sameKind(row, other)) continue;
        let n = 0;
        for (const c of other.children) {
          if (n++ >= 12) break;
          if (sameKind(cell, c)) measure(c);
        }
      }
    }
    return { gap, near };
  }

  // How far out a side sits with a neighbour that close. With 12px or more
  // between two cards each frame takes its full 4px. From 8px the frames move
  // in so 4px stays between them. Closer than that there is no room for two
  // lines, so both land on the same pixels and the cards share one line, the
  // way cells in a table do, instead of showing a double one.
  function outFor(gap) {
    if (gap >= 12) return FRAME_OUT;
    if (gap >= 8) return Math.floor((gap - 4) / 2);
    return Math.min(FRAME_OUT, Math.floor((gap + 2) / 2));
  }

  // The corner radius of what sits in the card's own top left corner (its
  // thumbnail, as a rule), and whether a square picture fills that corner.
  function cornerOf(el, box) {
    let n = el.firstElementChild;
    for (let i = 0; n && i < 6; i++, n = n.firstElementChild) {
      const r = n.getBoundingClientRect();
      if (Math.abs(r.left - box.left) > 1 || Math.abs(r.top - box.top) > 1) break;
      const cs = getComputedStyle(n);
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      if (radius) return { radius, square: false };
      if (n.matches(PART_MEDIA)) return { radius: 0, square: true };
    }
    return { radius: 0, square: false };
  }

  // Does the card draw a border of its own, all the way round? It may be on
  // the card or on the one box that fills it. Returns that border's corner
  // radius, or null.
  const hasLine = (cs, side) => parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none' && cs[`border${side}Style`] !== 'hidden'
    && !/^transparent$|,\s*0\)$|\/\s*0\)$/.test(cs[`border${side}Color`]);
  const bordered = (cs) => hasLine(cs, 'Top') && hasLine(cs, 'Right') && hasLine(cs, 'Bottom') && hasLine(cs, 'Left');
  function ownBorder(el, cs, box) {
    if (bordered(cs)) return cs.borderTopLeftRadius;
    let n = el.firstElementChild;
    for (let i = 0; n && i < 3 && n.parentElement.childElementCount === 1; i++, n = n.firstElementChild) {
      const r = n.getBoundingClientRect();
      if (Math.abs(r.left - box.left) > 1 || Math.abs(r.top - box.top) > 1 || Math.abs(r.right - box.right) > 1 || Math.abs(r.bottom - box.bottom) > 1) break;
      const ncs = getComputedStyle(n);
      if (bordered(ncs)) return ncs.borderTopLeftRadius;
    }
    return null;
  }

  // [inset, radius] for a framed card. The close neighbours it measured
  // against are added to around, when given.
  function frameFor(el, cs, box, around) {
    const own = parseFloat(cs.borderTopLeftRadius) || 0;
    // A card with a border of its own takes the frame on that border, with the
    // border's corners. Drawn 4px outside it, the two lines read as a double
    // frame. (The frame is placed from inside the card's border, so the border's
    // width is how far out it goes; a card that clips keeps it just inside.)
    const line = ownBorder(el, cs, box);
    if (line !== null && !clipsPaint(cs)) {
      const w = ['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(cs[`border${k}Width`]) || 0);
      return [w.every((v) => v === w[0]) ? `${-w[0]}px` : w.map((v) => `${-v}px`).join(' '), line];
    }
    if (clipsPaint(cs)) {
      // A card that clips its own paint would cut off a frame drawn outside
      // it. A square one that is big enough (a post in a feed that runs edge
      // to edge) gets the frame 4px inside with round corners: drawn on the
      // very edge, the frames of two posts in a row touch and read as one
      // thick line. Any other takes the frame on its edge, with its corners.
      if (!own && box.width >= 240 && box.height >= 96) return ['4px', '12px'];
      return ['0px', cs.borderRadius || '0px'];
    }
    const room = clipRoom(el, box, FRAME_OUT);
    const { gap, near } = neighbourGaps(el, box);
    if (around) around.push(...near);
    const out = SIDES.map((k) => Math.min(room[k], outFor(gap[k])));
    const least = Math.min(...out);
    // The frame's corners follow the card's, or those of the thumbnail in its
    // corner, plus the distance out. A square picture that fills the corner
    // keeps them tight, so its corners do not poke out past the line.
    const corner = own ? null : cornerOf(el, box);
    const radius = own ? Math.max(4, own + least)
      : corner.radius ? Math.max(4, corner.radius + least)
        : corner.square ? 4 + 2 * Math.max(0, least)
          : Math.max(8, 12 + least);
    const inset = out.every((v) => v === out[0]) ? `${-out[0]}px` : out.map((v) => `${-v}px`).join(' ');
    return [inset, radius + 'px'];
  }

  // Sites add the cards of a list one after another, so a card is often
  // hidden before the next one exists. When that one is hidden too, the frame
  // of the card before it is worked out again, now with its neighbour there.
  function reframe(el) {
    if (!el.isConnected || el.getAttribute('data-gsb') !== '1') return;
    const [inset, radius] = frameFor(el, getComputedStyle(el), el.getBoundingClientRect());
    if (el.style.getPropertyValue('--gsb-in') !== inset) el.style.setProperty('--gsb-in', inset);
    if (el.style.getPropertyValue('--gsb-r') !== radius) el.style.setProperty('--gsb-r', radius);
  }

  // ---------- where the label sits ----------

  // The label sits in the card's top right corner, 8px in. If one of the
  // site's own buttons is there (the three dots on a YouTube result, the
  // arrow on a question), the label moves to the left of it, 4px clear and in
  // line with it, so the button stays in view and the two read as one row.
  // Pieces that are blurred anyway may sit under the label. Sites with a
  // fixed spot for it (adapter.tag) keep that.
  const TAG_IN = 8;
  const TAG_CLEAR = 4;
  const CONTROL = 'button,[role="button"],summary,[data-gsb-live],[data-gsb-keep]';
  function placeTag(card) {
    if (adapter?.tag || !card.isConnected || card.getAttribute('data-gsb') !== '1' || card.hasAttribute('data-gsb-ask')) return;
    const box = card.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const cs = getComputedStyle(card);
    const tag = getComputedStyle(card, '::after');
    const w = parseFloat(tag.width) || 0;
    const h = parseFloat(tag.height) || 20;
    if (!w) return;
    const right = box.right - (parseFloat(cs.borderRightWidth) || 0);
    const top = box.top + (parseFloat(cs.borderTopWidth) || 0);
    const inWay = [];
    for (const c of card.querySelectorAll(CONTROL)) {
      if (c.closest('[data-gsb-part]') || c.querySelector('[data-gsb-part]')) continue;
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height || r.width > box.width * 0.6 || r.height > 72 || r.top - top > 72) continue;
      if (c.checkVisibility && !c.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true })) continue;
      inWay.push(r);
    }
    const hit = (x, y) => inWay.find((o) => o.left < right - x + TAG_CLEAR - 0.5 && o.right > right - x - w - TAG_CLEAR + 0.5 && o.top < top + y + h && o.bottom > top + y);
    let x = TAG_IN;
    let y = TAG_IN;
    for (let i = 0; i < 4; i++) {
      const o = hit(x, y);
      if (!o) break;
      const nx = Math.ceil(right - o.left + TAG_CLEAR);
      if (nx + w > box.width - TAG_IN) break; // no room to its left
      x = nx;
      const ny = Math.round(o.top + o.height / 2 - h / 2 - top);
      if (ny >= 4 && Math.abs(ny - TAG_IN) <= 16) y = ny;
    }
    if (hit(x, y)) {
      x = TAG_IN;
      y = TAG_IN;
    }
    const want = x === TAG_IN && y === TAG_IN ? ['', ''] : [y + 'px', x + 'px'];
    if (card.style.getPropertyValue('--gsb-tag-y') !== want[0] || card.style.getPropertyValue('--gsb-tag-x') !== want[1]) {
      if (want[0]) {
        card.style.setProperty('--gsb-tag-y', want[0]);
        card.style.setProperty('--gsb-tag-x', want[1]);
      } else {
        card.style.removeProperty('--gsb-tag-y');
        card.style.removeProperty('--gsb-tag-x');
      }
    }
  }

  // A small item's frame sits 2px outside it. Where that would be cut off (the
  // item clips itself, as a line that ends in an ellipsis does, or it sits
  // tight inside a row that clips), the frame goes on the item's own edge.
  function fitSmall(el) {
    if (BARE.has(el.tagName) || !el.isConnected) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline') return;
    let tight = clipsPaint(cs);
    if (!tight) {
      const room = clipRoom(el, el.getBoundingClientRect(), 2);
      tight = SIDES.some((k) => room[k] < 2);
    }
    if (tight) el.style.setProperty('--gsb-in', '0px');
  }

  const GENERIC_BY = '[rel="author"],[itemprop="author"],.author,.byline,.channel-name,.username';

  // The channel or author stays readable. Only precise selectors qualify: a
  // loose one could leave a line of the post itself in the clear.
  // Sites often render the name twice (YouTube has a hidden copy for
  // narrow layouts), so every copy is kept, up to three.
  function markKeep(card) {
    const kept = [];
    for (const el of card.querySelectorAll(adapter ? adapter.keep || ':not(*)' : GENERIC_BY)) {
      if (el === card || kept.some((k) => k.contains(el) || el.contains(k))) continue;
      const t = el.textContent.trim().replace(/\s+/g, ' ');
      // Kept even when the name itself mentions the game: the box already
      // says what the card is about, and the channel is how you judge it.
      if (t.length >= 2 && t.length <= 40) {
        el.setAttribute('data-gsb-keep', '');
        kept.push(el);
        if (kept.length === 3) break;
      }
    }
    return kept.length > 0;
  }
  function bylineOf(card) {
    for (const name of adapter?.byAttr || []) {
      const v = card.getAttribute(name);
      if (v && v.length <= 40 && !hit(v)) return v;
    }
    for (const el of card.querySelectorAll(adapter?.by || GENERIC_BY)) {
      const t = el.textContent.trim().replace(/\s+/g, ' ');
      if (t.length >= 2 && t.length <= 40 && !hit(t)) return t;
    }
    return '';
  }

  // A picture, video or frame can't draw a frame of its own (no ::after), so
  // the box goes on the small wrapper around it.
  const BARE = new Set(['IMG', 'VIDEO', 'IFRAME', 'CANVAS', 'EMBED', 'OBJECT', 'svg', 'SVG']);
  function frameable(el) {
    if (!el.isConnected) return el;
    // A custom element the site left at "display: inline" around one block
    // (YouTube's ad slot) has no box to draw on either: the block inside is it.
    for (let i = 0; i < 3 && !BARE.has(el.tagName) && el.childElementCount === 1 && getComputedStyle(el).display === 'inline'
      && getComputedStyle(el.firstElementChild).display !== 'inline' && !BARE.has(el.firstElementChild.tagName); i++) el = el.firstElementChild;
    if (!BARE.has(el.tagName)) return el;
    const box = mediaFrame(el, el.getBoundingClientRect());
    if (box !== el) return box;
    const up = el.parentElement;
    if (up && !WALL.has(up.tagName) && up.textContent.trim().length <= 160) return up;
    return el;
  }

  // A card is often hidden before the site has finished building it: an ad
  // slot with no height yet, a post whose picture has not loaded. Its look
  // (card or small item, room for the question, where the frame and the label
  // sit) is worked out again whenever its size changes.
  const sized = new WeakMap(); // hidden item -> the size its look was worked out for
  const sizeOf = (el) => {
    const box = el.getBoundingClientRect();
    return Math.round(box.width) + 'x' + Math.round(box.height);
  };
  const watcher = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => {
      for (const e of entries) refit(e.target);
    })
    : null;
  function refit(el) {
    const was = el.getAttribute('data-gsb');
    if (!el.isConnected || !blurred.has(el) || (was !== '1' && was !== '3')) return;
    const size = sizeOf(el);
    if (sized.get(el) === size || el.hasAttribute('data-gsb-ask')) return;
    sized.set(el, size);
    for (const name of ['data-gsb-sm', 'data-gsb-b']) el.removeAttribute(name);
    for (const name of ['--gsb-r', '--gsb-in']) el.style.removeProperty(name);
    const mode = modeFor(el);
    if (mode === '3') fitSmall(el);
    if (mode !== was) {
      el.setAttribute('data-gsb', mode);
      if (mode === '3') for (const p of el.querySelectorAll('[data-gsb-part]')) p.removeAttribute('data-gsb-part');
      else markParts(el);
    }
    if (mode === '1') placeTag(el);
  }

  function blur(el) {
    el = frameable(el);
    if (stateOf(el)) return; // already hidden, or shown by the person
    // An ancestor already decides, also from outside a shadow root.
    if (el.parentElement ? closestAcross(el.parentElement, '[data-gsb]') : el.getRootNode() instanceof ShadowRoot && closestAcross(el.getRootNode().host, '[data-gsb]')) return;
    for (const inner of el.querySelectorAll(HIDDEN)) clear(inner);
    const mode = modeFor(el);
    if (mode === '3') fitSmall(el);
    el.setAttribute('data-gsb', mode);
    if (mode !== '3') markParts(el);
    markLive(el);
    if (mode === '1') placeTag(el);
    blurred.add(el);
    if (mode !== '2') {
      sized.set(el, sizeOf(el));
      watcher?.observe(el);
    }
    tally(el, kindOf(el, mode));
    gateAll(el);
    report();
  }

  // The site's own menu on a hidden post (the three dots) keeps working, so
  // the post can be reported or its account muted without showing it.
  function markLive(card) {
    if (!adapter?.live) return;
    for (const el of card.querySelectorAll(adapter.live)) {
      if (!el.hasAttribute('data-gsb-live')) el.setAttribute('data-gsb-live', '');
    }
  }

  function strip(el) {
    for (const p of el.querySelectorAll('[data-gsb-part],[data-gsb-keep],[data-gsb-live]')) {
      p.removeAttribute('data-gsb-part');
      p.removeAttribute('data-gsb-keep');
      p.removeAttribute('data-gsb-live');
    }
    for (const name of ['data-gsb-rel', 'data-gsb-by', 'data-gsb-ask', 'data-gsb-sm', 'data-gsb-b', 'data-gsb-ok', 'data-gsb-over']) el.removeAttribute(name);
    for (const name of ['--gsb-r', '--gsb-in', '--gsb-tag-y', '--gsb-tag-x']) el.style.removeProperty(name);
    if (asking === el) hideBubble();
  }

  function clear(el) {
    strip(el);
    el.removeAttribute('data-gsb');
    blurred.delete(el);
    watcher?.unobserve(el);
    releaseAll(el);
  }

  // Allowed by the person. The item never becomes clear as a whole: the frame
  // stays, and the blur moves onto its pieces, so only the piece under the
  // pointer (the title, the thumbnail, one line) shows.
  function allow(el) {
    if (asking === el) hideBubble();
    el.removeAttribute('data-gsb-ask');
    el.removeAttribute('data-gsb-over');
    el.setAttribute('data-gsb-ok', '');
  }

  function onlyInline(el) {
    for (const c of el.children) if (!INLINE.has(c.tagName) && c.tagName !== 'BR' && c.tagName !== 'IMG') return false;
    return true;
  }

  const PART_MEDIA = 'img,video,picture,canvas,iframe,svg,object,embed,[style*="background-image"]';
  // Anything in there bigger than an emoji or an icon?
  function hasPicture(block) {
    for (const m of block.querySelectorAll(PART_MEDIA)) {
      const r = m.getBoundingClientRect();
      if (r.width > 32 || r.height > 32) return true;
    }
    return false;
  }
  const BUTTON = 'button,[role="button"],summary';
  // A button with no words and no picture in it, no bigger than 56px: three
  // dots, an arrow, a close cross. Remembered per button, since a card is
  // split into pieces again every time its content changes.
  const iconButtons = new WeakMap();
  function iconButton(b) {
    if (!b) return false;
    let is = iconButtons.get(b);
    if (is === undefined) {
      const r = b.getBoundingClientRect();
      is = !!r.width && r.width <= 56 && r.height <= 56 && !b.textContent.trim()
        && !b.querySelector('img,video,picture,canvas,iframe,object,embed,[style*="background-image"]');
      if (r.width) iconButtons.set(b, is);
    }
    return is;
  }

  // Splits a card into pieces, each blurred in its own box: every line of
  // text, every picture or video, and every empty leaf (often a CSS
  // background image). The kept channel is never inside a piece. Runs again
  // whenever the card's content changes, since sites fill cards in late.
  function markParts(card) {
    const keeps = [...card.querySelectorAll('[data-gsb-keep]')];
    const kinds = new Map(); // element -> "t" or "m"
    const within = (el, sel) => {
      const up = sel ? el.closest(sel) : null;
      return up && up !== card && card.contains(up) ? up : null;
    };
    const add = (el, kind) => {
      if (el === card || keeps.some((k) => k.contains(el))) return;
      // One block of the post (its text, its picture, its video) is one piece,
      // so it blurs as one clean shape instead of a pile of small ones.
      const block = within(el, adapter?.blocks);
      if (block && !keeps.some((k) => block.contains(k))) {
        // A block with words and nothing bigger than an emoji or an icon in it
        // is text, and gets the same blur as the text of the post next to it.
        if (!kinds.has(block)) kinds.set(block, block.textContent.trim() && !hasPicture(block) ? 't' : 'm');
        return;
      }
      // The site's own furniture (the avatar, the row of buttons, the menu)
      // says nothing about the game and stays as it is. So does any small
      // button that is only an icon, on every site.
      if (within(el, adapter?.plain) || iconButton(within(el, BUTTON))) return;
      if (keeps.some((k) => el.contains(k))) {
        // Split around the channel: take the other branches instead.
        for (const c of el.children) if (!SKIP_TAG.has(c.tagName)) add(c, kind === 't' && !c.textContent.trim() ? 'm' : kind);
        return;
      }
      if (!kinds.has(el) || kind === 't') kinds.set(el, kind);
    };

    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      if (!n.nodeValue.trim()) continue;
      let p = n.parentElement;
      if (!p || SKIP_TAG.has(p.tagName)) continue;
      // Grow from the text to its line: up through inline wrappers, but not
      // into a parent that also holds other blocks.
      while (p !== card && INLINE.has(p.tagName) && p.parentElement !== card && onlyInline(p.parentElement)) p = p.parentElement;
      add(p, 't');
    }
    for (const el of card.getElementsByTagName('*')) {
      if (SKIP_TAG.has(el.tagName) || el.tagName === 'BR') continue;
      if (el.shadowRoot || el.matches(PART_MEDIA)) {
        if (el.parentElement?.tagName !== 'PICTURE' && !el.parentElement?.closest('svg')) add(el, 'm');
      } else if (!el.firstElementChild && !el.textContent.trim()) {
        add(el, 'm');
      }
    }

    for (const old of card.querySelectorAll('[data-gsb-part]')) {
      if (!kinds.has(old)) old.removeAttribute('data-gsb-part');
    }
    for (const [el, kind] of kinds) {
      let inside = false;
      for (let up = el.parentElement; up && up !== card; up = up.parentElement) {
        if (kinds.has(up)) {
          inside = true;
          break;
        }
      }
      if (inside) el.removeAttribute('data-gsb-part');
      else if (el.getAttribute('data-gsb-part') !== kind) el.setAttribute('data-gsb-part', kind);
    }
  }

  // The confirm button is drawn by CSS at a fixed spot in the box.
  function overButton(el, e) {
    const box = el.getBoundingClientRect();
    const x = e.clientX - (box.left + box.width / 2);
    const y = e.clientY - (box.top + box.height / 2);
    const top = el.hasAttribute('data-gsb-sm') ? -16 : 4;
    return x >= -68 && x <= 68 && y >= top && y <= top + 32;
  }

  // The first click asks. Then the button allows it, and a click anywhere
  // else (or a few seconds of nothing) takes the question away. A framed card
  // draws its own button; a headline, a line or a picture too small for one
  // gets a bubble next to it with the same question and button.
  const ASK_MS = 6000;
  const askTimers = new WeakMap();
  function press(el, e) {
    if (el.hasAttribute('data-gsb-ok')) return;
    const boxed = el.getAttribute('data-gsb') === '1' && !el.hasAttribute('data-gsb-b'); // room for its own button
    const keyboard = !e || e.detail === 0;
    if (!el.hasAttribute('data-gsb-ask')) {
      el.setAttribute('data-gsb-ask', '');
      clearTimeout(askTimers.get(el));
      askTimers.set(el, setTimeout(() => stopAsking(el), ASK_MS));
      if (!boxed) showBubble(el, e, keyboard);
      return;
    }
    if (keyboard || (boxed && overButton(el, e))) return allow(el);
    if (!boxed) {
      // Clicking the line again keeps the question up; only the button says yes.
      clearTimeout(askTimers.get(el));
      askTimers.set(el, setTimeout(() => stopAsking(el), ASK_MS));
      return;
    }
    stopAsking(el);
  }

  function stopAsking(el) {
    clearTimeout(askTimers.get(el));
    el.removeAttribute('data-gsb-ask');
    el.removeAttribute('data-gsb-over');
    if (asking === el) hideBubble();
  }

  // ---------- the bubble ----------

  let bubble = null; // { host, panel, button, timer }
  let asking = null; // the element the bubble belongs to
  let anchorX = null; // where in that element it was clicked, from its left edge

  function buildBubble() {
    const host = document.createElement('div');
    host.id = 'gsb-ask';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .b {
          display: flex; align-items: center; gap: 12px; box-sizing: border-box; padding: 6px 6px 6px 14px;
          border-radius: 12px; background: rgba(22, 12, 28, 0.96);
          box-shadow: 0 0 0 1px rgba(237, 237, 237, 0.12), 0 12px 32px rgba(0, 0, 0, 0.4);
          font: 600 13px/20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #ffffff; white-space: nowrap;
          opacity: 0; transform: translateY(4px);
          transition: opacity 0.12s cubic-bezier(0.22, 1, 0.36, 1), transform 0.12s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .b.on { opacity: 1; transform: none; transition-duration: 0.16s; }
        button {
          all: unset; box-sizing: border-box; height: 32px; padding: 0 12px; border-radius: 8px; cursor: pointer;
          background: #ededed; color: #171717; font: 600 13px/32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          transition: background-color 0.08s cubic-bezier(0.22, 1, 0.36, 1), transform 0.08s cubic-bezier(0.22, 1, 0.36, 1);
        }
        button:hover { background: #ffffff; }
        button:active { transform: scale(0.98); }
        button:focus-visible { outline: 2px solid #ff5aa8; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .b { transform: none; } button { transition: none; } }
      </style>
      <div class="b" role="dialog" aria-label="Show spoilers?"><span>Show spoilers?</span><button type="button">Yes, let me peek</button></div>`;
    const panel = shadow.querySelector('.b');
    const button = shadow.querySelector('button');
    button.addEventListener('click', () => {
      const el = asking;
      if (!el) return;
      clearTimeout(askTimers.get(el));
      allow(el);
    });
    // The page never hears about clicks and keys in the bubble.
    for (const type of ['click', 'auxclick', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu', 'keyup']) {
      host.addEventListener(type, (e) => e.stopPropagation());
    }
    host.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape' && asking) {
        const el = asking;
        stopAsking(el);
        el.focus?.();
      }
    });
    return { host, panel, button, timer: 0 };
  }

  function placeBubble() {
    if (!asking || !bubble) return;
    if (!asking.isConnected) return stopAsking(asking);
    const r = asking.getBoundingClientRect();
    const w = bubble.panel.offsetWidth;
    const h = bubble.panel.offsetHeight;
    const gap = 8;
    // Under the item if there's room, over it if not, and on it when neither fits.
    let y = r.bottom + gap;
    if (y + h > innerHeight - gap) y = r.top - gap - h;
    if (y < gap) y = Math.min(Math.max(r.top + r.height / 2 - h / 2, gap), innerHeight - h - gap);
    const cx = r.left + (anchorX ?? r.width / 2);
    const x = Math.min(Math.max(cx - w / 2, gap), innerWidth - w - gap);
    bubble.host.style.cssText = `all:initial!important;position:fixed!important;z-index:2147483647!important;display:block!important;margin:0!important;padding:0!important;border:0!important;background:none!important;overflow:visible!important;width:auto!important;height:auto!important;inset:auto!important;left:${Math.round(x)}px!important;top:${Math.round(y)}px!important;`;
  }

  function showBubble(el, e, keyboard) {
    if (asking && asking !== el) stopAsking(asking);
    if (!bubble) bubble = buildBubble();
    clearTimeout(bubble.timer);
    const r = el.getBoundingClientRect();
    anchorX = e && !keyboard ? Math.min(Math.max(e.clientX - r.left, 0), r.width) : null;
    const wasOpen = !!asking;
    asking = el;
    if (!bubble.host.isConnected) root.appendChild(bubble.host);
    // In the top layer when the browser has one, so dialogs and full-screen
    // players don't cover it.
    try {
      if (!bubble.host.popover) bubble.host.popover = 'manual';
      if (!bubble.host.matches(':popover-open')) bubble.host.showPopover();
    } catch {}
    placeBubble();
    if (!wasOpen) {
      bubble.panel.classList.remove('on');
      requestAnimationFrame(() => asking === el && bubble.panel.classList.add('on'));
    }
    window.addEventListener('scroll', placeBubble, { capture: true, passive: true });
    window.addEventListener('resize', placeBubble, { passive: true });
    if (keyboard) bubble.button.focus({ preventScroll: true });
  }

  function hideBubble() {
    asking = null;
    window.removeEventListener('scroll', placeBubble, { capture: true });
    window.removeEventListener('resize', placeBubble);
    if (!bubble) return;
    bubble.panel.classList.remove('on');
    clearTimeout(bubble.timer);
    bubble.timer = setTimeout(() => {
      if (asking) return;
      try { bubble.host.hidePopover(); } catch {}
      bubble.host.remove();
    }, 120);
  }

  function clearAll() {
    for (const el of [...blurred]) clear(el);
    report();
  }

  function flag(match) {
    if (match.closest(SKIP_SEL)) return;
    if (adapter?.signals && match.closest(adapter.signals)) queuePageCheck();
    else if (match.closest('h1')) queuePageCheck();
    const target = pickTarget(match);
    if (target) blur(target);
  }

  function scan(node) {
    if (!active) return 0;
    const matches = collect(node, []);
    for (const m of matches) flag(m);
    boxMedia(node);
    return matches.length;
  }

  // A hidden card whose content changed (sites reuse elements as you scroll).
  function recheck(el) {
    if (!el.isConnected) {
      blurred.delete(el);
      watcher?.unobserve(el);
      return;
    }
    if (collect(el, []).length === 0) clear(el);
    else {
      if (el.getAttribute('data-gsb') !== '3') markParts(el);
      markLive(el);
      placeTag(el); // the site's buttons often arrive after the card does
      // Sites put the video into a post late, often after it is hidden.
      gateAll(el);
    }
  }

  // ---------- video and audio ----------

  const gated = new WeakMap(); // media element -> whether it was muted before

  // Media is stopped inside a hidden item, unless the item is allowed and the
  // pointer is on the piece that holds it.
  function isHidden(node) {
    if (pageOn) return true;
    let onPart = false;
    for (let n = node; n; n = n.parentNode || n.host) {
      if (n.nodeType !== 1) continue;
      if (n.hasAttribute('data-gsb-part') && n.matches(':hover')) onPart = true;
      if (isHiddenState(n.getAttribute('data-gsb'))) return !(n.hasAttribute('data-gsb-ok') && onPart);
    }
    return false;
  }

  // The mark hold.js reads in the page's own world: while it is on a video,
  // the site cannot start it or turn its sound on.
  const HOLD = 'data-gsb-hold';
  // And the mark on <html> that tells hold.js No Wanted is on and stopping
  // media, so it can also refuse a video it finds inside a hidden post itself.
  const quiet = () => root.toggleAttribute('data-gsb-quiet', active && S.muteMedia);
  // Where hold.js is not running (an older Safari), a site can still start the
  // video again each time it is paused. After a few rounds the pausing stops
  // and the video is only kept silent, so the page never gets stuck in a loop.
  const FIGHT_ROUNDS = 6;
  const FIGHT_MS = 1000;
  const fights = new WeakMap(); // media element -> { n, since }
  function losingFight(m) {
    const now = performance.now();
    const f = fights.get(m);
    if (!f || now - f.since > FIGHT_MS) {
      fights.set(m, { n: 1, since: now });
      return false;
    }
    return ++f.n > FIGHT_ROUNDS;
  }

  function gate(m) {
    if (active && S.muteMedia && isHidden(m)) {
      if (!gated.has(m)) gated.set(m, m.muted);
      if (!m.hasAttribute(HOLD)) m.setAttribute(HOLD, '');
      if (!m.muted) m.muted = true;
      // pause() on a video that has not started yet also takes away its
      // permission to start by itself (the autoplay attribute).
      if (m.paused ? m.autoplay : !losingFight(m)) m.pause();
    } else release(m);
  }

  function release(m) {
    if (m.hasAttribute(HOLD)) m.removeAttribute(HOLD);
    if (!gated.has(m)) return;
    m.muted = gated.get(m);
    gated.delete(m);
    fights.delete(m);
  }

  // Every video and sound in there, inside shadow roots too.
  function mediaIn(scope, out = []) {
    if (scope.nodeType === 1 && scope.matches('video,audio')) out.push(scope);
    for (const m of scope.querySelectorAll('video,audio')) out.push(m);
    if (scope.shadowRoot) mediaIn(scope.shadowRoot, out);
    for (const el of scope.querySelectorAll('*')) if (el.shadowRoot) mediaIn(el.shadowRoot, out);
    return out;
  }
  const gateAll = (scope) => mediaIn(scope).forEach(gate);
  const releaseAll = (scope) => mediaIn(scope).forEach(release);

  function onMedia(e) {
    const m = e.target;
    if (m instanceof HTMLMediaElement) gate(m);
  }
  function listenMedia(target) {
    for (const type of ['play', 'playing', 'volumechange', 'loadeddata']) {
      target.addEventListener(type, onMedia, true);
    }
  }

  // ---------- clicks on hidden items ----------

  function hiddenInPath(e) {
    for (const n of e.composedPath()) {
      if (n.nodeType !== 1) continue;
      if (n.hasAttribute('data-gsb-live')) return null; // the site's own menu button
      const s = n.getAttribute('data-gsb');
      if (isHiddenState(s) && !n.hasAttribute('data-gsb-ok')) return n;
    }
    return null;
  }

  function liveInPath(e) {
    for (const n of e.composedPath()) {
      if (n.nodeType !== 1) continue;
      if (n.hasAttribute('data-gsb-live')) return true;
      if (isHiddenState(n.getAttribute('data-gsb'))) return false;
    }
    return false;
  }

  function cardInPath(e) {
    for (const n of e.composedPath()) {
      if (n.nodeType === 1 && isHiddenState(n.getAttribute('data-gsb'))) return n;
    }
    return null;
  }

  function onPress(e) {
    // Pressing anywhere but the bubble or its item takes the question away.
    if (asking && e.type === 'pointerdown') {
      const path = e.composedPath();
      if (!path.includes(bubble.host) && !path.includes(asking)) stopAsking(asking);
    }
    const el = hiddenInPath(e);
    if (!el) {
      if (e.type === 'click') noteAllowedClick(e);
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'click' && S.reveal === 'click') press(el, e);
  }

  // A click on a post the person already said yes to may open that post's own
  // page. That page is then not covered: they were asked once already.
  const ALLOWED_GO_MS = 4000;
  let allowedGo = null; // { at, pages }
  const pageKey = (href) => {
    try {
      const u = new URL(href, location.href);
      return u.origin + u.pathname + u.search;
    } catch {
      return '';
    }
  };
  function noteAllowedClick(e) {
    const card = cardInPath(e);
    if (!card?.hasAttribute('data-gsb-ok')) return;
    const pages = new Set();
    if (card.href) pages.add(pageKey(card.href));
    for (const a of card.querySelectorAll('a[href]')) pages.add(pageKey(a.href));
    const up = card.closest('a[href]');
    if (up) pages.add(pageKey(up.href));
    allowedGo = { at: Date.now(), pages };
  }
  function cameFromAllowed() {
    return !!allowedGo && Date.now() - allowedGo.at < ALLOWED_GO_MS && allowedGo.pages.has(pageKey(location.href));
  }

  let lastAllowed = null;
  function onHover(e) {
    const el = hiddenInPath(e);
    if (el) {
      e.stopImmediatePropagation();
      if (el.hasAttribute('data-gsb-ask')) el.toggleAttribute('data-gsb-over', overButton(el, e));
    } else if (cardInPath(e) && !liveInPath(e)) {
      // An allowed card still hides the site's hover previews (YouTube plays
      // the whole video in an overlay outside the card). CSS :hover still works.
      // The site's own menu button gets its hover, or it would not work.
      e.stopImmediatePropagation();
    }
    if (e.type !== 'mouseover' && e.type !== 'pointerover') return;
    // Moving between the pieces of an allowed item starts or stops its media.
    let allowed = null;
    for (const n of e.composedPath()) {
      if (n.nodeType === 1 && n.hasAttribute('data-gsb-ok')) {
        allowed = n;
        break;
      }
    }
    for (const card of new Set([allowed, lastAllowed])) {
      if (card?.isConnected) gateAll(card);
    }
    lastAllowed = allowed;
  }

  function onKey(e) {
    if (e.key === 'Escape' && asking) return stopAsking(asking);
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = hiddenInPath(e);
    if (!el) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (S.reveal === 'click') press(el, null);
  }

  // ---------- whole pages ----------

  let veil = null;
  let pageCheckQueued = false;

  function pageIsAboutIt() {
    // Pages on the always-blur list are covered even with page covers off.
    if (src.any && src.test(location.href)) return true;
    if (!S.hidePages) return false;
    if (hit(G.urlText(location.href))) return true;
    const title = realTitle ?? document.title;
    if (hit(title) && titleIsTheTopic()) return true;
    if (adapter?.signals) {
      for (const el of document.querySelectorAll(adapter.signals)) {
        if (isVisible(el) && hit(el.textContent)) return true;
      }
    }
    const h1s = document.getElementsByTagName('h1');
    if (h1s.length === 1 && isVisible(h1s[0]) && hit(h1s[0].textContent)) return true;
    return false;
  }

  // A title names the page's subject only on articles and videos. A repository,
  // profile, shop or site home that mentions the game in its title is not a
  // page about it, so its mentions are blurred where they are and the page
  // stays open. Pages that say nothing about their type keep the old rule.
  function titleIsTheTopic() {
    const type = document.querySelector('meta[property="og:type"]')?.content?.trim().toLowerCase();
    return !type || type === 'article' || type.startsWith('video');
  }

  function isVisible(el) {
    if (el.checkVisibility) return el.checkVisibility();
    return el.offsetParent !== null;
  }

  function queuePageCheck() {
    if (pageCheckQueued) return;
    pageCheckQueued = true;
    queueMicrotask(() => {
      pageCheckQueued = false;
      checkPage();
    });
  }

  function checkPage() {
    const want = active && !pageShown && pageIsAboutIt();
    if (want && !pageOn) coverPage();
    else if (!want && pageOn) uncoverPage();
    else if (want) maskTitle();
  }

  let pageCounted = '';
  function coverPage() {
    pageOn = true;
    if (pageCounted !== location.href) {
      pageCounted = location.href;
      added.page = (added.page || 0) + 1;
    }
    if (!veil) veil = buildVeil();
    veil.sync();
    if (!veil.isConnected) root.appendChild(veil);
    maskTitle();
    gateAll(document);
    report();
  }

  function uncoverPage() {
    pageOn = false;
    veil?.remove();
    if (realTitle !== null) {
      if (document.title === HIDDEN_PAGE_TITLE) document.title = realTitle;
      realTitle = null;
    }
    gateAll(document);
    report();
  }

  function maskTitle() {
    if (!S.maskTitle || !isTop) return;
    const now = document.title;
    if (now === HIDDEN_PAGE_TITLE || !now) return;
    realTitle = now;
    document.title = HIDDEN_PAGE_TITLE;
  }

  function onTitleChange() {
    if (document.title === HIDDEN_PAGE_TITLE) return; // our own write
    if (realTitle !== null) realTitle = document.title;
    followTitle();
    checkPage();
  }

  // The title arrives after the first scan. If it shows the page is about the
  // 2002 Vice City, "Vice City" alone stops counting, and what it hid comes back.
  function followTitle() {
    if (document.title === HIDDEN_PAGE_TITLE) return;
    if (G.aboutOldGame(G.urlText(location.href) + ' ' + document.title) === oldGame) return;
    build();
    for (const el of [...blurred]) recheck(el);
    if (active) scan(root);
    report();
  }

  // Lifts the page cover only. Everything boxed on the page stays boxed, and
  // since the page is about the game, so are its pictures and videos.
  let pageAbout = false;
  function showPage() {
    pageShown = true;
    pageAbout = true;
    uncoverPage();
    boxMedia(document.documentElement);
  }

  const VIDEO_FRAME = /youtube|youtu\.be|vimeo|twitch|tiktok|twitter|x\.com|instagram|facebook|streamable|dailymotion|jwplayer|brightcove/i;
  const MEDIA = 'img,video,picture,canvas,iframe,svg,[style*="background-image"]';
  function boxMedia(node) {
    if (!pageAbout || !active || node.nodeType !== 1) return;
    const found = node.matches(MEDIA) ? [node] : [...node.querySelectorAll(MEDIA)];
    for (const m of found) {
      if (m.closest(HIDDEN) || m.closest(SKIP_SEL) || m.closest('[data-gsb="0"]')) continue;
      if (m.tagName === 'IMG' && m.parentElement?.tagName === 'PICTURE') continue;
      // Logos, icons and QR codes are drawn as svg; cookie and sign-in
      // prompts come in frames. Neither is the game.
      if (m.tagName.toLowerCase() === 'svg') continue;
      if (m.tagName === 'IFRAME' && !VIDEO_FRAME.test(m.src)) continue;
      const r = m.getBoundingClientRect();
      if (r.width < 96 || r.height < 64) continue; // icons and avatars
      const box = mediaFrame(m, r);
      const b = box.getBoundingClientRect();
      // Something the size of the window is an overlay or a backdrop.
      if (b.width >= innerWidth * 0.9 && b.height >= innerHeight * 0.9) continue;
      if (box.closest('[aria-modal="true"],[role="dialog"]')) continue;
      if (pinned(box)) continue; // floating prompts and app banners
      blur(box);
    }
  }

  function pinned(el) {
    for (let n = el, i = 0; n && n !== document.body && i < 12; n = n.parentElement, i++) {
      if (getComputedStyle(n).position === 'fixed') return true;
    }
    return false;
  }

  // The box that holds just this picture (a figure, a link, a wrapper), so the
  // frame can sit around it.
  function mediaFrame(m, r) {
    let el = m;
    for (let i = 0; i < 4; i++) {
      const up = el.parentElement;
      if (!up || WALL.has(up.tagName) || up.textContent.trim().length > 160) break;
      const b = up.getBoundingClientRect();
      if (b.width * b.height > r.width * r.height * 1.6) break;
      el = up;
    }
    // A bare picture can't carry a frame (no ::before on an img), so take a
    // wrapper that is about as tall as it, even if wider.
    if (el === m && /^(IMG|VIDEO|CANVAS|IFRAME|SVG|EMBED|OBJECT)$/i.test(m.tagName)) {
      const up = m.parentElement;
      if (up && !WALL.has(up.tagName) && up.textContent.trim().length <= 160 && up.getBoundingClientRect().height <= r.height * 1.4) return up;
    }
    return el;
  }

  function goBack() {
    if (history.length > 1) history.back();
    else send({ type: 'closeTab' });
  }

  // The cover's display type, loaded once from the extension.
  let fontAdded = false;
  function addFont() {
    if (fontAdded || typeof FontFace !== 'function') return;
    fontAdded = true;
    try {
      const face = new FontFace('Nowanted Display', `url(${api.runtime.getURL('fonts/anton-latin-400-normal.woff2')})`);
      document.fonts.add(face);
      face.load().catch(() => {});
    } catch {}
  }

  function buildVeil() {
    addFont();
    const host = document.createElement('div');
    host.id = 'gsb-veil';
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .scrim {
          position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
          background: rgba(14, 8, 22, 0.8);
          -webkit-backdrop-filter: blur(32px) grayscale(0.7); backdrop-filter: blur(32px) grayscale(0.7);
          font: 400 14px/20px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          color: #ededed;
        }
        .panel {
          width: 100%; max-width: 360px; box-sizing: border-box; overflow: hidden;
          background: #161020; border: 1px solid rgba(237, 237, 237, 0.1); border-radius: 16px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
        }
        .art { position: relative; height: 120px; overflow: hidden; }
        .art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 62% 76%; }
        .art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(rgba(22, 16, 32, 0) 30%, rgba(22, 16, 32, 0.85)); }
        h2 {
          position: absolute; left: 24px; right: 24px; bottom: 12px; z-index: 1; margin: 0;
          font: 400 28px/32px "Nowanted Display", Impact, "Arial Narrow", sans-serif; text-transform: uppercase; letter-spacing: 0.01em; color: #ffffff;
        }
        .body { padding: 16px 24px 24px; }
        .bar { display: inline-block; vertical-align: -2px; width: 40px; height: 14px; margin-left: 4px; background: #ededed; border-radius: 2px; }
        p { margin: 0 0 20px; color: #b4adbf; }
        .row { display: flex; gap: 8px; }
        button {
          all: unset; box-sizing: border-box; height: 36px; padding: 0 16px; border-radius: 8px; cursor: pointer;
          font: 500 14px/36px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: center;
          transition: background-color 0.08s cubic-bezier(0.22, 1, 0.36, 1), transform 0.08s cubic-bezier(0.22, 1, 0.36, 1);
        }
        button:active { transform: scale(0.98); }
        button:focus-visible { outline: 2px solid #ff5aa8; outline-offset: 2px; }
        .back { background: #ededed; color: #171717; }
        .back:hover { background: #ffffff; }
        .show { background: #261c33; color: #ededed; box-shadow: inset 0 0 0 1px rgba(237, 237, 237, 0.1); }
        .show:hover { background: #33284a; }
        [hidden] { display: none; }
        @media (max-height: 240px), (max-width: 300px) {
          .panel { padding: 12px; width: auto; }
          .art, p, .back { display: none; }
          .body { padding: 0; }
        }
        @media (prefers-reduced-motion: reduce) { button { transition: none; } }
      </style>
      <div class="scrim">
        <div class="panel" role="dialog" aria-labelledby="t">
          <div class="art"><img alt=""><h2 id="t">Spoilers ahead</h2></div>
          <div class="body">
            <p></p>
            <div class="row">
              <button class="back" type="button"></button>
              <button class="show" type="button">Show it anyway</button>
            </div>
          </div>
        </div>
      </div>`;
    shadow.querySelector('.art img').src = api.runtime.getURL('art/scene.svg');
    const back = shadow.querySelector('.back');
    const show = shadow.querySelector('.show');
    back.textContent = history.length > 1 ? 'Go back' : 'Close tab';
    back.hidden = !isTop;
    show.hidden = S.reveal === 'locked';
    back.addEventListener('click', goBack);
    let sure = 0;
    show.addEventListener('click', () => {
      if (sure) return showPage();
      show.textContent = 'Yes, show spoilers';
      sure = setTimeout(() => {
        sure = 0;
        show.textContent = 'Show it anyway';
      }, ASK_MS);
    });
    // Keep page shortcuts (space to play, and so on) from acting on what is covered.
    host.addEventListener('keydown', (e) => e.stopPropagation());
    host.sync = () => {
      show.hidden = S.reveal === 'locked';
      const listed = src.any && src.test(location.href);
      shadow.getElementById('t').textContent = listed ? 'You blocked this page' : 'Spoilers ahead';
      // The name is set in bold, the way the site writes it.
      const name = document.createElement('b');
      name.textContent = 'No Wanted';
      shadow.querySelector('p').replaceChildren(...(listed
        ? ['It’s on your always-blur list, so ', name, ' covered it and stopped any video']
        : ['This page is about GTA 6. ', name, ' covered it and stopped any video, so nothing gets spoiled']));
    };
    return host;
  }

  // ---------- watching the page ----------

  const OBSERVE = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS };

  function onMutations(records) {
    if (location.href !== lastUrl) onUrlChange();
    if (!active) return;
    if (pageOn && veil && !veil.isConnected) root.appendChild(veil);

    const stale = new Set();
    const fresh = new Set();
    const relabeled = new Set();
    let titleTouched = false;

    for (const r of records) {
      const t = r.target;
      const el = t.nodeType === 1 ? t : t.parentElement;
      if (!el) {
        // a shadow root or the document itself
        if (r.type === 'childList') for (const n of r.addedNodes) if (n.nodeType === 1) fresh.add(n);
        continue;
      }
      if (el.tagName === 'TITLE' || (el.tagName === 'HEAD' && r.type === 'childList')) {
        titleTouched = true;
        continue;
      }
      const owner = closestAcross(el, HIDDEN);
      if (owner) {
        stale.add(owner);
        continue;
      }
      if (r.type === 'childList') {
        for (const n of r.addedNodes) {
          if (n.nodeType === 1) fresh.add(n);
          else if (n.nodeType === 3) fresh.add(el);
        }
      } else if (r.type === 'attributes') {
        relabeled.add(el);
      } else {
        fresh.add(el);
      }
    }

    for (const el of stale) recheck(el);
    for (const el of relabeled) {
      if (el.isConnected && !SKIP_TAG.has(el.tagName) && attrHits(el)) flag(el);
    }
    for (const el of fresh) {
      if (!el.isConnected) continue;
      if (pageOn) gateAll(el); // a player added under the page cover
      const found = scan(el);
      // A small piece ("6", "GTA") may finish a match that starts next to it.
      const parent = el.parentElement;
      if (!found && parent && !WALL.has(parent.tagName) && el.textContent.length <= 40 && parent.textContent.length <= 2000) {
        scan(parent);
      }
    }
    if (titleTouched) onTitleChange();
  }

  const observer = new MutationObserver(onMutations);

  function onUrlChange() {
    lastUrl = location.href;
    pageShown = cameFromAllowed();
    pageAbout = pageShown;
    build();
    checkPage();
    if (active) scan(root);
  }

  // ---------- settings and reporting ----------

  function send(msg) {
    try {
      const p = api.runtime.sendMessage(msg);
      if (p?.catch) p.catch(() => {});
    } catch {
      // the extension was reloaded; this page keeps its last state
    }
  }

  let ready = false; // settings have loaded, so the counts are real
  let reportTimer = 0;
  function report() {
    if (reportTimer || !ready) return;
    reportTimer = setTimeout(() => {
      reportTimer = 0;
      for (const el of blurred) {
        if (el.isConnected) continue;
        blurred.delete(el);
        watcher?.unobserve(el);
      }
      send({ type: 'count', n: currentCount(), added, site });
      added = {};
    }, 400);
  }

  const currentCount = () => blurred.size + (pageOn ? 1 : 0);

  // Blur strength, frame color and the tag word, as variables the CSS reads.
  function look() {
    const [frame, edge] = G.FRAMES[S.frame] || G.FRAMES.sunset;
    const tag = G.TAGS.includes(S.tag) ? S.tag : 'Spoilers';
    root.style.setProperty('--gsb-blur', `${S.blur}px`);
    root.style.setProperty('--gsb-frame', frame);
    root.style.setProperty('--gsb-edge', edge);
    root.style.setProperty('--gsb-tag', JSON.stringify(tag));
  }

  // What of the rules file is used: nothing when updates are switched off.
  const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
  function readRules() {
    const raw = rulesRaw;
    if (S.updates === false || !raw || typeof raw !== 'object' || raw.version !== 1) return null;
    return {
      words: strings(raw.words).filter((w) => w.trim().length >= 3),
      sources: strings(raw.sources),
      off: strings(raw.off).map((h) => G.siteOf(h)),
      sites: raw.sites && typeof raw.sites === 'object' ? raw.sites : {},
    };
  }

  function applyRules(raw) {
    rulesRaw = raw || null;
    if (ready) apply(S); // before the settings arrive, they pick the rules up themselves
  }

  function apply(next) {
    const before = JSON.stringify([S.level, S.extraTerms, S.sources, active, S.hidePages, R]);
    S = { ...G.DEFAULTS, ...next };
    R = readRules();
    adapter = G.adapterFor(location.hostname, R?.sites);
    build();
    // An allowed site covers its subdomains too: allowing github.com also
    // leaves gist.github.com and docs.github.com alone.
    const listed = (list) => !!list?.some((h) => site === h || site.endsWith('.' + h));
    active = S.enabled && !listed(S.offSites) && !listed(R?.off) && !listed(OWN_SITES);
    look();
    root.toggleAttribute('data-gsb-locked', S.reveal === 'locked');
    quiet();
    veil?.sync();
    const after = JSON.stringify([S.level, S.extraTerms, S.sources, active, S.hidePages, R]);
    if (!ready) {
      ready = true;
      if (!active) added = {};
      report();
    }
    if (before === after) {
      gateAll(document);
      return;
    }
    clearAll();
    for (const el of document.querySelectorAll('[data-gsb="0"]')) el.removeAttribute('data-gsb');
    pageShown = false;
    checkPage();
    if (active) scan(root);
    report();
  }

  function start() {
    observer.observe(document, OBSERVE);
    listenMedia(document);
    for (const type of ['click', 'auxclick', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu']) {
      window.addEventListener(type, onPress, true);
    }
    for (const type of ['mouseover', 'mouseenter', 'mousemove', 'pointerover', 'pointerenter', 'pointermove', 'touchstart']) {
      window.addEventListener(type, onHover, { capture: true, passive: true });
    }
    window.addEventListener('keydown', onKey, true);
    for (const type of ['popstate', 'hashchange', 'yt-navigate-finish', 'pageshow']) {
      window.addEventListener(type, () => location.href !== lastUrl && onUrlChange(), true);
    }
    document.addEventListener('DOMContentLoaded', () => {
      followTitle();
      checkPage();
    });
    setInterval(() => location.href !== lastUrl && onUrlChange(), 1000);

    look();
    quiet();
    checkPage();
    scan(root);
    report();

    try {
      api.storage.sync.get(G.DEFAULTS).then(apply, () => {});
      api.storage.local.get('rules').then((v) => v?.rules && applyRules(v.rules), () => {});
      api.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.rules) return applyRules(changes.rules.newValue);
        if (area !== 'sync') return;
        const next = { ...S };
        for (const [key, change] of Object.entries(changes)) {
          if (key in G.DEFAULTS) next[key] = change.newValue ?? G.DEFAULTS[key];
        }
        apply(next);
      });
      api.runtime.onMessage.addListener((msg, _sender, respond) => {
        if (msg?.type === 'count' && isTop) respond({ n: currentCount(), active, site });
      });
    } catch {
      // no extension context (reloaded); keep working with the defaults
    }
  }

  start();
})();
