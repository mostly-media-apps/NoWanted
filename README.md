<p align="center">
  <img src="docs/hero.jpg" alt="Spoilers: No Wanted. Play it before you see it, over a sunset on the Vice City coast" width="100%">
</p>

<p align="center">
  <b>Play GTA 6 before you see it.</b><br>
  A browser extension that blurs GTA 6 spoilers on every site, so you can stay online until you've played it.
</p>

<p align="center">
  <a href="#chrome-edge-brave-arc"><img alt="Chrome: install by hand" src="https://img.shields.io/badge/Chrome-install%20by%20hand-2b2236?style=flat-square&logo=googlechrome&logoColor=ededed&labelColor=100d15"></a>
  <a href="#firefox"><img alt="Firefox: in review" src="https://img.shields.io/badge/Firefox-in%20review-2b2236?style=flat-square&logo=firefoxbrowser&logoColor=ededed&labelColor=100d15"></a>
  <a href="#safari"><img alt="Safari: coming soon" src="https://img.shields.io/badge/Safari-coming%20soon-2b2236?style=flat-square&logo=safari&logoColor=ededed&labelColor=100d15"></a>
  <a href="#privacy"><img alt="Data collected: none" src="https://img.shields.io/badge/data%20collected-none-ff5aa8?style=flat-square&labelColor=100d15"></a>
  <img alt="Version 1.0.0" src="https://img.shields.io/badge/version-1.0.0-2b2236?style=flat-square&labelColor=100d15">
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-2b2236?style=flat-square&labelColor=100d15">
</p>

<p align="center">
  <a href="#install"><b>Install</b></a> &nbsp;·&nbsp;
  <a href="#what-it-does">What it does</a> &nbsp;·&nbsp;
  <a href="#privacy">Privacy</a> &nbsp;·&nbsp;
  <a href="https://nowanted.online">nowanted.online</a>
</p>

<br>

<p align="center">
  <img src="docs/demo.gif" alt="A video feed where every GTA 6 video blurs in place with a Spoilers label, and one asks before it shows its title" width="100%">
</p>

## What it does

Videos, Shorts, Reels, TikToks, posts, comments, search results, headlines and articles about the game are blurred right where they sit. The channel or author stays readable, so you know whose post it is. Click one and it asks before showing anything.

<table>
  <tr>
    <td width="50%"><img src="docs/youtube.png" alt="A YouTube feed with the GTA 6 videos blurred and framed"><br><b>Feeds</b><br><sub>Every GTA 6 video blurred in place, with the channel still in view</sub></td>
    <td width="50%"><img src="docs/posts.png" alt="A post on X blurred with its author kept"><br><b>Posts and comments</b><br><sub>X, Reddit, TikTok, Instagram and more, one post or one comment at a time</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/cover.png" alt="A news article covered with a Spoilers ahead card"><br><b>Whole pages</b><br><sub>A review, a trailer or a search for the game gets one cover and a way back</sub></td>
    <td width="50%"><img src="docs/block.png" alt="The toolbar menu, drawn as a phone, blocking an account on X"><br><b>Block accounts</b><br><sub>Type a name into the menu and everything that account posts is hidden</sub></td>
  </tr>
</table>

- **It pauses and mutes** a blurred video, so a Short can't spoil it out loud
- **It catches every spelling:** GTA 6, GTA VI, GTA6, Grand Theft Auto VI, hashtags, and Russian, Chinese, Japanese, Korean and Arabic
- **You pick how much counts:** the title only, names and places too (the cast, Leonida, Vice City), or the whole series
- **Allow any website** from the menu, and No Wanted leaves it alone
- **It knows the big sites:** YouTube, X, Reddit, TikTok, Instagram, Facebook, Twitch, Bluesky, Google, Bing and DuckDuckGo. Everywhere else it finds the card or paragraph around the mention

<p align="center">
  <img src="docs/stats.png" alt="The stats screen: 1,284 spoilers blocked, by day, by kind and by site" width="70%"><br>
  <sub>It counts every spoiler you dodged, in your browser only</sub>
</p>

## Install

| Browser | Status | |
| --- | --- | --- |
| Chrome, Edge, Brave, Arc | Store listing on the way | [Install by hand](#chrome-edge-brave-arc) in a minute |
| Firefox | In review on Firefox Add-ons | [Try it now](#firefox) |
| Safari on Mac, iPhone and iPad | Coming soon | |

### Chrome, Edge, Brave, Arc

1. Download **`nowanted-chrome-1.0.0.zip`** from the [Releases](../../releases) page and unzip it
2. Open <kbd>chrome://extensions</kbd> and turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick the unzipped folder
4. Pin No Wanted from the puzzle-piece menu so its button stays in the toolbar
5. Reload any tabs that were already open

### Firefox

No Wanted is in review on Firefox Add-ons, and this section will link to it once it's live. To try it before then:

1. Download **`nowanted-firefox-1.0.0.zip`** from [Releases](../../releases)
2. Open <kbd>about:debugging#/runtime/this-firefox</kbd>
3. Click **Load Temporary Add-on** and pick the zip

Firefox removes it again when it restarts.

### Safari

Coming soon for Mac, iPhone and iPad.

## Privacy

No Wanted works inside your browser. It has no account, no analytics and no ads, and it collects nothing.

- The text of the pages you open is checked on your computer and never leaves it
- Once a day it downloads one small rules file from nowanted.online with new words and site fixes. It's data only, nothing in it runs as code, and the request carries nothing about you. You can switch it off in Settings
- Your stats stay on your computer. Removing the extension removes everything it saved

The full policy is at [nowanted.online/privacy](https://nowanted.online/privacy.html).

<details>
<summary><b>What it can't catch</b></summary>
<br>

- It reads text, not pictures. A thumbnail or clip with no title, caption, hashtag or link that names the game gets through
- Sound in an unlabeled video isn't caught either
- Site layouts change. If a site stops blurring whole posts, tell us at bugs@nowanted.online

</details>

<details>
<summary><b>Build it yourself</b></summary>
<br>

    node scripts/build.mjs

This writes `dist/nowanted-chrome-<version>.zip` and `dist/nowanted-firefox-<version>.zip`. You can also load this folder directly in Chrome with **Load unpacked**.

</details>

<br>

<p align="center">
  <sub>Fonts: IBM Plex Sans, IBM Plex Mono and Anton, SIL Open Font License.<br>
  No Wanted is a fan project. It is not affiliated with Rockstar Games or Take-Two Interactive. Grand Theft Auto and GTA are their trademarks.<br>
  © 2026 No Wanted. All rights reserved.</sub>
</p>
