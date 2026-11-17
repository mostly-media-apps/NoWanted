// How a hidden item looks. This is the one source for it: the page gets it as
// src/content.css (written from here by scripts/css.mjs), and shadow roots,
// which a page stylesheet cannot reach, get it injected by content.js.
//
// data-gsb values: "1" a framed card, "2" a card with no box of its own,
// "3" a small or text-only element (blurred as one piece).
//
// Inside a card each piece is blurred inside its own box (data-gsb-part:
// "m" a picture or video, "t" a line of text), so the card keeps its shape.
// The channel or author (data-gsb-keep) stays readable. data-gsb-ok marks a
// card the person allowed: the frame and the blur stay, and only the piece
// under the pointer clears.
globalThis.GSB.CSS = `
[data-gsb="1"] [data-gsb-part],
[data-gsb="2"] [data-gsb-part] {
  filter: blur(var(--gsb-blur, 20px)) grayscale(0.7) !important;
  clip-path: inset(0 round 8px) !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
[data-gsb="1"] [data-gsb-part="t"],
[data-gsb="2"] [data-gsb-part="t"] {
  filter: blur(max(6px, calc(var(--gsb-blur, 20px) * 0.4))) grayscale(0.7) !important;
  clip-path: inset(0 round 4px) !important;
}
[data-gsb="1"][data-gsb-ok] [data-gsb-part]:hover,
[data-gsb="2"][data-gsb-ok] [data-gsb-part]:hover {
  filter: none !important;
  clip-path: none !important;
}

/* A small item ("3"): its text is turned into a blurred shadow instead of
   filtering the element, so the frame drawn on it stays sharp. */
[data-gsb="3"]:not([data-gsb-ok]:hover),
[data-gsb="3"]:not([data-gsb-ok]:hover) * {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  text-shadow: 0 0 max(8px, calc(var(--gsb-blur, 20px) * 0.5)) rgba(128, 128, 128, 0.9) !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
[data-gsb="3"]:not([data-gsb-ok]:hover) :is(img, video, canvas, svg, picture, iframe, object, embed),
:is(img, video, canvas, svg, picture, iframe, object, embed)[data-gsb="3"]:not([data-gsb-ok]:hover) {
  filter: blur(var(--gsb-blur, 20px)) grayscale(0.7) !important;
}
/* A bare picture with nothing to wrap it in: an outline is the one frame it can take. */
:is(img, video, canvas, iframe, embed, object)[data-gsb="3"] { outline: 2px solid var(--gsb-edge, #ff4fa3) !important; outline-offset: -2px !important; }
/* Its own stacking context, so the frame stays under the site's sticky headers. */
[data-gsb="3"] { isolation: isolate !important; }
[data-gsb="3"][data-gsb-rel] { position: relative !important; }
[data-gsb="3"]::after {
  content: "" !important; position: absolute !important; inset: -2px !important; z-index: 2147483000 !important;
  display: block !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important;
  width: auto !important; height: auto !important;
  border: 2px solid transparent !important; border-radius: inherit !important;
  background: var(--gsb-frame, linear-gradient(135deg, #ff4fa3, #ff8a3d 55%, #8b3fd9)) border-box !important;
  -webkit-mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0) border-box !important;
  -webkit-mask-composite: xor !important;
  mask: linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0) border-box !important;
  clip-path: none !important;
  filter: none !important; opacity: 1 !important; transform: none !important; visibility: visible !important;
  pointer-events: none !important; transition: none !important; animation: none !important;
}
[data-gsb="3"][data-gsb-ask]::after { border-width: 4px !important; }

/* A card with no box of its own ("2"): each child carries the frame. */
[data-gsb="2"] > * { outline: 2px solid var(--gsb-edge, #ff4fa3) !important; outline-offset: -2px !important; }
[data-gsb="2"][data-gsb-ask] > * { outline-width: 4px !important; }

[data-gsb="1"]:not([data-gsb-ok]), [data-gsb="2"]:not([data-gsb-ok]), [data-gsb="3"]:not([data-gsb-ok]) { cursor: pointer !important; }
:root[data-gsb-locked] [data-gsb="1"], :root[data-gsb-locked] [data-gsb="2"], :root[data-gsb-locked] [data-gsb="3"] { cursor: default !important; }
[data-gsb="1"]:not([data-gsb-ok]) *, [data-gsb="2"]:not([data-gsb-ok]) *, [data-gsb="3"]:not([data-gsb-ok]) * { pointer-events: none !important; }

[data-gsb="1"] { isolation: isolate !important; }
[data-gsb="1"][data-gsb-rel] { position: relative !important; }

[data-gsb="1"]::before,
[data-gsb="1"]::after {
  position: absolute !important; z-index: 2147483000 !important;
  box-sizing: border-box !important; margin: 0 !important;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
  font-style: normal !important; letter-spacing: 0 !important; text-transform: none !important; text-decoration: none !important;
  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; text-align: center !important;
  filter: none !important; opacity: 1 !important; transform: none !important; visibility: visible !important;
  pointer-events: none !important; text-shadow: none !important;
  transition: none !important; animation: none !important; float: none !important;
}

/* The frame. It is there in every state. It sits 4px outside the card with
   round corners (--gsb-r, set by content.js from the card's own radius), so it
   never cuts across a rounded thumbnail or button inside a square card. On a
   card that clips its overflow, content.js sets --gsb-o to 0 and the frame stays
   on the inside edge, where the clip can't cut it off. The
   mask keeps only the 2px border ring of a gradient background, so the line is
   the same width all the way round, corners included. */
[data-gsb="1"]::before {
  content: "" !important;
  inset: calc(-1 * var(--gsb-o, 4px)) !important; width: auto !important; height: auto !important; padding: 0 !important;
  display: block !important;
  border: 2px solid transparent !important; border-radius: var(--gsb-r, 16px) !important;
  clip-path: none !important;
  background: var(--gsb-frame, linear-gradient(135deg, #ff4fa3, #ff8a3d 55%, #8b3fd9)) border-box !important;
  -webkit-mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0) border-box !important;
  -webkit-mask-composite: xor !important;
  mask: linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0) border-box !important;
  color: #ffffff !important; font-size: 14px !important; line-height: 20px !important; font-weight: 600 !important;
}

/* The tag in the corner, with the channel when it could not be kept in place. */
[data-gsb="1"]::after {
  content: var(--gsb-tag, "Spoilers") !important;
  inset: auto !important; top: 8px !important; right: 8px !important;
  display: block !important; width: auto !important; max-width: calc(100% - 16px) !important; height: 20px !important;
  padding: 0 8px !important; border: 0 !important; border-radius: 6px !important; clip-path: none !important;
  background: rgba(22, 12, 28, 0.88) !important; color: #ffffff !important;
  font-size: 11px !important; line-height: 20px !important; font-weight: 600 !important;
}
[data-gsb="1"][data-gsb-by]::after { content: var(--gsb-tag, "Spoilers") " · " attr(data-gsb-by) !important; }

/* Asking: a small panel in the middle, so the rest of the card (and its
   channel) stays in view. The button is drawn at a fixed spot so content.js
   knows where it is: 136 by 32, starting 4px below the middle. */
/* The panel and the frame share the one overlay, so the mask lets both through:
   the panel's shape on top of the border ring. */
[data-gsb="1"][data-gsb-ask]:not([data-gsb-ok])::before {
  content: "Show spoilers?" !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
  padding-bottom: 36px !important;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='184' height='96'%3E%3Crect width='184' height='96' rx='12' fill='rgb(22,12,28)'/%3E%3C/svg%3E") center / 184px 96px no-repeat,
    var(--gsb-frame, linear-gradient(135deg, #ff4fa3, #ff8a3d 55%, #8b3fd9)) border-box !important;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='184' height='96'%3E%3Crect width='184' height='96' rx='12'/%3E%3C/svg%3E") center / 184px 96px no-repeat, linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0) border-box !important;
  -webkit-mask-composite: source-over, xor !important;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='184' height='96'%3E%3Crect width='184' height='96' rx='12'/%3E%3C/svg%3E") center / 184px 96px no-repeat add, linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0) border-box !important;
}
[data-gsb="1"][data-gsb-ask]:not([data-gsb-ok])::after {
  content: "Yes, let me peek" !important;
  top: 50% !important; left: 50% !important; right: auto !important; width: 136px !important; max-width: none !important; height: 32px !important;
  margin: 4px 0 0 -68px !important; padding: 0 !important; border-radius: 8px !important;
  background: #ededed !important; color: #171717 !important;
  font-size: 13px !important; line-height: 32px !important; font-weight: 600 !important;
}
[data-gsb="1"][data-gsb-ask][data-gsb-over]:not([data-gsb-ok])::after { background: #ffffff !important; }
/* A short card has room for the button only. */
[data-gsb="1"][data-gsb-ask][data-gsb-sm]:not([data-gsb-ok])::before {
  content: "" !important; padding: 0 !important;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='44'%3E%3Crect width='160' height='44' rx='10' fill='rgb(22,12,28)'/%3E%3C/svg%3E") center / 160px 44px no-repeat,
    var(--gsb-frame, linear-gradient(135deg, #ff4fa3, #ff8a3d 55%, #8b3fd9)) border-box !important;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='44'%3E%3Crect width='160' height='44' rx='10'/%3E%3C/svg%3E") center / 160px 44px no-repeat, linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0) border-box !important;
  -webkit-mask-composite: source-over, xor !important;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='44'%3E%3Crect width='160' height='44' rx='10'/%3E%3C/svg%3E") center / 160px 44px no-repeat add, linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0) border-box !important;
}
[data-gsb="1"][data-gsb-ask][data-gsb-sm]:not([data-gsb-ok])::after { margin-top: -16px !important; }
`;
