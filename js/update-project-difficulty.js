/**
 * update-project-difficulty.js  (not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * One-time backfill: sets a difficulty rating (1–5) on the component/
 * project recipes that already existed before the `difficulty` field
 * was added, so they show stars consistently with the new batch.
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the contents of this file and run:
 *          updateExistingProjectDifficulty()
 * -----------------------------------------------------------------------
 */

const DIFFICULTY_BY_TITLE = {
  "Homemade Udon Noodles": 3,
  "Homemade Awase Dashi": 1,
  "Homemade Vegetable Stock": 1,
  "Homemade Anko": 3,
  "Homemade Japanese Curry": 2,
};

async function updateExistingProjectDifficulty() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run updateExistingProjectDifficulty() again.");
    return;
  }
  const recipes = await new Parse.Query(Parse.Object.extend("Recipe")).limit(1000).find();
  for (const [title, difficulty] of Object.entries(DIFFICULTY_BY_TITLE)) {
    const match = recipes.find((r) => r.get("title") === title);
    if (!match) {
      console.warn("Not found, skipping:", title);
      continue;
    }
    console.log("Setting difficulty:", title, "->", difficulty);
    await runAdminCloud("adminUpdateRecipe", { id: match.id, difficulty });
  }
  console.log("Done.");
}
