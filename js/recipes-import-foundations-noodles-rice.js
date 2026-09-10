/**
 * recipes-import-foundations-noodles-rice.js  (not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * Adds 18 recipes: from-scratch foundations (dashi, furikake, ponzu, soy
 * milk, tofu, miso, pickles), homemade noodles, and rice/onigiri dishes.
 *
 * ORDER MATTERS: foundations are created first so later recipes in this
 * same file — and in recipes-import-vegetarian-soups-fall-dessert.js —
 * can find them by title via `requiresRecipes`.
 *
 * Run this BEFORE recipes-import-vegetarian-soups-fall-dessert.js.
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the contents of this file and run:
 *          addFoundationsNoodlesRice()
 * -----------------------------------------------------------------------
 */

const FOUNDATIONS_NOODLES_RICE_RECIPES = [
  {
    title: "Homemade Kombu-Shiitake Dashi",
    description: "A fully vegetarian dashi — the base for everything meant to stay plant-based.",
    category: "Japanese",
    recipeType: "Component",
    difficulty: 1,
    tags: ["foundation", "vegetarian", "from scratch"],
    requiresRecipes: [],
    servings: 4,
    prepTime: 30,
    cookTime: 15,
    instructions:
      "1. Wipe the kombu clean — don't rinse off the white bloom.\n2. Soak kombu in the water for at least 30 minutes.\n3. Warm slowly, removing the kombu just before it boils.\n4. Add shiitake and simmer 10 minutes.\n5. Remove shiitake (save for another use) and strain.",
    notes: "The vegetarian counterpart to Homemade Awase Dashi — use this one for anything meant to stay plant-based.",
    ingredients: [
      { name: "water", quantity: "4", unit: "cups", optional: false },
      { name: "kombu", quantity: "1", unit: "piece", optional: false },
      { name: "dried shiitake mushrooms", quantity: "4", unit: "pieces", optional: false },
    ],
  },
  {
    title: "Homemade Furikake",
    description: "A savory rice seasoning of toasted sesame, nori, and bonito.",
    category: "Japanese",
    recipeType: "Component",
    difficulty: 2,
    tags: ["condiment", "from scratch"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 10,
    cookTime: 5,
    instructions:
      "1. Toast sesame seeds lightly in a dry pan.\n2. Toast bonito flakes briefly until fragrant and crisp.\n3. Crumble nori into small flakes.\n4. Combine sesame, bonito, and nori.\n5. Season lightly with salt and sugar if using.\n6. Store airtight — keeps 1–2 weeks at room temperature.",
    notes: "Great on rice, noodles, vegetables, or onigiri.",
    ingredients: [
      { name: "sesame seeds", quantity: "3", unit: "tbsp", optional: false },
      { name: "nori", quantity: "2", unit: "sheets", optional: false },
      { name: "shaved bonito", quantity: "1/2", unit: "cup", optional: false },
      { name: "salt", quantity: "1/4", unit: "tsp", optional: true },
      { name: "sugar", quantity: "1/2", unit: "tsp", optional: true },
    ],
  },
  {
    title: "Homemade Ponzu",
    description: "A citrus-soy dipping sauce, infused overnight with kombu and bonito.",
    category: "Japanese",
    recipeType: "Component",
    difficulty: 2,
    tags: ["condiment", "from scratch"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 10,
    cookTime: 0,
    instructions:
      "1. Combine soy sauce, citrus juice, and rice vinegar.\n2. Add kombu and bonito flakes.\n3. Refrigerate at least 24 hours to infuse.\n4. Strain and store refrigerated.",
    notes: "Infuses over a day or two — the longer it sits, the rounder the flavor.",
    ingredients: [
      { name: "soy sauce", quantity: "1/2", unit: "cup", optional: false },
      { name: "citrus juice (yuzu or lemon)", quantity: "1/4", unit: "cup", optional: false },
      { name: "rice vinegar", quantity: "2", unit: "tbsp", optional: false },
      { name: "kombu", quantity: "1", unit: "small piece", optional: false },
      { name: "shaved bonito", quantity: "2", unit: "tbsp", optional: false },
    ],
  },
  {
    title: "Homemade Soy Milk",
    description: "Soaked, blended, and strained soybeans — the base for homemade tofu.",
    category: "Japanese",
    recipeType: "Project",
    difficulty: 3,
    tags: ["from scratch", "project"],
    requiresRecipes: [],
    servings: 6,
    prepTime: 480,
    cookTime: 20,
    instructions:
      "1. Soak soybeans in plenty of water at least 8 hours or overnight.\n2. Drain and blend soybeans with fresh water until smooth.\n3. Bring to a gentle boil, stirring often to prevent scorching, then simmer 10–15 minutes.\n4. Strain through cheesecloth, squeezing out all the milk.\n5. Cool and refrigerate; use within a few days.",
    notes: "The base for Homemade Tofu — save the leftover okara pulp for cooking too.",
    ingredients: [
      { name: "dried soybeans", quantity: "1", unit: "cup", optional: false },
      { name: "water", quantity: "6", unit: "cups", optional: false },
    ],
  },
  {
    title: "Homemade Tofu",
    description: "Fresh soy milk coagulated with nigari and pressed into blocks.",
    category: "Japanese",
    recipeType: "Project",
    difficulty: 4,
    tags: ["from scratch", "project"],
    requiresRecipes: ["Homemade Soy Milk"],
    servings: 4,
    prepTime: 30,
    cookTime: 20,
    instructions:
      "1. Heat fresh soy milk to about 175°F.\n2. Dissolve nigari in a little water and stir gently into the hot soy milk.\n3. Let sit undisturbed 10–15 minutes as curds separate from whey.\n4. Ladle curds into a cloth-lined mold.\n5. Press under light weight 15–30 minutes depending on desired firmness.\n6. Chill in cold water before using.",
    notes: "A great weekend project once you've made soy milk.",
    ingredients: [{ name: "nigari (or lemon juice/vinegar as coagulant)", quantity: "1", unit: "tbsp", optional: false }],
  },
  {
    title: "Homemade Miso",
    description: "Soybeans, koji, and salt, fermented for months into a pantry staple.",
    category: "Japanese",
    recipeType: "Project",
    difficulty: 5,
    tags: ["from scratch", "project", "fermentation"],
    requiresRecipes: [],
    servings: 20,
    prepTime: 60,
    cookTime: 240,
    instructions:
      "1. Soak soybeans overnight, then simmer until very tender, 3–4 hours.\n2. Mash soybeans while still warm.\n3. Mix koji and salt together thoroughly.\n4. Combine mashed soybeans with the koji-salt mixture, adding reserved cooking liquid to reach a firm, moist paste.\n5. Pack tightly into a sterilized fermentation crock, pressing out air pockets.\n6. Weight it down, cover, and ferment in a cool, dark place for 6–12 months, checking occasionally.",
    notes: "A much bigger project than anything else here, but it fits the philosophy — months of fermentation for a pantry staple.",
    ingredients: [
      { name: "dried soybeans", quantity: "2", unit: "cups", optional: false },
      { name: "koji rice", quantity: "2", unit: "cups", optional: false },
      { name: "salt", quantity: "1", unit: "cup", optional: false },
      { name: "water", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Homemade Japanese Pickles — Shiozuke",
    description: "The simplest introduction to Japanese preservation — vegetables and salt.",
    category: "Japanese",
    recipeType: "Preserve",
    difficulty: 1,
    tags: ["pickles", "from scratch"],
    requiresRecipes: [],
    servings: 4,
    prepTime: 15,
    cookTime: 0,
    instructions:
      "1. Slice vegetables thinly.\n2. Toss with salt (about 2% of the vegetable's weight).\n3. Add kombu or chili if using.\n4. Weight down under a plate or press for at least 1–2 hours, or overnight for deeper flavor.\n5. Rinse lightly if very salty, then serve.",
    notes: "A good starting point before Nukazuke.",
    ingredients: [
      { name: "cabbage or cucumber or daikon", quantity: "1", unit: "lb", optional: false },
      { name: "salt", quantity: "1", unit: "tbsp", optional: false },
      { name: "kombu", quantity: "1", unit: "small piece", optional: true },
      { name: "chili", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Homemade Nukazuke",
    description: "A live rice-bran fermentation bed for ongoing vegetable pickling.",
    category: "Japanese",
    recipeType: "Preserve",
    difficulty: 4,
    tags: ["pickles", "from scratch", "fermentation", "project"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 30,
    cookTime: 0,
    instructions:
      "1. Mix rice bran with salt and water to form a thick, moist paste.\n2. Add kombu and a piece of stale bread or extra vegetable scraps to help start fermentation.\n3. Let the bed mature about a week, mixing daily by hand.\n4. Once active, bury vegetables in the bed for 1–2 days to pickle.\n5. Continue mixing the bed daily to keep it alive; refresh with more bran and salt over time.",
    notes: "A more ambitious ongoing project than Shiozuke — the bed needs continuous care to stay alive.",
    ingredients: [
      { name: "rice bran (nuka)", quantity: "4", unit: "cups", optional: false },
      { name: "salt", quantity: "1/2", unit: "cup", optional: false },
      { name: "water", quantity: "", unit: "", optional: false },
      { name: "kombu", quantity: "1", unit: "piece", optional: false },
      { name: "vegetables for pickling (daikon, cucumber, carrot)", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Homemade Soba Noodles",
    description: "Buckwheat noodles, hand-rolled and sliced.",
    category: "Japanese",
    recipeType: "Project",
    difficulty: 4,
    tags: ["from scratch", "project", "noodles"],
    requiresRecipes: [],
    servings: 3,
    prepTime: 30,
    cookTime: 10,
    instructions:
      "1. Combine buckwheat and AP flour.\n2. Gradually add water, mixing until a shaggy dough forms.\n3. Knead until smooth — buckwheat dough is less elastic than wheat, so work gently.\n4. Rest covered 20–30 minutes.\n5. Roll thin and slice into noodles, dusting with flour to prevent sticking.\n6. Cook in boiling water 1–2 minutes, then rinse under cold water.",
    notes: "Especially relevant since you already have buckwheat flour on hand.",
    ingredients: [
      { name: "buckwheat flour", quantity: "1.5", unit: "cups", optional: false },
      { name: "AP flour", quantity: "1/2", unit: "cup", optional: false },
      { name: "water", quantity: "3/4", unit: "cup", optional: false },
    ],
  },
  {
    title: "Yaki Udon",
    description: "Fresh udon stir-fried with cabbage, mushrooms, carrot, and tofu.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 2,
    tags: ["dinner", "quick"],
    requiresRecipes: ["Homemade Udon Noodles"],
    servings: 2,
    prepTime: 10,
    cookTime: 10,
    instructions:
      "1. Stir-fry cabbage, mushrooms, and carrot until just tender.\n2. Add tofu and cooked udon noodles.\n3. Season with soy sauce and sesame oil.\n4. Toss until everything is well coated and heated through.",
    notes: "",
    ingredients: [
      { name: "cabbage", quantity: "2", unit: "cups", optional: false },
      { name: "mushrooms", quantity: "1", unit: "cup", optional: false },
      { name: "carrot", quantity: "1", unit: "", optional: false },
      { name: "tofu", quantity: "1/2", unit: "block", optional: false },
      { name: "soy sauce", quantity: "2", unit: "tbsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Cold Zaru Udon",
    description: "Chilled homemade udon with a cold dashi-soy dipping sauce.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 2,
    tags: ["summer", "lunch"],
    requiresRecipes: ["Homemade Udon Noodles", "Homemade Kombu-Shiitake Dashi"],
    servings: 2,
    prepTime: 15,
    cookTime: 5,
    instructions:
      "1. Cook udon and chill thoroughly under cold running water.\n2. Combine dashi, soy sauce, and mirin for the dipping sauce; chill.\n3. Arrange noodles on a bamboo mat or plate.\n4. Serve with the cold dipping sauce, scallion, and nori on the side.",
    notes: "",
    ingredients: [
      { name: "soy sauce", quantity: "3", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "2", unit: "tbsp", optional: false },
      { name: "scallion", quantity: "1", unit: "", optional: false },
      { name: "nori", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Homemade Sesame Soba",
    description: "Chilled homemade soba tossed in a sesame-soy-vinegar dressing with seasonal vegetables.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 2,
    tags: ["lunch", "quick"],
    requiresRecipes: ["Homemade Soba Noodles"],
    servings: 2,
    prepTime: 10,
    cookTime: 5,
    instructions:
      "1. Cook soba and rinse under cold water.\n2. Whisk soy sauce, rice vinegar, and sesame oil together.\n3. Toss noodles with the dressing and seasonal vegetables.\n4. Top with sesame seeds.",
    notes: "",
    ingredients: [
      { name: "soy sauce", quantity: "1", unit: "tbsp", optional: false },
      { name: "rice vinegar", quantity: "1", unit: "tbsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
      { name: "sesame seeds", quantity: "1", unit: "tsp", optional: false },
      { name: "seasonal vegetables", quantity: "1", unit: "cup", optional: false },
    ],
  },
  {
    title: "Tanuki Udon",
    description: "Udon in dashi broth topped with crispy tempura crumbs.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 2,
    tags: ["dinner", "cozy"],
    requiresRecipes: ["Homemade Udon Noodles", "Homemade Kombu-Shiitake Dashi"],
    servings: 2,
    prepTime: 10,
    cookTime: 15,
    instructions:
      "1. Combine dashi, soy sauce, and mirin; bring to a simmer.\n2. Heat cooked udon separately and place in bowls.\n3. Pour hot broth over the noodles.\n4. Top generously with crispy tempura crumbs (tenkasu), scallion, nori, and shiitake if using.",
    notes: "",
    ingredients: [
      { name: "soy sauce", quantity: "2", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "1", unit: "tbsp", optional: false },
      { name: "tempura crumbs (tenkasu)", quantity: "3", unit: "tbsp", optional: false },
      { name: "scallion", quantity: "1", unit: "", optional: false },
      { name: "nori", quantity: "", unit: "", optional: true },
      { name: "dried shiitake mushrooms", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Onigiri — Three Ways",
    description: "One rice-ball recipe, three fillings: salted sesame, miso mushroom, and ume-style vegetable.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 1,
    tags: ["lunch", "snack"],
    requiresRecipes: [],
    servings: 3,
    prepTime: 20,
    cookTime: 0,
    instructions:
      "1. Wet hands with salted water to prevent sticking.\n2. Salted sesame: mix rice with salt and sesame seeds, shape into triangles.\n3. Miso mushroom: fold rehydrated, chopped shiitake mixed with miso into the center of a rice ball.\n4. Ume-style vegetable: fold chopped pickled vegetables and a pinch of sesame into the center.\n5. Wrap each in a strip of nori if desired.",
    notes: "One recipe, three fillings — swap in whatever you have on hand.",
    ingredients: [
      { name: "cooked Japanese rice", quantity: "3", unit: "cups", optional: false },
      { name: "salt", quantity: "1", unit: "tsp", optional: false },
      { name: "sesame seeds", quantity: "2", unit: "tbsp", optional: false },
      { name: "dried shiitake mushrooms", quantity: "2", unit: "pieces", optional: true },
      { name: "miso", quantity: "1", unit: "tbsp", optional: true },
      { name: "pickled vegetables", quantity: "2", unit: "tbsp", optional: true },
      { name: "nori", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Miso Yaki Onigiri",
    description: "Grilled rice triangles brushed with a sweet miso glaze.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 2,
    tags: ["snack", "dinner"],
    requiresRecipes: [],
    servings: 2,
    prepTime: 10,
    cookTime: 10,
    instructions:
      "1. Shape rice into triangles, packing firmly.\n2. Mix miso with mirin to make a glaze.\n3. Brush triangles with sesame oil and grill or pan-fry until golden on both sides.\n4. Brush with the miso glaze and grill briefly until fragrant and slightly crisp.",
    notes: "",
    ingredients: [
      { name: "cooked Japanese rice", quantity: "2", unit: "cups", optional: false },
      { name: "miso", quantity: "2", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "1", unit: "tsp", optional: false },
      { name: "sesame oil", quantity: "1", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Ochazuke",
    description: "Rice with hot tea or dashi poured over, topped with nori and pickles.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 1,
    tags: ["breakfast", "light meal"],
    requiresRecipes: [],
    servings: 1,
    prepTime: 5,
    cookTime: 5,
    instructions:
      "1. Place warm rice in a bowl.\n2. Pour hot green tea or dashi over the rice.\n3. Top with torn nori, sesame seeds, pickled vegetables, and furikake if you have it.",
    notes: "A quiet, simple dish that fits well into a tea-focused routine.",
    ingredients: [
      { name: "cooked rice", quantity: "1", unit: "cup", optional: false },
      { name: "green tea or dashi", quantity: "1.5", unit: "cups", optional: false },
      { name: "nori", quantity: "1", unit: "sheet", optional: false },
      { name: "sesame seeds", quantity: "1", unit: "tsp", optional: true },
      { name: "pickled vegetables", quantity: "2", unit: "tbsp", optional: true },
      { name: "furikake", quantity: "1", unit: "tsp", optional: true },
    ],
  },
  {
    title: "Takikomi Gohan",
    description: "Rice cooked with shiitake, carrot, konnyaku, and tofu in seasoned dashi.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 2,
    tags: ["dinner", "comfort food"],
    requiresRecipes: ["Homemade Kombu-Shiitake Dashi"],
    servings: 4,
    prepTime: 15,
    cookTime: 40,
    instructions:
      "1. Rinse rice.\n2. Combine rice with dashi, soy sauce, mirin, and diced shiitake, carrot, konnyaku, and tofu.\n3. Cook in a rice cooker or pot until liquid is absorbed and rice is tender.\n4. Let rest 10 minutes, then fluff before serving.",
    notes: "",
    ingredients: [
      { name: "Japanese short-grain rice", quantity: "2", unit: "cups", optional: false },
      { name: "dried shiitake mushrooms", quantity: "3", unit: "pieces", optional: false },
      { name: "carrot", quantity: "1", unit: "", optional: false },
      { name: "konnyaku", quantity: "1/2", unit: "block", optional: true },
      { name: "tofu", quantity: "1/2", unit: "block", optional: false },
      { name: "soy sauce", quantity: "2", unit: "tbsp", optional: false },
      { name: "mirin", quantity: "1", unit: "tbsp", optional: false },
    ],
  },
  {
    title: "Japanese Rice with Homemade Furikake",
    description: "About as simple as it gets — a good \"base meal\" entry.",
    category: "Japanese",
    recipeType: "Meal",
    difficulty: 1,
    tags: ["breakfast", "base meal"],
    requiresRecipes: ["Homemade Furikake"],
    servings: 2,
    prepTime: 5,
    cookTime: 0,
    instructions: "1. Scoop warm rice into bowls.\n2. Sprinkle generously with homemade furikake.\n3. Serve as is, or alongside miso soup and pickles.",
    notes: "Almost too simple to count as a recipe, but useful as a base meal.",
    ingredients: [{ name: "cooked Japanese rice", quantity: "2", unit: "cups", optional: false }],
  },
];

async function addFoundationsNoodlesRice() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run addFoundationsNoodlesRice() again.");
    return;
  }
  for (const recipe of FOUNDATIONS_NOODLES_RICE_RECIPES) {
    console.log("Adding:", recipe.title);
    await runAdminCloud("adminCreateRecipe", recipe);
  }
  console.log("Done. Run recipes-import-vegetarian-soups-fall-dessert.js next.");
}
