// Per-site knowledge: which element is "one post" (cards), and which element
// names the page itself (signals). Sites not listed here use the general rules
// in content.js, which find the repeated block around a match.
(() => {
  const SITES = [
    {
      hosts: ['youtube.com', 'youtube-nocookie.com', 'youtu.be'],
      keep: 'ytd-channel-name, #channel-name, a[href^="/@"], a[href^="/channel/"], #author-text, .ytp-ce-channel-title',
      by: 'ytd-channel-name #text, ytd-channel-name a, a[href^="/@"], a[href^="/channel/"], #author-text, .ytp-ce-channel-title',
      // The thumbnail, the title and the line under it each blur as one shape.
      // The channel's picture and the three-dot menu stay, and the menu works
      // (that is where "Don't recommend channel" lives). The empty layers
      // YouTube puts on every button for its press effect are left alone, and
      // so are its badges ("New", "4K", "LIVE"), which blurred into loose bits.
      // A video's list of chapters blurs as one shape.
      blocks: 'yt-thumbnail-view-model, ytd-thumbnail, a#thumbnail, h3, #video-title, .ytContentMetadataViewModelHost, #metadata-line, .metadata-snippet-container, #description-text, #expandable-metadata',
      plain: 'yt-interaction, [class*="TouchFeedbackShape"], [class*="ShapeStaticWash"], badge-shape, [class*="ytBadgeShape"], ytd-badge-supported-renderer, .ytLockupMetadataViewModelMenuButton, ytd-menu-renderer, .ytLockupMetadataViewModelAvatar, yt-decorated-avatar-view-model, #avatar-link, #channel-thumbnail, #avatar-section, #author-thumbnail, #subscribe-button, ytd-subscribe-button-renderer, yt-subscribe-button-view-model',
      live: '.ytLockupMetadataViewModelMenuButton, ytd-menu-renderer',
      cards: [
        'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-compact-video-renderer',
        'ytd-grid-video-renderer', 'ytd-playlist-video-renderer', 'ytd-playlist-panel-video-renderer',
        'ytd-playlist-renderer', 'ytd-compact-playlist-renderer', 'ytd-radio-renderer',
        'ytd-compact-radio-renderer', 'ytd-movie-renderer', 'ytd-channel-renderer',
        'ytd-reel-item-renderer', 'ytd-reel-video-renderer', 'yt-lockup-view-model',
        'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
        'ytd-comment-view-model', 'ytd-comment-renderer', 'yt-live-chat-text-message-renderer', 'yt-live-chat-paid-message-renderer', 'yt-live-chat-membership-item-renderer', 'ytd-comment-replies-renderer ytd-comment-view-model', 'ytd-notification-renderer',
        'ytd-post-renderer', 'ytd-backstage-post-thread-renderer',
        'ytd-universal-watch-card-renderer', 'ytd-watch-card-compact-video-renderer',
        'ytd-search-refinement-card-renderer', 'ytd-macro-markers-list-item-renderer',
        'ytd-structured-description-content-renderer', 'yt-chip-cloud-chip-renderer',
        'ytd-endpoint-renderer', '.ytp-videowall-still', '.ytp-ce-element', '.ytp-suggestion-set',
        'ytm-video-with-context-renderer', 'ytm-compact-video-renderer', 'ytm-rich-item-renderer',
        'ytm-reel-item-renderer', 'ytm-reel-video-renderer', 'ytm-comment-renderer', 'ytm-playlist-video-renderer',
        '.ytSuggestionComponentSuggestion', '.sbsb_c',
        // Sponsored results and promoted videos, in search, on the home page
        // and next to a video. An ad for the game is hidden like any post.
        'ytd-ad-slot-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-sparkles-text-search-renderer',
        'ytd-promoted-video-renderer', 'ytd-compact-promoted-video-renderer', 'ytd-display-ad-renderer',
        'ytd-search-pyv-renderer', 'ytd-banner-promo-renderer', 'ytd-statement-banner-renderer',
        'ytd-brand-video-singleton-renderer', 'ytd-brand-video-shelf-renderer', 'ytd-video-masthead-ad-v3-renderer',
        'ytd-primetime-promo-renderer', 'ytm-promoted-sparkles-web-renderer', 'ytm-promoted-video-renderer',
      ],
      signals: [
        'ytd-watch-metadata h1', 'ytd-watch-metadata #title', 'ytm-slim-video-metadata-section-renderer',
        '.ytp-title-link', '.ytp-title-text', 'yt-page-header-view-model h1', 'ytd-channel-name#channel-name.ytd-c4-tabbed-header-renderer',
      ],
      main: '#movie_player, ytd-player#ytd-player, ytd-watch-metadata, ytd-reel-video-renderer[is-active], ytm-reel-video-renderer[is-active]',
      thread: ':is(ytd-comments, #comments) :is(ytd-comment-view-model, ytd-comment-renderer), yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer, yt-live-chat-membership-item-renderer, ytd-video-renderer, ytd-search :is(yt-lockup-view-model, ytd-reel-item-renderer, ytd-playlist-renderer, ytd-channel-renderer)',
    },
    {
      hosts: ['x.com', 'twitter.com'],
      // Virtualised timeline: hide mode falls back to blur until live-checked.
      noHide: true,
      keep: '[data-testid="User-Name"], [data-testid="UserName"], .x-middot-group > :first-child, [data-testid="UserCell"] a[role="link"]:not([href*="/status/"])',
      by: '[data-testid="User-Name"] span, [data-testid="UserCell"] span',
      // A post blurs as two clean shapes, its text and its media. The avatar,
      // the row of buttons and the menu stay as they are, and the menu works.
      blocks: '[data-testid="tweetText"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="card.wrapper"], [data-testid="article-cover-image"]',
      plain: '[data-testid="Tweet-User-Avatar"], [data-testid="caret"], [role="group"], [data-testid="socialContext"], button:not(:has(img, video)), [role="button"]:not(:has(img, video, [data-testid="tweetText"]))',
      live: '[data-testid="caret"]',
      // The label sits left of a post's own buttons: 12px down, 80px in from the
      // right. A message bubble has no buttons, so there it takes the usual corner.
      tag: [12, 80, ':not([data-testid="dm-message-list"] *)'],
      // A promoted post is an ordinary article here, and a promoted trend an
      // ordinary trend, so both are covered by the same cards.
      cards: [
        'article[data-testid="tweet"]', 'article[role="article"]', 'article', '[data-testid="trend"]',
        '[data-testid="UserCell"]', '[data-testid="typeaheadResult"]',
        '[data-testid="eventHero"]', 'a[href^="/i/trending/"]', 'a[href^="/i/events/"]',
        // In an open conversation, one bubble: the words of a message
        // (role="article") or what it carries, a shared post or a file
        // (role="group"). Never the message row, which is as wide as the page.
        '[data-testid="dm-message-list"] [data-testid^="message-"] :is([role="article"], [role="group"])',
      ],
      // A bubble is hidden whole. X's class names for it contain "chat", which
      // the general rules read as "a chat of several messages, hide one line".
      whole: '[data-testid="dm-message-list"] [data-testid^="message-"] :is([role="article"], [role="group"])',
      // Rows that are not posts: only the named line of a row is hidden (or,
      // with no line named, the line that matched), never the row.
      rows: [
        // In the list of conversations it is the line with the last message:
        // the picture, the name and the time say who wrote, and the row still
        // opens the conversation.
        {
          in: '[data-testid^="dm-conversation-item-"], [data-testid^="dm-grok-bot-item-"]',
          only: 'a > div > div:last-child > div:last-child > div:first-child',
          open: true,
        },
        // The row of the older Messages page, whose layout is not known here:
        // the line that matched.
        { in: '[data-testid="conversation"]', open: true },
        // In a notification it is the quoted post: who did what stays clear.
        { in: 'article[data-testid="notification"]', only: '[data-testid="tweetText"]' },
      ],
      // Every post on X is one of the cards above, so anything else that names
      // the game is not a post (a line of a profile, the name of a List): only
      // that line is hidden, never the block around it.
      elsewhere: 'line',
      // Nothing is hidden in Settings. Its list of muted words is the person's
      // own, and for our users it names the game on every row.
      off: ['/settings'],
      // The name of the person you are talking to, the headers and the box you
      // write in are never hidden, whatever they say.
      leave: '[data-testid="dm-inbox-header"], [data-testid="dm-conversation-header"], [data-testid="dm-conversation-header-item"], [data-testid="dm-composer-container"]',
      // X's media viewer (/status/<id>/video/1) mounts the player in a dialog
      // outside <main> and <article> (either [data-testid="videoPlayer"] on
      // classic X or a bare div wrapping <video> on X's newer Media Viewer).
      main: ':is([role="dialog"], [aria-modal="true"]) :is([data-testid="videoPlayer"], [data-testid="videoComponent"], div:has(> video):not([data-testid="videoPlayer"] *, [data-testid="videoComponent"] *))',
      signals: [
        ':is([role="dialog"], [aria-modal="true"]) :is(li:first-child, [data-testid="cellInnerDiv"]:first-child) article',
        ':is([role="dialog"], [aria-modal="true"]) section > article:first-of-type',
      ],
      thread: 'main article[data-testid="tweet"], main [data-testid="UserCell"]',
    },
    {
      hosts: ['reddit.com'],
      // A post blurs as its title, its flair, its text and its picture. The
      // flair is words a poster or moderator chose ("Leak"), so it is hidden
      // with the rest, as one small shape, and is not kept as a name. The line above
      // the title (who posted, when, the three dots) and the share buttons are
      // the site's furniture. The three dots keep working on a hidden post:
      // that menu is where "Hide" and "Report" live.
      blocks: '[slot="title"], [slot="post-flair"], [slot="text-body"], [slot="post-media-container"], [slot="thumbnail"]',
      plain: '[slot="credit-bar"], [slot="share-button"], [slot="repost-button"], [slot="award-button"], [slot="full-post-link"], [slot="ssr-post-content-header"], faceplate-screen-reader-content, faceplate-loader',
      live: '[slot="credit-bar"] shreddit-post-overflow-menu, [slot="credit-bar"] > span:last-child > span:last-child',
      // The author and the subreddit stay readable. A post's title is a link
      // into the subreddit too ("/r/name/comments/..."), and is not one of them:
      // counted as the subreddit's name, a short title was left clear.
      keep: 'a[href^="/user/"], a[href^="/r/"]:not([href*="/comments/"], [href*="?f="], [slot="title"], [slot="full-post-link"])',
      by: 'a[href^="/r/"]:not([href*="/comments/"], [href*="?f="], [slot="title"], [slot="full-post-link"]), a[href^="/user/"]',
      byAttr: ['subreddit-prefixed-name', 'author'],
      cards: [
        'shreddit-post', 'shreddit-comment', 'shreddit-profile-comment',
        // promoted posts: in the feed, on a post's page, in the comments and beside them
        'shreddit-ad-post', 'shreddit-comments-page-ad', 'shreddit-comment-tree-ad', 'shreddit-sidebar-ad', 'shreddit-dynamic-ad-link',
        '[data-testid="search-post-unit"]', '[data-testid="search-sdui-post"]', '[data-testid="post-container"]',
        'reddit-pdp-right-rail-post', 'div.thing', 'li[rpl]', 'faceplate-tracker[source="search"]',
        'a[data-testid="subreddit-recommendation"]',
      ],
      signals: ['shreddit-title', 'shreddit-subreddit-header', 'h1[slot="title"]'],
      main: 'shreddit-post, div.thing.link',
      thread: 'shreddit-comment, shreddit-profile-comment, div.thing.comment, [data-testid="search-post-unit"], [data-testid="search-sdui-post"], faceplate-tracker[source="search"]',
    },
    {
      hosts: ['tiktok.com'],
      keep: '[data-e2e="video-author-uniqueid"], [data-e2e="search-card-user-unique-id"], [data-e2e="browse-username"], [data-e2e^="comment-username"]',
      by: '[data-e2e="video-author-uniqueid"], [data-e2e="search-card-user-unique-id"], [data-e2e="browse-username"], [data-e2e="comment-username-1"], a[href^="/@"]',
      cards: [
        '[data-e2e="recommend-list-item-container"]', 'article[data-scroll-index]',
        '[data-e2e="search_top-item"]', '[data-e2e="search_video-item"]', '[data-e2e="search-card-container"]',
        '[data-e2e="user-post-item"]', '[data-e2e="challenge-item"]', '[data-e2e="music-item"]',
        '[data-e2e="search-user-container"]', '[data-e2e="search-common-link"]',
        'div[class*="DivItemContainer"]', 'div[class*="DivCommentItemContainer"]',
        'div[class*="DivCommentObjectWrapper"]', 'div[class*="DivCommentItemWrapper"]', 'div[class*="CommentItem"]', 'div[class*="DivReplyContainer"] > div',
        'li[class*="LiItemContainer"]', 'section[class*="MediaCard"]',
      ],
      signals: ['[data-e2e="browse-video-desc"]', '[data-e2e="challenge-title"]', 'h1[data-e2e="search-title"]'],
    },
    {
      hosts: ['instagram.com', 'threads.net', 'threads.com'],
      comments: 'ul, [role="dialog"] section, article section',
      by: 'header a, a[role="link"] span',
      cards: [
        'article', '[data-pressable-container="true"]', 'div[role="dialog"] article',
        'a[href*="/reel/"]', 'a[href*="/p/"]', 'a[href*="/explore/tags/"]',
      ],
    },
    {
      hosts: ['facebook.com', 'fb.com', 'messenger.com'],
      comments: 'ul, [role="article"] [role="article"]',
      by: 'h2 a, h3 a, h4 a, strong',
      cards: [
        '[role="article"]', 'div[aria-posinset]', '[data-pagelet^="FeedUnit"]',
        'a[href*="/reel/"]', 'a[href*="/watch/"]', 'a[href*="/videos/"]',
      ],
    },
    {
      hosts: ['google.'],
      cards: [
        '.MjjYud', '.g', 'g-inner-card', 'g-card', 'g-section-with-header', '[data-news-doc-id]',
        '.related-question-pair', '.SoaBEf', '.WlydOe', 'video-voyager', '[data-lpage]',
        'li.sbct', '[role="option"]', '.isv-r', '[data-ri]', 'c-wiz article', '.kp-wholepage',
        '[data-attrid]', 'div[jsname][data-docid]',
      ],
      thread: '.MjjYud, .g, g-inner-card, g-card, .related-question-pair, .SoaBEf, .WlydOe, video-voyager, .isv-r, [data-ri], c-wiz article, .kp-wholepage, [data-attrid]',
    },
    {
      hosts: ['bing.com'],
      cards: ['li.b_algo', 'li.b_ans', '.b_top', '.news-card', '.mc_vtvc', '.dg_u', '.imgpt', 'li.sa_sg', '.b_entityTP'],
      thread: 'li.b_algo, li.b_ans, .b_top, .news-card, .mc_vtvc, .dg_u, .imgpt, .b_entityTP',
    },
    {
      hosts: ['duckduckgo.com'],
      cards: ['article', 'li[data-layout]', '[data-testid="result"]', '.module', '.tile', 'li.acp'],
      thread: 'article, li[data-layout], [data-testid="result"], .module, .tile',
    },
    {
      hosts: ['twitch.tv', 'kick.com'],
      // The channel's picture, the LIVE mark and the viewer count are the
      // site's furniture and stay as they are.
      plain: '.tw-avatar, [class*="ScAvatar"], [class*="ScChannelStatusTextIndicator"], [class*="ScMediaCardStatWrapper"], .tw-media-card-stat',
      // The row of tags under a stream's title blurs as one shape, not a pill each.
      blocks: 'div:has(> div > .tw-tag)',
      keep: '[data-a-target="preview-card-channel-link"], .chat-author__display-name, [data-test-selector="ChannelLink"]',
      by: '[data-a-target="preview-card-channel-link"], .chat-author__display-name, [data-test-selector="ChannelLink"]',
      cards: [
        'article', '.chat-line__message', '[data-a-target="chat-line-message"]', '.tw-tower > div',
        '[data-test-selector="shelf-card"]', '.game-card', 'a[data-a-target="preview-card-image-link"]',
        '.chat-entry', '.search-result-card', '[data-chat-entry]', '.vod-message', '.video-chat__message',
      ],
      signals: ['[data-a-target="stream-title"]', '[data-a-target="stream-game-link"]', 'h1.tw-title'],
      main: '.video-player, [data-a-target="video-player"], #video-player',
      thread: '.chat-line__message, [data-a-target="chat-line-message"], .vod-message, .video-chat__message, .chat-entry, .search-result-card',
    },
    {
      hosts: ['bsky.app'],
      // Virtualised feed: hide mode falls back to blur until live-checked.
      noHide: true,
      keep: 'a[href^="/profile/"]',
      by: 'a[href^="/profile/"]',
      cards: ['[data-testid^="feedItem-"]', '[data-testid^="postThreadItem-"]', '[data-testid="trendingTopic"]', 'a[href^="/hashtag/"]'],
      thread: '[data-testid^="postThreadItem-"], [data-testid^="feedItem-"]',
    },
    {
      hosts: ['linkedin.com'],
      cards: ['.feed-shared-update-v2', 'div[data-urn]', 'li.reusable-search__result-container', 'article', '.comments-comment-entity', '.comments-comment-item', 'article.comments-comment-item', '.news-module__storyline'],
      main: '.feed-shared-update-v2, article',
      thread: '.comments-comment-entity, .comments-comment-item, li.reusable-search__result-container',
    },
    {
      hosts: ['news.ycombinator.com'],
      cards: ['tr.athing', 'tr.comtr', 'table.fatitem'],
      main: 'table.fatitem',
      thread: 'tr.comtr',
    },
    {
      hosts: ['discord.com'],
      cards: ['li[id^="chat-messages"]', 'li[class*="containerDefault"]', 'li[class*="channel"]', 'div[class*="embedFull"]'],
      thread: 'li[id^="chat-messages"]',
    },
    {
      hosts: ['pinterest.'],
      cards: ['[data-test-id="pin"]', '[data-grid-item]', '[data-test-id="pinWrapper"]'],
    },
    {
      hosts: ['web.telegram.org'],
      cards: ['.message', '.bubble', '.ListItem', '.chatlist-chat'],
      thread: '.message, .bubble',
    },
    {
      hosts: ['steampowered.com', 'steamcommunity.com'],
      cards: ['.search_result_row', '.apphub_Card', '.forum_topic', '.commentthread_comment', '.tab_item', '.store_capsule'],
    },
  ];

  const onHost = (host, h) => (h.endsWith('.') ? host.startsWith(h) || host.includes('.' + h) : host === h || host.endsWith('.' + h));

  // A selector from the daily rules file is used only if the browser accepts it.
  const probe = typeof document === 'object' ? document.createDocumentFragment() : null;
  function usable(sel) {
    if (typeof sel !== 'string' || !sel.trim() || !probe) return false;
    try {
      probe.querySelector(sel);
      return true;
    } catch {
      return false;
    }
  }

  // extra: per-site fixes from the daily rules file, { host: { cards, signals,
  // keep, by, comments, blocks, plain, live, leave, whole, main, thread, rows: [{ in, only, open }], off: [paths], noHide } }. Cards and signals are
  // added to what is built in; the rest replace it. It is data only: selectors and nothing else.
  function adapterFor(hostname, extra) {
    const host = String(hostname || '').toLowerCase();
    let found = null;
    for (const site of SITES) {
      if (site.hosts.some((h) => onHost(host, h))) {
        found = site;
        break;
      }
    }
    const cards = found ? [...found.cards] : [];
    const signals = found?.signals ? [...found.signals] : [];
    const out = { by: found?.by || null, comments: found?.comments || null, keep: found?.keep || null, byAttr: found?.byAttr || null,
      blocks: found?.blocks || null, plain: found?.plain || null, live: found?.live || null, tag: found?.tag || null,
      leave: found?.leave || null, whole: found?.whole || null, main: found?.main || null, thread: found?.thread || null,
      rows: found?.rows || null, elsewhere: found?.elsewhere || null, off: found?.off || null,
      noHide: found?.noHide === true };
    let fixed = false;
    let sawNoHide = false;
    const lists = { cards, signals };
    const { SITE_LIST_KEYS, SITE_SEL_KEYS } = globalThis.GSB;
    for (const [h, fix] of Object.entries(extra || {})) {
      if (!fix || typeof fix !== 'object' || !onHost(host, String(h).toLowerCase())) continue;
      fixed = true;
      for (const key of SITE_LIST_KEYS) {
        for (const sel of Array.isArray(fix[key]) ? fix[key] : []) if (usable(sel)) lists[key].push(sel);
      }
      for (const key of SITE_SEL_KEYS) if (usable(fix[key])) out[key] = fix[key];
      if (Array.isArray(fix.rows)) {
        const rows = fix.rows.filter((r) => r && usable(r.in) && (r.only == null || usable(r.only))).map((r) => ({ in: r.in, only: r.only || null, open: r.open === true }));
        if (rows.length) out.rows = rows;
      }
      if (Array.isArray(fix.off)) {
        const off = fix.off.filter((p) => typeof p === 'string' && p.startsWith('/'));
        if (off.length) out.off = off;
      }
      if (typeof fix.noHide === 'boolean') {
        out.noHide = fix.noHide;
        sawNoHide = true;
      }
    }
    const hasFix = fixed && (cards.length || signals.length || out.rows?.length || out.off?.length || sawNoHide || SITE_SEL_KEYS.some((k) => out[k]));
    if (!found && !hasFix) return null;
    return { cards: cards.length ? cards.join(',') : ':not(*)', signals: signals.length ? signals.join(',') : null, ...out };
  }

  globalThis.GSB.adapterFor = adapterFor;
})();
