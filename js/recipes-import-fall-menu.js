/**
 * recipes-import-fall-menu.js  (not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * Adds the "core September cookbook" — 10 recipes built around the
 * Japanese pantry, via the same secured adminCreateRecipe Cloud
 * Function the Admin UI uses.
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the contents of this file and run:
 *          addFallMenuRecipes()
 *   4. Reload cookbook.html to see them, and check each one's
 *      ingredient status against your current inventory.
 * -----------------------------------------------------------------------
 */

const FALL_MENU_RECIPES = [
  {
    title: "Shiitake Miso Soup with Tofu",
    description: "A light, everyday miso soup built on shiitake-kombu dashi.",
    category: "Japanese",
    tags: ["breakfast", "lunch"],
    servings: 2,
    prepTime: 5,
    cookTime: 10,
    instructions:
      "1. Soak shiitake in the water for 15–20 minutes.\n2. Remove mushrooms and slice.\n3. Add kombu and mushrooms to the soaking liquid. Warm gently, then remove kombu before boiling.\n4. Reduce heat.\n5. Dissolve miso into a little hot broth, then return it to the pot.\n6. Add tofu and warm gently.\n7. Finish with sesame oil, nori, and scallions.",
    notes: "Everyday breakfast/light meal.",
    ingredients: [
      { name: "water", quantity: "3", unit: "cups", optional: false },
      { name: "kombu", quantity: "1", unit: "piece", optional: false },
      { name: "dried shiitake mushrooms", quantity: "3", unit: "pieces", optional: false },
      { name: "dashi miso", quantity: "2", unit: "tbsp", optional: false },
      { name: "tofu", quantity: "1/2", unit: "block", optional: false },
      { name: "nori", quantity: "1", unit: "sheet", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "scallion, sliced", quantity: "1", unit: "", optional: false },
    ],
  },
  {
    title: "Ponzu Sesame Tofu Bowl",
    description: "Pan-fried tofu over rice with ponzu, sesame, and fresh vegetables.",
    category: "Japanese",
    tags: ["lunch", "quick"],
    servings: 1,
    prepTime: 5,
    cookTime: 10,
    instructions:
      "1. Pat tofu dry and cube.\n2. Pan-fry until golden.\n3. Add ponzu and sesame oil.\n4. Serve over rice.\n5. Top with sesame seeds, torn nori, scallion, and cucumber.",
    notes: "Fast lunch.",
    ingredients: [
      { name: "tofu", quantity: "1/2", unit: "block", optional: false },
      { name: "cooked Japanese rice", quantity: "1", unit: "cup", optional: false },
      { name: "ponzu", quantity: "1", unit: "tbsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "sesame seeds", quantity: "1", unit: "tsp", optional: false },
      { name: "nori", quantity: "1", unit: "sheet", optional: false },
      { name: "scallion", quantity: "1", unit: "", optional: false },
      { name: "cucumber or other fresh vegetable", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Japanese Mushroom Rice",
    description: "Shiitake-and-kombu rice cooked with soy, mirin, carrot, and peas.",
    category: "Japanese",
    tags: ["dinner", "comfort food"],
    servings: 4,
    prepTime: 15,
    cookTime: 30,
    instructions:
      "1. Soak shiitake and reserve the soaking liquid.\n2. Slice mushrooms.\n3. Rinse rice.\n4. Add rice, mushroom liquid, soy sauce, mirin, mushrooms, kombu, carrot, and peas.\n5. Cook in your Instant Pot or rice cooker.\n6. Remove kombu.\n7. Fluff and serve.",
    notes: "Batch cooking — a strong candidate for a staple recipe. Serves 3–4.",
    ingredients: [
      { name: "Japanese short-grain rice", quantity: "2", unit: "cups", optional: false },
      { name: "dried shiitake mushrooms", quantity: "4", unit: "pieces", optional: false },
      { name: "kombu", quantity: "1", unit: "piece", optional: false },
      { name: "soy sauce", quantity: "2", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "1", unit: "tbsp", optional: false },
      { name: "rice vinegar", quantity: "1", unit: "tsp", optional: false },
      { name: "water", quantity: "2", unit: "cups", optional: false },
      { name: "carrot", quantity: "1", unit: "", optional: false },
      { name: "edamame or peas", quantity: "1/2", unit: "cup", optional: true },
    ],
  },
  {
    title: "Sesame Soba with Cucumber",
    description: "Cold soba tossed in a soy-vinegar-sesame dressing with cucumber.",
    category: "Japanese",
    tags: ["lunch", "summer"],
    servings: 2,
    prepTime: 10,
    cookTime: 5,
    instructions:
      "1. Cook soba according to package directions.\n2. Rinse thoroughly under cold water.\n3. Slice cucumber thinly.\n4. Mix soy sauce, vinegar, sesame oil, and ponzu.\n5. Toss noodles and cucumber with dressing.\n6. Top with sesame, nori, and scallion.",
    notes: "Summer lunch. Requires soba and fresh produce.",
    ingredients: [
      { name: "soba", quantity: "6", unit: "oz", optional: false },
      { name: "cucumber", quantity: "1", unit: "", optional: false },
      { name: "soy sauce", quantity: "1", unit: "tbsp", optional: false },
      { name: "rice vinegar", quantity: "1", unit: "tbsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "ponzu", quantity: "1", unit: "tsp", optional: false },
      { name: "sesame seeds", quantity: "1", unit: "tsp", optional: false },
      { name: "nori", quantity: "", unit: "", optional: false },
      { name: "scallion", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Dashi Mushroom Udon",
    description: "Udon in a shiitake-kombu dashi broth with tofu.",
    category: "Japanese",
    tags: ["dinner", "cozy"],
    servings: 2,
    prepTime: 5,
    cookTime: 15,
    instructions:
      "1. Prepare dashi with kombu and shiitake.\n2. Remove kombu and slice mushrooms.\n3. Add soy sauce and mirin.\n4. Add tofu and udon.\n5. Simmer until hot.\n6. Finish with a tiny splash of rice vinegar.\n7. Garnish with scallion and nori.",
    notes: "Cozy dinner — mostly HAVE once you buy udon.",
    ingredients: [
      { name: "udon", quantity: "2", unit: "portions", optional: false },
      { name: "dashi", quantity: "3", unit: "cups", optional: false },
      { name: "dried shiitake mushrooms", quantity: "3", unit: "pieces", optional: false },
      { name: "soy sauce", quantity: "2", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "1", unit: "tbsp", optional: false },
      { name: "rice vinegar", quantity: "1", unit: "tsp", optional: false },
      { name: "tofu", quantity: "1/2", unit: "block", optional: false },
      { name: "scallion", quantity: "", unit: "", optional: false },
      { name: "nori", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Spicy Sesame Tofu & Cabbage",
    description: "A fast stir-fry of pan-fried tofu and cabbage in a spicy sesame sauce.",
    category: "Japanese-inspired",
    tags: ["dinner", "quick"],
    servings: 2,
    prepTime: 10,
    cookTime: 10,
    instructions:
      "1. Cube and pan-fry tofu.\n2. Add cabbage and carrot.\n3. Stir-fry until slightly softened.\n4. Mix soy sauce, vinegar, sesame oil, and sriracha.\n5. Pour over vegetables and tofu.\n6. Toss and serve over rice.\n7. Sprinkle with sesame seeds.",
    notes: "Fast weeknight dinner — good for using up vegetables getting old in the fridge.",
    ingredients: [
      { name: "tofu", quantity: "1", unit: "block", optional: false },
      { name: "shredded cabbage", quantity: "2", unit: "cups", optional: false },
      { name: "carrot", quantity: "1", unit: "", optional: false },
      { name: "soy sauce", quantity: "1", unit: "tbsp", optional: false },
      { name: "rice vinegar", quantity: "1", unit: "tbsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "sriracha", quantity: "1-2", unit: "tsp", optional: false },
      { name: "sesame seeds", quantity: "1", unit: "tsp", optional: false },
      { name: "rice", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Miso Roasted Autumn Vegetables",
    description: "Sweet potato, squash, carrot, and onion roasted in a miso-mirin glaze.",
    category: "Japanese",
    tags: ["seasonal", "dinner"],
    servings: 3,
    prepTime: 10,
    cookTime: 25,
    instructions:
      "1. Heat oven to 425°F.\n2. Cut vegetables into bite-sized pieces.\n3. Mix miso, mirin, sesame oil, and vinegar.\n4. Toss vegetables with the glaze.\n5. Roast 25–30 minutes, turning once.\n6. Finish with sesame seeds.",
    notes: "Seasonal — especially good for late September into October.",
    ingredients: [
      { name: "sweet potato", quantity: "1", unit: "", optional: false },
      { name: "kabocha squash or other winter squash", quantity: "1/2", unit: "", optional: true },
      { name: "carrots", quantity: "2", unit: "", optional: false },
      { name: "onion", quantity: "1", unit: "", optional: false },
      { name: "miso", quantity: "1", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "1", unit: "tbsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "rice vinegar", quantity: "1", unit: "tsp", optional: false },
      { name: "sesame seeds", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Mung Bean & Vegetable Rice Bowl",
    description: "A meal-prep bowl of mung beans and stir-fried vegetables over rice.",
    category: "Japanese-inspired",
    tags: ["vegetarian", "meal prep"],
    servings: 3,
    prepTime: 15,
    cookTime: 15,
    instructions:
      "1. Cook mung beans until tender.\n2. Stir-fry vegetables.\n3. Add mung beans.\n4. Season with soy sauce, vinegar, sesame oil, and ponzu.\n5. Serve over rice.\n6. Top with nori and sesame.",
    notes: "Bulk-bin meal prep — uses your bulk-bin ingredients particularly well.",
    ingredients: [
      { name: "cooked mung beans", quantity: "1", unit: "cup", optional: false },
      { name: "cooked rice", quantity: "2", unit: "cups", optional: false },
      { name: "carrot", quantity: "1", unit: "", optional: false },
      { name: "cabbage", quantity: "1/2", unit: "", optional: false },
      { name: "mushroom", quantity: "1", unit: "", optional: false },
      { name: "soy sauce", quantity: "1", unit: "tbsp", optional: false },
      { name: "rice vinegar", quantity: "1", unit: "tbsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "ponzu", quantity: "1", unit: "tsp", optional: false },
      { name: "nori", quantity: "", unit: "", optional: false },
      { name: "sesame seeds", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Anko Hojicha Toast",
    description: "Toast with sweetened red bean paste, served with hojicha.",
    category: "Japanese",
    tags: ["breakfast", "dessert"],
    servings: 1,
    prepTime: 5,
    cookTime: 0,
    instructions:
      "1. Toast bread.\n2. Spread with butter if desired.\n3. Add a generous layer of anko.\n4. Dust lightly with matcha or add sesame seeds.\n5. Serve with hot hojicha.",
    notes: "Japanese breakfast/treat — your slow Sunday breakfast.",
    ingredients: [
      { name: "good bread", quantity: "1", unit: "slice", optional: false },
      { name: "sweetened red bean paste", quantity: "2-3", unit: "tbsp", optional: false },
      { name: "hojicha", quantity: "", unit: "", optional: false },
      { name: "butter", quantity: "", unit: "", optional: true },
      { name: "sesame seeds", quantity: "", unit: "", optional: true },
      { name: "matcha", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Homemade Vegetable Dashi Rice Porridge",
    description: "A gentle shiitake-dashi rice porridge with tofu, finished soft or with an egg.",
    category: "Japanese",
    tags: ["breakfast", "comfort food"],
    servings: 2,
    prepTime: 5,
    cookTime: 20,
    instructions:
      "1. Prepare dashi with kombu and shiitake.\n2. Remove kombu and slice mushrooms.\n3. Add cooked rice.\n4. Simmer 15–20 minutes until creamy.\n5. Add tofu.\n6. Season with soy sauce and mirin.\n7. Top with scallion, nori, and sesame.\n8. Add a soft egg if desired.",
    notes: "Cozy breakfast — particularly good for cold mornings or when you want something gentle.",
    ingredients: [
      { name: "cooked rice", quantity: "1", unit: "cup", optional: false },
      { name: "dashi", quantity: "3", unit: "cups", optional: false },
      { name: "dried shiitake mushrooms", quantity: "2", unit: "pieces", optional: false },
      { name: "soy sauce", quantity: "1", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "1", unit: "tsp", optional: false },
      { name: "tofu", quantity: "1/2", unit: "block", optional: false },
      { name: "scallion", quantity: "", unit: "", optional: false },
      { name: "nori", quantity: "", unit: "", optional: false },
      { name: "sesame seeds", quantity: "", unit: "", optional: false },
      { name: "egg", quantity: "", unit: "", optional: true },
    ],
  },
];

async function addFallMenuRecipes() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run addFallMenuRecipes() again.");
    return;
  }
  for (const recipe of FALL_MENU_RECIPES) {
    console.log("Adding:", recipe.title);
    await runAdminCloud("adminCreateRecipe", recipe);
  }
  console.log("Done. Reload cookbook.html to see all 10 recipes.");
}
