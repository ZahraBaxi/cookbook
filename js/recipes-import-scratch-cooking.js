/**
 * recipes-import-scratch-cooking.js  (not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * Adds the 10 "from-scratch cooking curriculum" recipes: foundational
 * components (dashi, stock), a couple of projects (udon noodles, anko),
 * and the meals built on top of them via `requiresRecipes`.
 *
 * ORDER MATTERS: this script creates recipes in dependency order —
 * components first, then the recipes that require them — so that by the
 * time e.g. "Classic Kake Udon" is created, "Homemade Udon Noodles" and
 * "Homemade Awase Dashi" already exist with those exact titles for the
 * requires-matching to find.
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the contents of this file and run:
 *          addScratchCookingRecipes()
 *   4. Reload cookbook.html — try the new TYPE filter row, and open
 *      "Classic Kake Udon" to see the Requires section in action.
 * -----------------------------------------------------------------------
 */

const SCRATCH_COOKING_RECIPES = [
  {
    title: "Homemade Udon Noodles",
    description: "Hand-rolled wheat noodles — a slow, satisfying weekend project.",
    category: "Japanese",
    recipeType: "Project",
    tags: ["from scratch", "project"],
    requiresRecipes: [],
    servings: 2,
    prepTime: 30,
    cookTime: 150,
    instructions:
      "1. Dissolve the salt in the water.\n2. Gradually mix the salted water into the flour until a shaggy dough forms.\n3. Knead until smooth and elastic (or place in a bag and knead with your feet).\n4. Cover and rest 30 minutes.\n5. Knead briefly again, then rest, covered, at least 2 hours (or overnight, refrigerated).\n6. Roll the dough out on a well-starched surface to about 1/8 inch thick.\n7. Dust generously with potato starch or cornstarch, fold loosely, and slice into noodles.\n8. Shake off excess starch and cook in boiling water 8–10 minutes until tender.\n9. Rinse under cold water to remove surface starch.",
    notes: "A project recipe, not a weeknight one — budget the full resting time.",
    ingredients: [
      { name: "AP flour", quantity: "2", unit: "cups", optional: false },
      { name: "water", quantity: "3/4", unit: "cup", optional: false },
      { name: "salt", quantity: "2", unit: "tsp", optional: false },
      { name: "potato starch or cornstarch", quantity: "1/4", unit: "cup", optional: false },
    ],
  },
  {
    title: "Homemade Awase Dashi",
    description: "The foundational kombu-shiitake-bonito stock behind most of the Japanese pantry.",
    category: "Japanese",
    recipeType: "Component",
    tags: ["foundation", "from scratch"],
    requiresRecipes: [],
    servings: 4,
    prepTime: 30,
    cookTime: 15,
    instructions:
      "1. Gently wipe the kombu clean; don't wash away the white surface.\n2. Soak kombu in 4 cups cold water for at least 30 minutes, preferably several hours.\n3. Warm slowly until just before boiling.\n4. Remove kombu.\n5. Add shiitake and simmer gently for about 10 minutes.\n6. Remove shiitake.\n7. Bring broth just to a simmer and turn off heat.\n8. Add bonito flakes.\n9. Let steep about 5 minutes.\n10. Strain.",
    notes: "Store refrigerated and use within a few days, or freeze portions. One of the most important recipes in the cookbook — it feeds several others.",
    ingredients: [
      { name: "water", quantity: "4", unit: "cups", optional: false },
      { name: "kombu", quantity: "1", unit: "piece", optional: false },
      { name: "dried shiitake mushrooms", quantity: "2-3", unit: "pieces", optional: false },
      { name: "shaved bonito", quantity: "1", unit: "cup", optional: false },
    ],
  },
  {
    title: "Classic Kake Udon",
    description: "Where homemade udon and homemade dashi meet — simple, quiet, beautiful.",
    category: "Japanese",
    recipeType: "Meal",
    tags: ["noodles", "from scratch", "dinner"],
    requiresRecipes: ["Homemade Udon Noodles", "Homemade Awase Dashi"],
    servings: 2,
    prepTime: 5,
    cookTime: 15,
    instructions:
      "1. Prepare the udon.\n2. Combine dashi, soy sauce, mirin, and sugar.\n3. Bring gently to a simmer.\n4. Heat the cooked noodles separately.\n5. Place noodles in bowls.\n6. Pour hot broth over them.\n7. Top with scallion, nori, and shiitake.",
    notes: "",
    ingredients: [
      { name: "soy sauce", quantity: "2", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "1", unit: "tbsp", optional: false },
      { name: "sugar", quantity: "1", unit: "tsp", optional: false },
      { name: "scallion", quantity: "1", unit: "", optional: false },
      { name: "nori", quantity: "", unit: "", optional: false },
      { name: "dried shiitake mushrooms", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Homemade Vegetable Stock",
    description: "A scrap-friendly all-purpose stock — the second foundation, alongside dashi.",
    category: "Foundation",
    recipeType: "Component",
    tags: ["from scratch", "foundation"],
    requiresRecipes: [],
    servings: 6,
    prepTime: 10,
    cookTime: 50,
    instructions:
      "1. Roughly chop vegetables.\n2. Add everything to a large pot.\n3. Cover with cold water.\n4. Bring to a gentle simmer.\n5. Simmer 45–60 minutes.\n6. Strain.\n7. Cool quickly and refrigerate or freeze.",
    notes: "Don't feel like you need to buy special vegetables — this is a perfect way to use scraps.",
    ingredients: [
      { name: "onion", quantity: "1", unit: "", optional: false },
      { name: "carrot", quantity: "2", unit: "", optional: false },
      { name: "celery", quantity: "2", unit: "stalks", optional: false },
      { name: "garlic", quantity: "2", unit: "cloves", optional: false },
      { name: "mushroom stems", quantity: "", unit: "", optional: true },
      { name: "parsley stems or other herb stems", quantity: "", unit: "", optional: true },
      { name: "water", quantity: "8", unit: "cups", optional: false },
      { name: "bay leaf", quantity: "1", unit: "", optional: false },
      { name: "black peppercorns", quantity: "1", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Butternut Squash Soup",
    description: "A fall soup built on homemade vegetable stock, with an optional miso variation.",
    category: "Soup",
    recipeType: "Meal",
    tags: ["fall", "vegetarian"],
    requiresRecipes: ["Homemade Vegetable Stock"],
    servings: 6,
    prepTime: 15,
    cookTime: 35,
    instructions:
      "1. Sauté onion and garlic in olive oil until soft.\n2. Add cubed butternut squash.\n3. Add vegetable stock and bring to a simmer.\n4. Cook until squash is very tender, about 25 minutes.\n5. Blend until smooth.\n6. Stir in half-and-half and season with salt and pepper.",
    notes: "Miso variation: stir 1–2 tablespoons white or yellow miso into the finished soup for a Japanese-inspired version — excellent with this pantry.",
    ingredients: [
      { name: "butternut squash", quantity: "1", unit: "medium", optional: false },
      { name: "onion", quantity: "1", unit: "", optional: false },
      { name: "garlic", quantity: "3", unit: "cloves", optional: false },
      { name: "olive oil", quantity: "2", unit: "tbsp", optional: false },
      { name: "half-and-half", quantity: "1", unit: "cup", optional: false },
      { name: "salt", quantity: "", unit: "", optional: false },
      { name: "black pepper", quantity: "", unit: "", optional: false },
      { name: "white or yellow miso", quantity: "1-2", unit: "tbsp", optional: true },
    ],
  },
  {
    title: "Miso Mushroom Soup",
    description: "A real from-scratch version of the instant miso soup, built on homemade dashi.",
    category: "Japanese",
    recipeType: "Meal",
    tags: ["soup", "vegetarian"],
    requiresRecipes: ["Homemade Awase Dashi"],
    servings: 2,
    prepTime: 10,
    cookTime: 10,
    instructions:
      "1. Rehydrate shiitake.\n2. Slice mushrooms.\n3. Warm dashi with mushrooms.\n4. Add tofu and wakame.\n5. Turn heat low.\n6. Dissolve miso into a small amount of broth.\n7. Return miso mixture to the pot.\n8. Do not boil after adding miso.\n9. Garnish with scallion.",
    notes: "",
    ingredients: [
      { name: "dried shiitake mushrooms", quantity: "3", unit: "pieces", optional: false },
      { name: "miso", quantity: "2", unit: "tbsp", optional: false },
      { name: "tofu", quantity: "1/2", unit: "block", optional: false },
      { name: "wakame", quantity: "1", unit: "tbsp", optional: false },
      { name: "scallion", quantity: "1", unit: "", optional: false },
      { name: "nori", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Japanese Simmered Daikon & Shiitake",
    description: "A quiet, deeply seasoned home-cooking dish rather than restaurant food.",
    category: "Japanese",
    recipeType: "Meal",
    tags: ["home cooking", "vegetarian"],
    requiresRecipes: ["Homemade Awase Dashi"],
    servings: 3,
    prepTime: 15,
    cookTime: 30,
    instructions:
      "1. Soak shiitake.\n2. Cut daikon into thick rounds.\n3. Simmer daikon until beginning to soften.\n4. Add dashi, shiitake, soy sauce, mirin, and sugar.\n5. Simmer gently until the daikon is tender and deeply seasoned.\n6. Serve with scallions or shichimi if available.",
    notes: "",
    ingredients: [
      { name: "daikon", quantity: "1", unit: "", optional: false },
      { name: "dried shiitake mushrooms", quantity: "4", unit: "pieces", optional: false },
      { name: "soy sauce", quantity: "2", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "2", unit: "tbsp", optional: false },
      { name: "sugar", quantity: "1", unit: "tsp", optional: false },
      { name: "kombu", quantity: "1", unit: "piece", optional: true },
      { name: "scallion or shichimi", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Homemade Japanese Pickled Cucumbers",
    description: "A quick refrigerator pickle in rice vinegar, soy, and sesame.",
    category: "Japanese",
    recipeType: "Preserve",
    tags: ["pickles", "from scratch"],
    requiresRecipes: [],
    servings: 4,
    prepTime: 15,
    cookTime: 0,
    instructions:
      "1. Slice cucumbers.\n2. Lightly salt and let sit 10 minutes.\n3. Squeeze out excess water.\n4. Mix vinegar, soy sauce, sugar, and sesame oil.\n5. Toss with cucumber.\n6. Refrigerate for at least 30 minutes.",
    notes: "A great way to make fresh produce work harder.",
    ingredients: [
      { name: "cucumbers", quantity: "2", unit: "", optional: false },
      { name: "rice vinegar", quantity: "2", unit: "tbsp", optional: false },
      { name: "soy sauce", quantity: "1", unit: "tbsp", optional: false },
      { name: "sugar", quantity: "1", unit: "tsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "sesame seeds", quantity: "", unit: "", optional: false },
      { name: "chili flakes", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Homemade Anko",
    description: "Sweetened azuki bean paste, cooked from dried beans — a component recipe that feeds toast, dorayaki, mochi, and more.",
    category: "Japanese",
    recipeType: "Component",
    tags: ["dessert", "from scratch"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 10,
    cookTime: 150,
    instructions:
      "1. Rinse beans.\n2. Cover with water.\n3. Bring to a boil.\n4. Drain.\n5. Cover with fresh water.\n6. Simmer until completely tender.\n7. Drain excess water.\n8. Add sugar gradually.\n9. Cook until thick and glossy.\n10. Finish with a tiny pinch of salt.",
    notes: "Use for anko toast, dorayaki, mochi, matcha parfaits, anpan, and hojicha desserts.",
    ingredients: [
      { name: "dried azuki beans", quantity: "1", unit: "cup", optional: false },
      { name: "water", quantity: "", unit: "", optional: false },
      { name: "sugar", quantity: "3/4", unit: "cup", optional: false },
      { name: "salt", quantity: "1", unit: "pinch", optional: false },
    ],
  },
  {
    title: "Homemade Japanese Curry",
    description: "A from-scratch roux-based curry, instead of relying on store-bought curry blocks.",
    category: "Japanese",
    recipeType: "From Scratch",
    tags: ["dinner", "from scratch", "fall"],
    requiresRecipes: ["Homemade Vegetable Stock"],
    servings: 4,
    prepTime: 20,
    cookTime: 40,
    instructions:
      "1. Sauté onion until deeply golden.\n2. Add carrots and potatoes.\n3. Add stock.\n4. Simmer until vegetables are tender.\n5. Separately make a roux with butter/oil and flour.\n6. Stir in curry powder and spices.\n7. Slowly incorporate hot stock.\n8. Return roux to the pot.\n9. Add grated apple, soy sauce, and ketchup.\n10. Simmer until thick.\n11. Serve over Japanese rice.",
    notes: "A good September recipe.",
    ingredients: [
      { name: "butter or neutral oil", quantity: "2", unit: "tbsp", optional: false },
      { name: "flour", quantity: "2", unit: "tbsp", optional: false },
      { name: "curry powder", quantity: "1", unit: "tbsp", optional: false },
      { name: "garam masala", quantity: "1", unit: "tsp", optional: false },
      { name: "turmeric", quantity: "1/2", unit: "tsp", optional: false },
      { name: "cumin", quantity: "1/2", unit: "tsp", optional: false },
      { name: "coriander", quantity: "1/2", unit: "tsp", optional: false },
      { name: "onion", quantity: "1", unit: "", optional: false },
      { name: "carrots", quantity: "2", unit: "", optional: false },
      { name: "potatoes", quantity: "2", unit: "", optional: false },
      { name: "apple, grated", quantity: "1", unit: "", optional: false },
      { name: "soy sauce", quantity: "1", unit: "tbsp", optional: false },
      { name: "ketchup", quantity: "1", unit: "tbsp", optional: false },
      { name: "salt", quantity: "", unit: "", optional: false },
      { name: "black pepper", quantity: "", unit: "", optional: false },
    ],
  },
];

async function addScratchCookingRecipes() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run addScratchCookingRecipes() again.");
    return;
  }
  for (const recipe of SCRATCH_COOKING_RECIPES) {
    console.log("Adding:", recipe.title);
    await runAdminCloud("adminCreateRecipe", recipe);
  }
  console.log("Done. Reload cookbook.html — try the TYPE filter row and open Classic Kake Udon to see Requires in action.");
}
