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
(() => {
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
        if (s === '1' || s === '2' || s === '3') return !(n.hasAttribute('data-gsb-ok') && onPart);
      }
      return false;
    } catch {
      return false;
    }
  };

  // Written as a method so the replacement is still named "play".
  const play = proto.play;
  proto.play = {
    play() {
      if (held(this)) return Promise.reject(new DOMException('The video is hidden, so it stays stopped', 'NotAllowedError'));
      return play.apply(this, arguments);
    },
  }.play;

  const muted = Object.getOwnPropertyDescriptor(proto, 'muted');
  if (muted?.set) {
    Object.defineProperty(proto, 'muted', {
      ...muted,
      set(value) {
        muted.set.call(this, held(this) ? true : value);
      },
    });
  }
})();
