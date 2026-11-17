# No Wanted

![No Wanted: blurs GTA 6 videos, posts, comments and articles on every site](docs/banner.png)

A browser extension that blurs GTA 6 spoilers on every site, so you can stay online until you've played it. Videos, Shorts, Reels, TikToks, posts, comments, search results, headlines and articles about the game are blurred in place. A page that is entirely about the game gets one cover with a way back. Hidden videos are paused and muted.

![A YouTube home feed with the GTA 6 videos blurred and framed, and one asking "Show spoilers?"](docs/youtube.png)

- Click a blurred post and it asks before showing anything
- The channel or author stays readable, so you know whose post it is
- Block whole accounts from the menu, per platform
- Choose how much counts as a spoiler: the title only, the cast and map, or the whole series

Everything runs in your browser and it collects nothing. Once a day it downloads one small rules file with new words and site fixes (data only, no code) from nowanted.online. You can turn that off in Settings.

Website: https://nowanted.online

## Install

Store versions are on the way. Until then, install it by hand. The zips are on the [Releases](../../releases) page.

### Chrome, Edge, Brave, Arc and other Chromium browsers

1. Download `nowanted-chrome-1.0.0.zip` from Releases and unzip it
2. Open `chrome://extensions` and turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick the unzipped folder
4. Reload any tabs that were already open

You can also skip the download and pick the folder of this repository in step 3.

### Firefox

Firefox only keeps unsigned extensions until it restarts, so this is for trying it out until the Firefox Add-ons version is live.

1. Download `nowanted-firefox-1.0.0.zip` from Releases
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** and pick the zip
4. Reload any tabs that were already open

### Safari (Mac, iPhone and iPad)

Safari extensions ship inside an app, so this needs a Mac with Xcode and Node.js.

1. Run `node scripts/build.mjs` in this folder. It writes the extension files to `dist/safari`
2. Open `safari/Nowanted/Nowanted.xcodeproj` in Xcode
3. Pick the **Nowanted (macOS)** scheme and run it. To install on an iPhone, pick **Nowanted (iOS)** and your own team under Signing
4. On a Mac, turn on Safari's **Develop › Developer Settings › Allow unsigned extensions**, then enable No Wanted in **Safari › Settings › Extensions**. On iPhone, go to **Settings › Apps › Safari › Extensions**

## Limits

- It reads text, not pictures. A thumbnail or clip with no title, caption, hashtag or link that names the game is not caught
- Sound in an unlabeled video is not caught either
- Site layouts change. If a site stops blurring whole posts, report it: bugs@nowanted.online

## Build

    node scripts/build.mjs

This writes `dist/nowanted-chrome-<version>.zip`, `dist/nowanted-firefox-<version>.zip` and `dist/safari`.

Fonts: IBM Plex Sans, IBM Plex Mono and Anton, SIL Open Font License (`fonts/`).

No Wanted is a fan project. It is not affiliated with Rockstar Games or Take-Two Interactive.
