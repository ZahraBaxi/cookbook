/**
 * seed.js  (optional — not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * Seeds sample inventory + recipes so you can see the site working with
 * real data on day one. It intentionally does NOT create every recipe
 * ingredient in inventory — a few are left missing on purpose so you can
 * see both the "READY TO MAKE" and "MISSING INGREDIENT" states.
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the contents of this file (or add a temporary
 *      <script src="js/seed.js"></script> to admin.html) and run:
 *          seedDatabase()
 *   4. Remove the <script> tag again afterwards — this file is a
 *      one-time setup tool, not part of the running site.
 * -----------------------------------------------------------------------
 */

const SEED_INVENTORY = [
  { name: "Kikkoman Ponzu", category: "Japanese", location: "Pantry", shelf: "Shelf 2", quantity: 1, unit: "bottle", level: "3/4" },
  { name: "Nuoc Mam Co Bay Do Fish Sauce", category: "Sauces", location: "Pantry", shelf: "Shelf 2", quantity: 1, unit: "bottle", level: "Half" },
  { name: "Manjo Aji-Mirin", category: "Japanese", location: "Pantry", shelf: "Shelf 2", quantity: 1, unit: "bottle", level: "Full" },
  { name: "Kikkoman Soy Sauce", category: "Japanese", location: "Pantry", shelf: "Shelf 2", quantity: 1, unit: "bottle", level: "Full" },
  { name: "Kadoya Roasted Sesame Oil", category: "Japanese", location: "Pantry", shelf: "Shelf 2", quantity: 1, unit: "bottle", level: "Half" },
  { name: "Sriracha Hot Chili Sauce", category: "Sauces", location: "Pantry", shelf: "Shelf 2", quantity: 1, unit: "bottle", level: "1/4" },
  { name: "Marukan Rice Vinegar", category: "Japanese", location: "Pantry", shelf: "Shelf 2", quantity: 1, unit: "bottle", level: "Full" },
  { name: "Hanamaruki Soybean Paste Dashi Miso", category: "Japanese", location: "Fridge", shelf: "Door", quantity: 1, unit: "tub", level: "Half" },
  { name: "Dragonfly Tapioca Flour", category: "Baking", location: "Pantry", shelf: "Shelf 4", quantity: 1, unit: "bag", level: "Full" },
  { name: "Dynasty Dried Shiitake", category: "Japanese", location: "Pantry", shelf: "Shelf 3", quantity: 1, unit: "bag", level: "Half" },
  { name: "Morinaga Sweetened Red Beans", category: "Baking", location: "Pantry", shelf: "Shelf 4", quantity: 1, unit: "can", level: "Full" },
  { name: "Magokoro Dried Shaved Skipjack Tuna", category: "Japanese", location: "Pantry", shelf: "Shelf 3", quantity: 1, unit: "bag", level: "Low" },
  { name: "Kikkoman Instant Tofu Spinach Miso Soup", category: "Japanese", location: "Pantry", shelf: "Shelf 3", quantity: 4, unit: "packets", level: "3/4" },
  { name: "Wang Korea Sushi Nori", category: "Korean", location: "Pantry", shelf: "Shelf 3", quantity: 1, unit: "pack", level: "Half" },
  { name: "Wel-Pac Dashi Kombu", category: "Japanese", location: "Pantry", shelf: "Shelf 3", quantity: 1, unit: "pack", level: "Full" },
  { name: "Firm Tofu", category: "Protein", location: "Fridge", shelf: "Middle", quantity: 1, unit: "block", level: "Low" },
  { name: "Scallions", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 0, unit: "bunch", level: "Empty" },
  { name: "Jasmine Rice", category: "Grains", location: "Pantry", shelf: "Shelf 1", quantity: 1, unit: "bag", level: "3/4" },
];

