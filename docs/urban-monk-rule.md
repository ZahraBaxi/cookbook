> Note: this notebook is now part of Common Place as the Today, Practice and
> Growth pages (today.html, practice.html, growth.html), using the site's
> Admin sign-in. The Plants and Wishlist chapters were removed. Its login
> and sign-up sections below no longer apply. Scripts are in `js/monk/`
> and styles in `css/monk.css`.

# Urban Monk Rule

A single-page, black-and-white "digital field notebook", vanilla HTML/CSS/JS,
Space Grotesk only, no frameworks. It uses the **same Back4App app/keys as the
wardrobe project**, data is kept separate by project through its own set of
Parse class names, not through a separate app.

The site now sits behind a login screen. Anyone can sign up with a username
and password (Back4App's built-in Parse User system, no extra setup), and
everything they save (checklists, journal entries, the Learning notebook,
all of it) is scoped to that account. A fresh signup always starts
completely empty, so if you ever want to start over, sign up with a new
username rather than digging through old data.

## Setup

1. `js/back4app-client.js` already has the same `B4A_ID` / `B4A_KEY` as the
   wardrobe project's `js/back4app-client.js`, nothing to fill in.
2. In the Back4App dashboard, confirm the built-in `User` class has **Sign
   Up** enabled (it's on by default for a new app). No other setup is needed
   for accounts, login/signup/session-token handling is all done through
   Parse's standard REST endpoints.
3. Open `index.html` in a browser (or serve the folder statically), sign up
   for an account, and use the app for a bit. This creates twelve classes in
   that Back4App app automatically the first time each is written to:
   `MonkDay`, `MonkPlaceNote`, `MonkJournalEntry`, `MonkActivity`,
   `MonkPlant`, `MonkSourdoughFeeding`, `MonkWatchlistItem`, `MonkBook`,
   `MonkBookNote`, `MonkWishlistItem`, `MonkDharmaEntry`,
   `MonkLearningNode`. These don't overlap with the wardrobe's
   `Garment`/`Repair`/`Outfit`/etc classes already in that app.
4. In the Back4App dashboard, open each of those twelve classes → **Security**,
   and turn on public **Find / Get / Create / Update / Delete**, same step you
   did for the wardrobe project's classes. Every row also carries an `owner`
   field (the logged-in username) and every read filters on it, so even
   though the class-level permission is public, one account's data doesn't
   show up for another account in the app itself. This isn't hardened,
   bank-vault security (someone with the API keys and an objectId could
   still reach in directly), it's just enough separation for a personal
   tool a few people might share.
5. Photos added in the Learning notebook upload through Parse's file
   storage (`/parse/files`), no separate setup needed there either, it uses
   the same Application ID / Client Key as everything else.
6. The Wishlist chapter's daily savings rate is stored in your browser's
   localStorage, not Back4App, it's a pacing number, not real money tracking,
   so nothing to set up for it.
7. The Dharma chapter's sit timer and mala counter chime softly using the
   browser's built-in Web Audio API, no audio files, nothing to configure,
   and it only ever plays right after a click, so there's no autoplay issue.

## Structure

```
index.html, the shell + the login screen + all 22 chapters (shown/hidden via JS)
css/style.css, the whole black & white design system
js/back4app-client.js, generic Back4App REST client, auth, and file upload (fetchClass/createInClass/b4aLogIn/b4aUploadFile/etc.)
js/monk-data.js, all static content: quotes, prompts, checklists, craft db, recipes
js/monk-app.js, navigation + all interactions + Back4App wiring
```

The sidebar is grouped into five short clusters (Daily, Awareness, Growing,
Living, Record) instead of one long list of 22 chapters, and it now scrolls
on its own (`position: sticky`) rather than stretching the whole page.

## Chapters

Home, Rhythm, **Movement**, **Dharma**, Place, Presence, Solitude, Humility,
Learning, **Reading**, Craft, **Plants**, **Sourdough**, **Tea**,
**Watchlist**, **Wishlist**, Stewardship, Attention, Joy, Journal, Random
Practice, Progress.

- **Learning**, rebuilt as a nested notebook, folders inside folders, the
  way you'd organize notes in Obsidian:
  - **+ Folder** creates a folder inside whatever folder you're currently
    in (or at the top level, from "All").
  - **+ Content** adds a **Sticky Note** (title + free text, start a line
    with `-` for a bullet), a **Photo** (uploaded through Parse's file
    storage, shown in black and white by default with a "Show in color"
    toggle per photo), or a **Sketch**.
  - Sketches open in a full canvas with a **Pen** and **Eraser** tool, a
    thickness slider, and **Undo** (button or Ctrl+Z). Every stroke saves
    automatically as you draw, nothing is lost if you close the tab.
  - A small breadcrumb (`All / Cooking / Fermentation`) shows where you are,
    and a simple web diagram above the folder grid draws lines from the
    current folder out to its direct contents, click either the diagram or
    the card grid to open something.
  - Deleting a folder deletes everything nested inside it.
  - One Back4App class, `MonkLearningNode`, covers folders and all three
    content types, they're told apart by a `type` field.
- **Movement**, five fixed, ordered exercise routines (a Sun Salutation
  flow, a quick wake-up stretch, bodyweight strength basics, a standing
  mobility flow, and a core & balance set). Deliberately not randomized, click one to see its equipment and its steps in a fixed order, the same
  way every time. "Mark Today's Routine Complete" is repeatable (it's meant
  to be done again and again), unlike Sourdough/Tea's one-time "tried."
  Routines can be removed if one doesn't suit you. No new Back4App class, completions and removals are both logged as `MonkActivity` rows, same
  mechanism as Craft.
- **Tea**, fifteen bulk-bin-style tea blend recipes (ratios of loose-leaf
  tea and dried herbs, plus steeping instructions), using the exact same
  popup and "mark tried / remove" mechanism as Sourdough's recipes.

- **Dharma**, a home for Buddhist practice, framed as practice rather than
  performance:
  - **Refuge**, a one-tap acknowledgment of the Three Jewels (Buddha,
    Dharma, Sangha), repeatable any time it feels right.
  - **Sit**, a real meditation timer. Pick a practice (Breath Awareness,
    Loving-Kindness, Body Scan, Open Awareness) and a length (5-30 min),
    then begin. A slow, unforced breathing circle gives your eyes somewhere
    soft to rest (optional, there's a toggle to turn it off), and a
    Web-Audio bell chimes at the start and end of every sit, whether it runs
    to completion or you end it early.
  - **Loving-Kindness**, walks through the traditional metta sequence
    (yourself → someone you love → someone neutral → someone difficult → all
    beings), one phrase at a time.
  - **Mala**, a 108-count tap counter for mantra or breath repetitions,
    with a chime and a logged round when it completes.
  - **A Verse for the Moment**, short original gathas (mindfulness verses)
    tied to ordinary actions like washing your hands or closing a door.
  - **Today's Precepts**, the five precepts, phrased as intentions to hold
    in mind rather than a scorecard.
  - **Contemplation**, a reflection journal with prompts drawn from
    impermanence, non-attachment, and present-moment awareness, separate
    from the general Journal chapter.
  
  Sits, mala rounds, and refuge taps all count toward Progress and the daily
  streak, same as everything else in the app.
- **Reading**, a shelf of books, each an expandable card. Click a book to
  open it, cycle its status (Want to Read → Reading → Finished) with the
  status pill, and leave annotations: a quote, an optional page number, and
  a note on what it means to you. Annotations and books can each be removed
  individually.
- **Plants**, track anything you're growing through Seed → Seedling → Sprout
  → Fruiting → Harvestable, with an "Advance Stage" button per plant.
- **Sourdough**, a starter feeding log ("last fed X days ago"), plus two
  recipe lists (discard recipes, recipes to try). Clicking a recipe opens a
  popup with its full ingredient list and method, where you can mark it
  tried or remove it from the list permanently.
- **Watchlist**, documentaries/videos to watch instead of doomscrolling, with
  a "What Should I Watch Tonight?" button that picks something you haven't
  watched yet.
- **Wishlist**, things to mull over rather than buy on impulse. Set a daily
  amount you're setting aside; each item shows a derived waiting period
  (price ÷ daily rate) and how far along you are, alongside a short checklist
  (fulfills a purpose / matches your aesthetic / not plastic) to actually look
  at before buying. "Bought It" and "Remove" both take it off the list.