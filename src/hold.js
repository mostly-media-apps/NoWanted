// Runs in the page's own world (see "world": "MAIN" in the manifest), where the
// site's player lives. content.js marks a video or sound it is holding with
// data-gsb-hold. While the mark is there, the site cannot start it or turn its
// sound on.
//
// It also holds any video that sits inside a hidden post or under the page
// cover, mark or no mark (see held below).
//
// Why this exists: pausing from outside is not enough. X starts a video again
// the moment it is paused, about 1,500 times a second, so the video ran on under
// the blur and its sound could come through in bursts. Here the site's own
// play() is refused, the same way a browser refuses autoplay, which every
// player already handles. Nothing is read, stored or sent.
//
// One more thing is done here, for the same reason (only the page's own world
// can see it): when the site gives an element a shadow root, content.js is
// told with an event, "gsb-shadow". A site may build a whole part of its page
// in a shadow root long after the page has loaded (X's Chat does), and from
// outside nothing shows that it happened, so that part stayed unread.
(() => {
  'use strict';
  const MARK = Symbol.for('gsb.hold');
  if (globalThis[MARK]) return;
  try {
    Object.defineProperty(globalThis, MARK, { value: true });
  } catch {
    // globalThis may be non-extensible; each patch checks MARK on its own wrapper
  }

  function replaceMethod(proto, key, make) {
    if (!proto) return;
    try {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      const orig = desc && 'value' in desc ? desc.value : proto[key];
      if (typeof orig !== 'function' || orig[MARK]) return;
      const wrapped = make(orig);
      wrapped[MARK] = true;
      if (!desc || desc.writable) {
        proto[key] = wrapped;
      } else if (desc.configurable) {
        Object.defineProperty(proto, key, {
          configurable: true,
          enumerable: desc.enumerable,
          writable: false,
          value: wrapped,
        });
      }
    } catch {
      // Another script may have locked or guarded this property; leave it alone.
    }
  }

  replaceMethod(globalThis.Element?.prototype, 'attachShadow', (attach) => ({
    // Written as a method so the replacement is still named "attachShadow".
    attachShadow() {
      const root = attach.apply(this, arguments);
      try {
        this.dispatchEvent(new Event('gsb-shadow', { bubbles: true, composed: true }));
      } catch {
        // the site's call is never held up by this
      }
      return root;
    },
  }).attachShadow);

  const HOLD = 'data-gsb-hold';
  // On <html> while No Wanted is on and set to stop media in hidden items.
  const QUIET = 'data-gsb-quiet';
  const proto = globalThis.HTMLMediaElement?.prototype;
  if (!proto) return;
  // Is this video inside something hidden right now? Asked at the moment the
  // site calls play(), so a video the site adds to a post that is already
  // hidden, or to a page that is already covered, never starts: there is no
  // wait for content.js to notice it and mark it. The answer is the same one
  // content.js gives (isHidden): a post the person allowed plays only while
  // the pointer is on the piece that holds the video.
  const held = (m) => {
    try {
      if (m.hasAttribute(HOLD)) return true;
      if (!document.documentElement?.hasAttribute(QUIET)) return false;
      if (document.getElementById('gsb-veil')) return true;
      let onPart = false;
      for (let n = m; n; n = n.parentNode || n.host) {
        if (n.nodeType !== 1) continue;
        if (n.hasAttribute('data-gsb-part') && n.matches(':hover')) onPart = true;
        const s = n.getAttribute('data-gsb');
        if (s === '1' || s === '2' || s === '3' || s === 'h') return !(n.hasAttribute('data-gsb-ok') && onPart);
      }
      return false;
    } catch {
      return false;
    }
  };

  replaceMethod(proto, 'play', (play) => ({
    // Written as a method so the replacement is still named "play".
    play() {
      if (held(this)) return Promise.reject(new DOMException('The video is hidden, so it stays stopped', 'NotAllowedError'));
      return play.apply(this, arguments);
    },
  }).play);

  try {
    const muted = Object.getOwnPropertyDescriptor(proto, 'muted');
    if (muted?.configurable && typeof muted.set === 'function' && !muted.set[MARK]) {
      const origSet = muted.set;
      const set = function (value) {
        origSet.call(this, held(this) ? true : value);
      };
      set[MARK] = true;
      Object.defineProperty(proto, 'muted', { ...muted, set });
    }
  } catch {
    // Another script may have locked muted; leave it alone.
  }
})();
