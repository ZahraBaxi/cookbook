# THE KITCHEN — Cookbook + Kitchen Inventory

A personal, black-and-white, single-user cookbook and kitchen inventory site.
Static HTML/CSS/vanilla JS, backed by Back4App (Parse).

## Files

```
/
├── index.html              Landing page → links to Cookbook / Inventory
├── cookbook.html            Recipe browsing, search, filters, detail modal
├── inventory.html           Inventory catalog, summary strip, shelf views
├── admin.html                Login + dashboard (inventory & recipe CRUD)
├── css/
│   └── styles.css            The entire design system (CSS variables at top)
├── js/
│   ├── config.js              Back4App keys, site copy, controlled vocab — edit here
│   ├── parse.js                Parse SDK init + admin session helpers
│   ├── utils.js                 Ingredient matching, formatting, toasts, modals
│   ├── cookbook.js              Cookbook page logic
│   ├── inventory.js             Inventory page logic
│   ├── admin.js                  Admin login + CRUD logic
│   └── seed.js                   Optional: sample data, run once from the console
├── cloud-code-additions.js  Back4App Cloud Code to paste in (NOT part of the static site)
└── README.md
```

## How the Back4App connection works

`js/config.js` holds the Back4App **App ID** and **JavaScript Key**. These are
the public client keys — they're meant to ship in frontend code, the same way
they'd appear in any Parse-backed app. `js/parse.js` calls `Parse.initialize()`
with them once, and every page loads `parse.js` after the Parse SDK `<script>`
tag. If you ever need to point this at a different Back4App app, `config.js`
is the only file to touch.

## How admin authentication works

1. `admin.html` shows a login form first — never the dashboard.
2. On submit, the frontend calls the existing Cloud Function:
   `Parse.Cloud.run("adminLogin", { username, password })`.
   The frontend never contains the password itself — only the Cloud Function
   (server-side) knows `zeebug` / `oatmeal`.
3. On success, the returned `token` is stored in `sessionStorage` (not
   `localStorage`, so it clears when the tab closes) and the dashboard shows.
4. Every admin write (`js/admin.js`) sends that token along as `adminToken`
   on the Cloud Function call — see `runAdminCloud()` in `js/parse.js`.

### Important security note — read this before using it for real

The **original** `adminLogin` function only checks a username/password and
returns a string token. It does **not**, by itself, make it safe to let the
browser write directly to your `InventoryItem`/`Recipe` classes — a token
like `"closet-admin-1234"` can't be verified by anything, so a client-side
check alone is not real security.

`cloud-code-additions.js` fixes this properly:

- `adminLogin` now also saves an `AdminSession` record (token + 12-hour
  expiry) using the Master Key, so the token becomes something the server
  can actually check.
- New Cloud Functions (`adminCreateInventoryItem`, `adminUpdateInventoryItem`,
  `adminDeleteInventoryItem`, `adminCreateRecipe`, `adminUpdateRecipe`,
  `adminDeleteRecipe`) each call a `requireAdmin()` helper first, which looks
  up the session by token and rejects the request if it's missing or expired.
- All admin CRUD in the frontend goes through these functions rather than
  writing to Parse directly, so the Master Key never leaves the server.

**You still need to do one thing in the Back4App dashboard**: set
`InventoryItem` and `Recipe`'s Class-Level Permissions to **Public Read**,
with **no public write/update/delete**. That closes the last gap — right now,
anyone with your App ID/JS Key could otherwise write to those classes
directly through the client SDK, bypassing the site entirely. Cookbook and
Inventory only ever read, so read access can safely stay public.

Do not deploy this as "secure" without applying `cloud-code-additions.js`
and locking down those permissions — as shipped, the original `adminLogin`
alone does not protect the database.

## Parse classes to create in Back4App

**InventoryItem**
```
name            String
category        String
location        String
shelf           String
quantity        Number
unit            String
level           String
notes           String
expirationDate  Date
```

**Recipe**
```
title           String
description     String
category        String
recipeType      String   ("Meal", "Component", "From Scratch", "Preserve", "Baking", or "Project")
difficulty      Number   (1–5, optional)
servings        Number
prepTime        Number
cookTime        Number
instructions    String
notes           String
tags            Array
ingredients     Array   (see structure below)
requiresRecipes Array   (titles of other Recipe records this one depends on — see below)
```

`ingredients` is an array of objects:
```json
[{ "name": "soy sauce", "quantity": "2", "unit": "tbsp", "optional": false }]
```

