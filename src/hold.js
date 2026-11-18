// Runs in the page's own world (see "world": "MAIN" in the manifest), where the
// site's player lives. content.js marks a video or sound it is holding with
// data-gsb-hold. While the mark is there, the site cannot start it or turn its
// sound on.
//
// Why this exists: pausing from outside is not enough. X starts a video again
// the moment it is paused, about 1,500 times a second, so the video ran on under
// the blur and its sound could come through in bursts. Here the site's own
// play() is refused, the same way a browser refuses autoplay, which every
// player already handles. Nothing is read, stored or sent.
(() => {
  const HOLD = 'data-gsb-hold';
  const proto = globalThis.HTMLMediaElement?.prototype;
  if (!proto) return;
  const held = (m) => {
    try {
      return m.hasAttribute(HOLD);
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