const SEED_RECIPES = [
  {
    title: "Shiitake Miso Soup",
    description: "A quick, savory miso soup built on dashi and dried shiitake.",
    category: "Japanese",
    tags: ["quick", "vegetarian"],
    servings: 2,
    prepTime: 10,
    cookTime: 15,
    instructions: "Rehydrate shiitake in warm water. Simmer kombu dashi, whisk in miso off heat, add tofu, mushrooms, and scallions.",
    notes: "Don't boil after adding miso — it dulls the flavor.",
    ingredients: [
      { name: "dried shiitake", quantity: "4", unit: "pieces", optional: false },
      { name: "soybean paste dashi miso", quantity: "2", unit: "tbsp", optional: false },
      { name: "dashi kombu", quantity: "1", unit: "piece", optional: false },
      { name: "tofu", quantity: "1", unit: "block", optional: false },
      { name: "scallions", quantity: "2", unit: "stalks", optional: true },
    ],
  },
  {
    title: "Ponzu Tofu",
    description: "Cold silken tofu with ponzu, sesame oil, and shaved bonito.",
    category: "Japanese",
    tags: ["quick", "seasonal"],
    servings: 2,
    prepTime: 8,
    cookTime: 0,
    instructions: "Slice tofu, plate, top with ponzu, a drizzle of sesame oil, scallions, and shaved skipjack.",
    notes: "",
    ingredients: [
      { name: "tofu", quantity: "1", unit: "block", optional: false },
      { name: "ponzu", quantity: "2", unit: "tbsp", optional: false },
      { name: "roasted sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "dried shaved skipjack tuna", quantity: "1", unit: "pinch", optional: true },
      { name: "scallions", quantity: "1", unit: "stalk", optional: true },
    ],
  },
  {
    title: "Japanese Mushroom Rice",
    description: "Rice cooked with shiitake, mirin, and soy for a savory one-pot side.",
    category: "Japanese",
    tags: ["dinner"],
    servings: 4,
    prepTime: 10,
    cookTime: 30,
    instructions: "Rinse rice. Combine with rehydrated shiitake, soy sauce, mirin, and dashi in the rice cooker. Cook and rest 10 minutes before fluffing.",
    notes: "",
    ingredients: [
      { name: "jasmine rice", quantity: "2", unit: "cups", optional: false },
      { name: "dried shiitake", quantity: "3", unit: "pieces", optional: false },
      { name: "soy sauce", quantity: "2", unit: "tbsp", optional: false },
      { name: "aji-mirin", quantity: "1", unit: "tbsp", optional: false },
    ],
  },
  {
    title: "Simple Dashi Noodles",
    description: "A weeknight noodle soup built on kombu-shiitake dashi.",
    category: "Japanese",
    tags: ["quick", "dinner"],
    servings: 2,
    prepTime: 5,
    cookTime: 15,
    instructions: "Steep kombu and shiitake for dashi, season with soy and mirin, cook noodles separately, combine and top with scallions.",
    notes: "",
    ingredients: [
      { name: "dashi kombu", quantity: "1", unit: "piece", optional: false },
      { name: "dried shiitake", quantity: "2", unit: "pieces", optional: false },
      { name: "soy sauce", quantity: "1", unit: "tbsp", optional: false },
      { name: "noodles", quantity: "2", unit: "bundles", optional: false },
      { name: "scallions", quantity: "2", unit: "stalks", optional: true },
    ],
  },
  {
    title: "Anko Matcha Toast",
    description: "Thick toast with sweet red bean paste, a weekend breakfast.",
    category: "Baking",
    tags: ["breakfast", "dessert"],
    servings: 1,
    prepTime: 5,
    cookTime: 5,
    instructions: "Toast bread, spread with sweetened red beans, dust with matcha.",
    notes: "",
    ingredients: [
      { name: "sweetened red beans", quantity: "3", unit: "tbsp", optional: false },
      { name: "thick-cut bread", quantity: "1", unit: "slice", optional: false },
      { name: "matcha powder", quantity: "1", unit: "pinch", optional: true },
    ],
  },
  {
    title: "Sesame Cucumber Salad",
    description: "A cold, crunchy side dressed in rice vinegar and sesame oil.",
    category: "Japanese",
    tags: ["quick", "vegetarian", "seasonal"],
    servings: 2,
    prepTime: 10,
    cookTime: 0,
    instructions: "Smash and salt cucumbers, drain, toss with rice vinegar, sesame oil, and a little soy sauce.",
    notes: "",
    ingredients: [
      { name: "cucumbers", quantity: "2", unit: "whole", optional: false },
      { name: "rice vinegar", quantity: "1", unit: "tbsp", optional: false },
      { name: "roasted sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "soy sauce", quantity: "1", unit: "tsp", optional: true },
    ],
  },
];

async function seedDatabase() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run seedDatabase() again.");
    return;
  }
  console.log("Seeding inventory…");
  for (const item of SEED_INVENTORY) {
    await runAdminCloud("adminCreateInventoryItem", item);
  }
  console.log("Seeding recipes…");
  for (const recipe of SEED_RECIPES) {
    await runAdminCloud("adminCreateRecipe", recipe);
  }
  console.log("Done. Reload the Cookbook and Inventory pages to see the sample data.");
}