`requiresRecipes` is an array of recipe title strings — e.g. Kake Udon's
`requiresRecipes` is `["Homemade Udon Noodles", "Homemade Awase Dashi"]`.
The Cookbook resolves these by matching titles (same normalization as
ingredient matching) and recursively checks each required recipe's own
readiness — so "Kake Udon" can correctly report "missing potato starch"
even though potato starch never appears in Kake Udon's own ingredient
list, only in Homemade Udon Noodles'.

**AdminSession** (created automatically the first time `adminLogin` runs,
once `cloud-code-additions.js` is deployed)
```
token       String
username    String
expiresAt   Date
```

Back4App auto-creates classes and columns the first time data is saved with
the Master Key, so once `cloud-code-additions.js` is deployed and you save
your first item through the Admin page, the schema appears on its own — no
manual column setup required. If you'd rather set columns up ahead of time,
use the field lists above.

## Recipe types and dependencies

The Cookbook's second filter row (ALL · MEAL · COMPONENT · FROM SCRATCH ·
PRESERVE · BAKING · PROJECT) filters on `recipeType`, independent of the
category/tag filter above it. Use "Component" for foundational things like
dashi or stock, "Project" for multi-hour undertakings like homemade udon,
and "Meal" for anything you'd actually plate and eat. Filtering by
Component or Project is effectively your "Kitchen Projects" list.

In the Admin recipe form, "Requires (comma-separated recipe titles)" links
a recipe to the other recipes it depends on. Type the other recipe's exact
title (matching is forgiving about case/whitespace, same as ingredient
matching). The recipe detail view shows a "Requires" section listing each
dependency's own READY/NOT READY status, and the overall status tag folds
in whatever's missing from the whole dependency tree — not just this
recipe's own ingredient list.

Recipes also have an optional 1–5 "Difficulty" rating, shown as stars
(★★★☆☆) on cards and in the detail view. And every recipe detail view has
a "Used By" section — the reverse of Requires — automatically listing
every other recipe that depends on it. No extra data entry needed: it's
computed by scanning all recipes' `requiresRecipes` for this one's title.
So Homemade Udon Noodles' detail view will show "Used By: Classic Kake
Udon, Yaki Udon, Tanuki Udon, Cold Zaru Udon, Nabe" automatically as you
add recipes that require it. The Indian batch follows the same pattern —
Homemade Paneer's detail view will show "Used By: Palak Paneer, Matar
Paneer, Paneer Tikka, Shahi Paneer" once all four are added.

## How recipe-to-inventory matching works

`js/utils.js` → `ingredientMatchesInventoryItem()`. It strips filler words
("fresh", "chopped", "to taste", etc.), tokenizes both the recipe ingredient
name and the inventory item name, and checks whether most of the ingredient's
words appear in the inventory name (matching substrings too, so "shiitake"
matches inside "Dynasty Dried Shiitake"). No external API, nothing exotic —
just enough normalization to handle real pantry names.

## Deploying to GitHub Pages

1. Create a new GitHub repo and push everything in this folder to it
   (keep the file structure as-is — `index.html` at the repo root).
2. In the repo's **Settings → Pages**, set the source to the `main` branch,
   root folder.
3. Wait a minute for GitHub to build it, then visit the URL GitHub gives you.
4. In the Back4App dashboard, add that GitHub Pages URL (and
   `http://localhost:...` if you test locally) to your app's **Security →
   Allowed Origins / CORS** settings if your app restricts them.

No build step, no dependencies to install — it's plain HTML/CSS/JS plus the
Parse SDK loaded from a CDN.

## Adding your first inventory items and recipes

1. Deploy `cloud-code-additions.js` in the Back4App dashboard (Cloud Code
   section), and set the two Class-Level Permissions described above.
2. Visit `admin.html` on your deployed site and sign in as `zeebug`.
3. Use **+ ADD ITEM** / **+ ADD RECIPE** to create real entries, or run the
   optional seed script:
   - Log into `admin.html`.
   - Open devtools console on that page.
   - Paste the contents of `js/seed.js`, then run `seedDatabase()`.
   - This adds ~18 sample inventory items and 6 sample recipes based on a
     real pantry, deliberately leaving a couple of ingredients (like fresh
     scallions) missing so you can see both the "READY TO MAKE" and
     "MISSING INGREDIENT" states.
4. Reload `cookbook.html` / `inventory.html` to see the data.

## Notes

- Everything is mobile-first where it matters most: the Inventory page for
  standing in the kitchen, and the recipe detail view for cooking from a
  phone propped on the counter.
- Low-stock items are marked with typography and a border weight, not color,
  per the black-and-white brief.
- Empty states, search-with-no-results, and error states all use inline
  messaging — no `alert()` calls anywhere.
