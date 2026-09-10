/**
 * recipes-import-indian-foundations.js  (not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * Adds 15 Indian "pantry foundation" recipes: ghee, homemade masalas,
 * chutneys, paneer, besan (chickpea flour), dosa/idli batter, and the
 * core breads (chapati, roti, naan).
 *
 * RUN THIS FIRST — recipes-import-indian-legumes-grains-vegetables.js
 * and recipes-import-indian-breads-snacks-soups-desserts.js both
 * depend on titles created here (Homemade Paneer, Homemade Ghee,
 * Homemade Besan, Homemade Dosa Batter, Homemade Idli Batter,
 * Homemade Chai Masala).
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the contents of this file and run:
 *          addIndianFoundations()
 * -----------------------------------------------------------------------
 */

const INDIAN_FOUNDATIONS_RECIPES = [
  {
    title: "Homemade Ghee",
    description: "Butter slowly cooked until the milk solids separate and brown, leaving clarified fat.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 1,
    tags: ["foundation", "from scratch"],
    requiresRecipes: [],
    servings: 12,
    prepTime: 5,
    cookTime: 20,
    instructions:
      "1. Melt butter in a heavy pan over low heat.\n2. Let it simmer gently — it will foam, then the milk solids will sink and begin to brown.\n3. Watch closely once the solids brown; the ghee is done when it smells nutty and turns golden.\n4. Strain through a fine cloth into a clean jar.\n5. Cool uncovered before sealing.",
    notes: "Keeps at room temperature for months once strained clean.",
    ingredients: [{ name: "butter", quantity: "1", unit: "lb", optional: false }],
  },
  {
    title: "Homemade Garam Masala",
    description: "Whole spices toasted and ground fresh.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 2,
    tags: ["foundation", "from scratch", "spice blend"],
    requiresRecipes: [],
    servings: 16,
    prepTime: 5,
    cookTime: 10,
    instructions:
      "1. Toast whole cumin, coriander, cardamom, cinnamon, cloves, and black pepper in a dry pan until fragrant.\n2. Let cool completely.\n3. Grind to a fine powder in a spice grinder.\n4. Store airtight away from light.",
    notes: "You already have garam masala, but making your own is a satisfying pantry project.",
    ingredients: [
      { name: "cumin seeds", quantity: "2", unit: "tbsp", optional: false },
      { name: "coriander seeds", quantity: "2", unit: "tbsp", optional: false },
      { name: "cardamom pods", quantity: "1", unit: "tbsp", optional: false },
      { name: "cinnamon stick", quantity: "1", unit: "", optional: false },
      { name: "cloves", quantity: "1", unit: "tsp", optional: false },
      { name: "black peppercorns", quantity: "1", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Homemade Chai Masala",
    description: "A warming spice blend of cardamom, cinnamon, ginger, cloves, and black pepper.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 1,
    tags: ["foundation", "from scratch", "tea", "spice blend"],
    requiresRecipes: [],
    servings: 16,
    prepTime: 10,
    cookTime: 0,
    instructions: "1. Combine cardamom, cinnamon, dried ginger, cloves, and black pepper.\n2. Grind to a coarse powder.\n3. Store airtight.",
    notes: "The base for both Chai and Masala Chai Concentrate.",
    ingredients: [
      { name: "cardamom pods", quantity: "2", unit: "tbsp", optional: false },
      { name: "cinnamon stick", quantity: "1", unit: "", optional: false },
      { name: "dried ginger", quantity: "1", unit: "tbsp", optional: false },
      { name: "cloves", quantity: "1", unit: "tsp", optional: false },
      { name: "black peppercorns", quantity: "1", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Homemade Tamarind Chutney",
    description: "A sweet-and-sour chutney of tamarind, jaggery, and spices.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 2,
    tags: ["foundation", "from scratch", "chutney"],
    requiresRecipes: [],
    servings: 12,
    prepTime: 10,
    cookTime: 15,
    instructions:
      "1. Soak tamarind pulp in warm water, then strain to extract the liquid.\n2. Simmer tamarind liquid with jaggery until dissolved and slightly thickened.\n3. Stir in cumin, ginger, and a pinch of salt.\n4. Cool and store refrigerated.",
    notes: "",
    ingredients: [
      { name: "tamarind pulp", quantity: "1/4", unit: "cup", optional: false },
      { name: "water", quantity: "1", unit: "cup", optional: false },
      { name: "jaggery", quantity: "1/3", unit: "cup", optional: false },
      { name: "cumin, ground", quantity: "1/2", unit: "tsp", optional: false },
      { name: "ginger", quantity: "1", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Fresh Green Chutney",
    description: "A bright cilantro-mint chutney with green chili and lemon.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 1,
    tags: ["foundation", "from scratch", "chutney"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 10,
    cookTime: 0,
    instructions: "1. Combine cilantro, mint, green chili, lemon juice, and cumin in a blender.\n2. Blend with a little water to a smooth paste.\n3. Season with salt.",
    notes: "",
    ingredients: [
      { name: "cilantro", quantity: "1", unit: "bunch", optional: false },
      { name: "mint", quantity: "1/2", unit: "bunch", optional: false },
      { name: "green chili", quantity: "1", unit: "", optional: false },
      { name: "lemon juice", quantity: "1", unit: "tbsp", optional: false },
      { name: "cumin, ground", quantity: "1/2", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Coconut Chutney",
    description: "Coconut and roasted dal blended with chili and ginger, finished with a mustard-seed tadka.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 2,
    tags: ["foundation", "from scratch", "chutney"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 10,
    cookTime: 5,
    instructions:
      "1. Blend coconut, roasted dal, green chili, and ginger with a little water into a smooth chutney.\n2. Season with salt.\n3. Heat oil, pop mustard seeds and curry leaves, and pour the tadka over the chutney.",
    notes: "",
    ingredients: [
      { name: "shredded coconut", quantity: "1", unit: "cup", optional: false },
      { name: "roasted chana dal", quantity: "2", unit: "tbsp", optional: false },
      { name: "green chili", quantity: "1", unit: "", optional: false },
      { name: "ginger", quantity: "1", unit: "tsp", optional: false },
      { name: "mustard seeds", quantity: "1/2", unit: "tsp", optional: false },
      { name: "curry leaves", quantity: "", unit: "", optional: true },
    ],
  },
  {
    title: "Tomato Chutney",
    description: "Tomatoes cooked down with chilies, ginger, and garlic into a thick chutney.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 1,
    tags: ["foundation", "from scratch", "chutney"],
    requiresRecipes: [],
    servings: 10,
    prepTime: 10,
    cookTime: 20,
    instructions:
      "1. Sauté ginger and garlic in oil until fragrant.\n2. Add chopped tomatoes and chili, cook down until thick.\n3. Season with cumin and salt.\n4. Cool and store refrigerated.",
    notes: "",
    ingredients: [
      { name: "tomatoes", quantity: "4", unit: "", optional: false },
      { name: "ginger", quantity: "1", unit: "tsp", optional: false },
      { name: "garlic", quantity: "2", unit: "cloves", optional: false },
      { name: "dried chili", quantity: "1", unit: "", optional: false },
      { name: "cumin, ground", quantity: "1/2", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Homemade Paneer",
    description: "Fresh cheese made by curdling milk with an acid and pressing the curds.",
    category: "Indian",
    recipeType: "Project",
    difficulty: 3,
    tags: ["from scratch", "project"],
    requiresRecipes: [],
    servings: 6,
    prepTime: 15,
    cookTime: 20,
    instructions:
      "1. Bring milk to a boil.\n2. Add lemon juice or vinegar gradually, stirring until curds separate cleanly from whey.\n3. Strain through a cloth-lined colander.\n4. Rinse curds briefly under cold water to remove sourness.\n5. Wrap and press under a weight for 30–60 minutes.\n6. Chill before cubing.",
    notes: "Feeds Palak Paneer, Matar Paneer, Paneer Tikka, and Shahi Paneer.",
    ingredients: [
      { name: "whole milk", quantity: "1/2", unit: "gallon", optional: false },
      { name: "lemon juice or vinegar", quantity: "3", unit: "tbsp", optional: false },
    ],
  },
  {
    title: "Homemade Besan (Chickpea Flour)",
    description: "Dried chickpeas ground fine into flour.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 2,
    tags: ["foundation", "from scratch"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 10,
    cookTime: 0,
    instructions: "1. Grind dried chickpeas in a high-powered blender or grain mill until fine.\n2. Sift out any coarse bits and re-grind.\n3. Store airtight.",
    notes: "Feeds Besan Chilla, Besan Ladoo, and any dish calling for chickpea flour.",
    ingredients: [{ name: "dried chickpeas", quantity: "2", unit: "cups", optional: false }],
  },
  {
    title: "Homemade Dosa Batter",
    description: "Fermented rice and urad dal batter for crisp South Indian crepes.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 3,
    tags: ["foundation", "from scratch", "fermentation"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 480,
    cookTime: 0,
    instructions:
      "1. Soak rice and urad dal separately, at least 6 hours or overnight.\n2. Drain and blend each with a little water into a smooth batter.\n3. Combine, season with salt, and mix well.\n4. Cover and ferment in a warm spot 8–12 hours, until bubbly and slightly risen.",
    notes: "",
    ingredients: [
      { name: "rice", quantity: "2", unit: "cups", optional: false },
      { name: "urad dal", quantity: "1/2", unit: "cup", optional: false },
      { name: "salt", quantity: "1", unit: "tsp", optional: false },
      { name: "water", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Homemade Idli Batter",
    description: "A slightly thicker fermented rice-urad dal batter, for steamed idli cakes.",
    category: "Indian",
    recipeType: "Component",
    difficulty: 3,
    tags: ["foundation", "from scratch", "fermentation"],
    requiresRecipes: [],
    servings: 8,
    prepTime: 480,
    cookTime: 0,
    instructions:
      "1. Soak rice and urad dal separately, at least 6 hours or overnight.\n2. Drain and blend each with a little water — keep the batter slightly thicker than for dosa.\n3. Combine, season with salt, and mix well.\n4. Cover and ferment in a warm spot 8–12 hours, until bubbly and risen.",
    notes: "",
    ingredients: [
      { name: "rice", quantity: "2", unit: "cups", optional: false },
      { name: "urad dal", quantity: "1", unit: "cup", optional: false },
      { name: "salt", quantity: "1", unit: "tsp", optional: false },
      { name: "water", quantity: "", unit: "", optional: false },
    ],
  },
  {
    title: "Homemade Papad",
    description: "A more ambitious traditional pantry project — thin lentil-flour wafers, dried and fried or roasted.",
    category: "Indian",
    recipeType: "Project",
    difficulty: 4,
    tags: ["from scratch", "project"],
    requiresRecipes: [],
    servings: 12,
    prepTime: 60,
    cookTime: 5,
    instructions:
      "1. Mix lentil flour with salt, spices, and a little oil into a stiff dough.\n2. Knead well, then rest covered 30 minutes.\n3. Roll into very thin rounds.\n4. Sun-dry or air-dry until fully crisp, at least several hours or overnight.\n5. Fry briefly in hot oil or roast directly over a flame until puffed.",
    notes: "A fun project if you want to go deep into traditional pantry-making.",
    ingredients: [
      { name: "urad dal flour", quantity: "2", unit: "cups", optional: false },
      { name: "salt", quantity: "1", unit: "tsp", optional: false },
      { name: "black pepper, cracked", quantity: "1/2", unit: "tsp", optional: true },
      { name: "oil", quantity: "1", unit: "tbsp", optional: false },
    ],
  },
  {
    title: "Homemade Chapati",
    description: "A simple whole wheat flatbread, cooked on a dry skillet.",
    category: "Indian",
    recipeType: "From Scratch",
    difficulty: 2,
    tags: ["bread", "from scratch"],
    requiresRecipes: [],
    servings: 6,
    prepTime: 20,
    cookTime: 15,
    instructions:
      "1. Mix whole wheat flour, water, and salt into a soft dough.\n2. Knead until smooth, then rest covered 20 minutes.\n3. Divide into balls and roll each into a thin round.\n4. Cook on a hot dry skillet until brown spots appear, flipping once.\n5. Puff briefly over an open flame if desired.",
    notes: "",
    ingredients: [
      { name: "whole wheat flour", quantity: "2", unit: "cups", optional: false },
      { name: "water", quantity: "3/4", unit: "cup", optional: false },
      { name: "salt", quantity: "1/2", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Homemade Roti",
    description: "The same basic dough as chapati, cooked directly over a hot skillet or flame.",
    category: "Indian",
    recipeType: "From Scratch",
    difficulty: 2,
    tags: ["bread", "from scratch"],
    requiresRecipes: [],
    servings: 6,
    prepTime: 20,
    cookTime: 15,
    instructions:
      "1. Mix whole wheat flour, water, and salt into a soft dough.\n2. Knead until smooth, then rest covered 20 minutes.\n3. Divide into balls and roll each into a thin round.\n4. Cook directly on a hot skillet or over an open flame until lightly charred and puffed.",
    notes: "",
    ingredients: [
      { name: "whole wheat flour", quantity: "2", unit: "cups", optional: false },
      { name: "water", quantity: "3/4", unit: "cup", optional: false },
      { name: "salt", quantity: "1/2", unit: "tsp", optional: false },
    ],
  },
  {
    title: "Homemade Naan",
    description: "A yeasted, yogurt-enriched flatbread, cooked in a very hot skillet.",
    category: "Indian",
    recipeType: "From Scratch",
    difficulty: 3,
    tags: ["bread", "from scratch"],
    requiresRecipes: [],
    servings: 6,
    prepTime: 90,
    cookTime: 15,
    instructions:
      "1. Combine flour, yogurt, yeast (or baking powder), sugar, and salt with warm water into a soft dough.\n2. Knead until smooth and elastic.\n3. Cover and let rise 1–1.5 hours until puffy.\n4. Divide and roll into ovals.\n5. Cook in a very hot dry skillet until bubbled and charred in spots, flipping once.\n6. Brush with butter or ghee.",
    notes: "",
    ingredients: [
      { name: "AP flour", quantity: "2", unit: "cups", optional: false },
      { name: "yogurt", quantity: "1/4", unit: "cup", optional: false },
      { name: "yeast or baking powder", quantity: "1", unit: "tsp", optional: false },
      { name: "sugar", quantity: "1", unit: "tsp", optional: false },
      { name: "salt", quantity: "1/2", unit: "tsp", optional: false },
      { name: "warm water", quantity: "1/2", unit: "cup", optional: false },
      { name: "butter or ghee", quantity: "", unit: "", optional: true },
    ],
  },
];

async function addIndianFoundations() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run addIndianFoundations() again.");
    return;
  }
  for (const recipe of INDIAN_FOUNDATIONS_RECIPES) {
    console.log("Adding:", recipe.title);
    await runAdminCloud("adminCreateRecipe", recipe);
  }
  console.log("Done. Run recipes-import-indian-legumes-grains-vegetables.js next.");
}
