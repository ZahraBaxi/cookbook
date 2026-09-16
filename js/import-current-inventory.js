/**
 * import-current-inventory.js  (optional — not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * One-time bulk import of your actual current Fridge + Freezer contents,
 * PLUS the matching StorageLayout zones (shelves/drawers/bins) so the
 * Admin → Layout grid and the Inventory mini-map immediately reflect your
 * real shelves instead of starting blank.
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the ENTIRE contents of this file into the console and hit
 *      enter, then run:
 *          importCurrentInventory()
 *   4. Wait for "Done." in the console — this makes ~65 sequential Cloud
 *      Function calls, so it takes a little while. Don't close the tab
 *      mid-run.
 *   5. Reload Inventory and Admin → Layout to see it.
 *
 * SAFE TO RE-RUN? Re-running this will create DUPLICATE inventory items
 * (adminCreateInventoryItem always inserts a new row — it doesn't check
 * for existing ones). The StorageLayout calls ARE safe to re-run — they
 * upsert by location, so running those again just re-saves the same
 * zones. If you need to re-run the item import, delete the previously
 * imported items in Admin → Inventory first.
 * -----------------------------------------------------------------------
 */

// -----------------------------------------------------------------------
// Storage layout zones — matches your real Freezer + Fridge shelves so
// Admin → Layout and the Inventory mini-map are populated right away.
// Geometry is just a sensible rectangle layout; drag any zone's cells in
// Admin → Layout afterwards if you want to reshape or resize them.
// -----------------------------------------------------------------------

const IMPORT_FREEZER_LAYOUT = {
  location: "Freezer",
  rows: 2,
  cols: 3,
  zones: [
    { id: "zone-freezer-top", name: "Top Shelf", type: "Shelf", rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 1 },
    { id: "zone-freezer-bottom", name: "Bottom Shelf", type: "Shelf", rowStart: 1, rowEnd: 1, colStart: 0, colEnd: 1 },
    { id: "zone-freezer-door-top", name: "Door Top Shelf", type: "Door Bin", rowStart: 0, rowEnd: 0, colStart: 2, colEnd: 2 },
    { id: "zone-freezer-door-bottom", name: "Door Bottom Shelf", type: "Door Bin", rowStart: 1, rowEnd: 1, colStart: 2, colEnd: 2 },
  ],
};

const IMPORT_FRIDGE_LAYOUT = {
  location: "Fridge",
  rows: 4,
  cols: 5,
  zones: [
    { id: "zone-fridge-top", name: "Top Shelf", type: "Shelf", rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 2 },
    { id: "zone-fridge-middle", name: "Middle Shelf", type: "Shelf", rowStart: 1, rowEnd: 1, colStart: 0, colEnd: 2 },
    { id: "zone-fridge-bottom", name: "Bottom Shelf", type: "Shelf", rowStart: 2, rowEnd: 2, colStart: 0, colEnd: 2 },
    { id: "zone-fridge-crisper", name: "Crisper", type: "Drawer", rowStart: 3, rowEnd: 3, colStart: 0, colEnd: 2 },
    { id: "zone-fridge-door-top", name: "Door Top Shelf", type: "Door Bin", rowStart: 0, rowEnd: 0, colStart: 3, colEnd: 4 },
    { id: "zone-fridge-door-left", name: "Door Left Shelf", type: "Door Bin", rowStart: 1, rowEnd: 1, colStart: 3, colEnd: 3 },
    { id: "zone-fridge-door-right", name: "Door Right Shelf", type: "Door Bin", rowStart: 1, rowEnd: 1, colStart: 4, colEnd: 4 },
  ],
};

// -----------------------------------------------------------------------
// Inventory items. Quantity/unit are reasonable guesses since the list I
// was given didn't include counts — edit those (and levels) after import,
// they're easy to tweak from Admin → Inventory afterwards.
// -----------------------------------------------------------------------

const IMPORT_ITEMS = [
  // ---- Freezer / Top Shelf ----
  { name: "Frozen Cassava Tortillas", category: "Frozen", location: "Freezer", shelf: "Top Shelf", quantity: 1, unit: "bag", level: "Full" },
  { name: "Frozen Mochi (4-Pack)", category: "Frozen", location: "Freezer", shelf: "Top Shelf", quantity: 1, unit: "pack", level: "Full" },

  // ---- Freezer / Bottom Shelf ----
  { name: "Homemade Chocolate Ice Cream", category: "Frozen", location: "Freezer", shelf: "Bottom Shelf", quantity: 1, unit: "container", level: "Full" },
  { name: "Vegetarian Pupusas", category: "Frozen", location: "Freezer", shelf: "Bottom Shelf", quantity: 1, unit: "pack", level: "Full" },
  { name: "Oatly Salted Caramel Frozen Dessert", category: "Frozen", location: "Freezer", shelf: "Bottom Shelf", quantity: 1, unit: "pint", level: "Full" },

  // ---- Freezer / Door Top Shelf ----
  { name: "Trader Joe's Sweet Ripe Fried Plantains", category: "Frozen", location: "Freezer", shelf: "Door Top Shelf", quantity: 1, unit: "bag", level: "Full" },

  // ---- Freezer / Door Bottom Shelf ----
  { name: "Impossible Dino Nuggets", category: "Frozen", location: "Freezer", shelf: "Door Bottom Shelf", quantity: 1, unit: "bag", level: "Full" },

  // ---- Fridge / Top Shelf ----
  { name: "Cranberry Juice", category: "Other", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "bottle", level: "Full" },
  { name: "Vegan Pepperoni", category: "Protein", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "pack", level: "Full" },
  { name: "Vegan Cheese Slices", category: "Dairy", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "pack", level: "Full" },
  { name: "Homemade Yogurt", category: "Dairy", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "container", level: "Full" },
  { name: "Goat Cheese Log", category: "Dairy", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "log", level: "Full" },
  { name: "Soybean Dashi Miso", category: "Japanese", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "tub", level: "Full" },
  { name: "Plant-Based Mayo", category: "Sauces", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "jar", level: "Full" },
  { name: "Sriracha Sauce", category: "Sauces", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "bottle", level: "Full" },
  { name: "Soy Sauce", category: "Japanese", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "bottle", level: "Full" },
  { name: "Ponzu Sauce", category: "Japanese", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "bottle", level: "Full" },
  { name: "Fish Sauce", category: "Sauces", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "bottle", level: "Full" },
  { name: "Vegan Shredded Cheddar", category: "Dairy", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "bag", level: "Full" },
  { name: "Vegan Shredded Mozzarella", category: "Dairy", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "bag", level: "Full" },
  { name: "Wheat Germ", category: "Baking", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "jar", level: "Full" },
  { name: "Pillsbury Oven-Bake Cookies", category: "Baking", location: "Fridge", shelf: "Top Shelf", quantity: 1, unit: "tube", level: "Full" },

  // ---- Fridge / Middle Shelf ----
  { name: "Low-Fat Cottage Cheese", category: "Dairy", location: "Fridge", shelf: "Middle Shelf", quantity: 1, unit: "tub", level: "Full" },
  { name: "Spicy Mac and Cheese", category: "Other", location: "Fridge", shelf: "Middle Shelf", quantity: 1, unit: "container", level: "Full", notes: "Leftovers" },
  { name: "Chana Masala", category: "Other", location: "Fridge", shelf: "Middle Shelf", quantity: 1, unit: "container", level: "Full", notes: "Leftovers" },
  { name: "Homemade Bagels", category: "Baking", location: "Fridge", shelf: "Middle Shelf", quantity: 1, unit: "bag", level: "Full" },
  { name: "Premade Sushi Rice", category: "Japanese", location: "Fridge", shelf: "Middle Shelf", quantity: 1, unit: "container", level: "Full" },
  { name: "Homemade Pickled Daikon and Carrots", category: "Other", location: "Fridge", shelf: "Middle Shelf", quantity: 1, unit: "jar", level: "Full" },
  { name: "Straus Heavy Cream", category: "Dairy", location: "Fridge", shelf: "Middle Shelf", quantity: 1, unit: "carton", level: "Full" },

  // ---- Fridge / Bottom Shelf ----
  { name: "Shrimp Spring Rolls", category: "Other", location: "Fridge", shelf: "Bottom Shelf", quantity: 1, unit: "container", level: "Full", notes: "Leftovers" },
  { name: "Soaked Tofu", category: "Protein", location: "Fridge", shelf: "Bottom Shelf", quantity: 1, unit: "container", level: "Full" },
  { name: "Soaked Chickpeas", category: "Protein", location: "Fridge", shelf: "Bottom Shelf", quantity: 1, unit: "container", level: "Full" },
  { name: "White Onion", category: "Produce", location: "Fridge", shelf: "Bottom Shelf", quantity: 1, unit: "whole", level: "Full", notes: "Leftover, sealed" },
  { name: "Yeast", category: "Baking", location: "Fridge", shelf: "Bottom Shelf", quantity: 1, unit: "jar", level: "Full" },
  { name: "Annie's Cinnamon Rolls (Canned)", category: "Baking", location: "Fridge", shelf: "Bottom Shelf", quantity: 1, unit: "can", level: "Full" },
  { name: "Strawberries", category: "Produce", location: "Fridge", shelf: "Bottom Shelf", quantity: 1, unit: "container", level: "Full" },

  // ---- Fridge / Crisper ----
  { name: "Shishito Peppers", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "bag", level: "Full" },
  { name: "Green Onions", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "bunch", level: "Full" },
  { name: "Carrots", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "bag", level: "Full" },
  { name: "Daikon", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "whole", level: "Full" },
  { name: "Spinach", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "bag", level: "Full" },
  { name: "Napa Cabbage", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "whole", level: "Full" },
  { name: "Apples", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "bag", level: "Full" },
  { name: "Tomatoes", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "whole", level: "Full" },
  { name: "Cucumber", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "whole", level: "Full" },
  { name: "Japanese Sweet Potato", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "whole", level: "Full", notes: "Leftover" },
  { name: "Avocado", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "whole", level: "Full" },
  { name: "Ginger", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "piece", level: "Full" },
  { name: "Lemons", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "bag", level: "Full" },
  { name: "Beets", category: "Produce", location: "Fridge", shelf: "Crisper", quantity: 1, unit: "bunch", level: "Full" },

  // ---- Fridge / Door Top Shelf ----
  { name: "Blue Eggs", category: "Protein", location: "Fridge", shelf: "Door Top Shelf", quantity: 1, unit: "carton", level: "Full" },
  { name: "Plain Cream Cheese", category: "Dairy", location: "Fridge", shelf: "Door Top Shelf", quantity: 1, unit: "block", level: "Full" },
  { name: "Strawberry Cream Cheese", category: "Dairy", location: "Fridge", shelf: "Door Top Shelf", quantity: 1, unit: "block", level: "Full" },
  { name: "Salted Butter Sticks", category: "Dairy", location: "Fridge", shelf: "Door Top Shelf", quantity: 1, unit: "pack", level: "Full" },

  // ---- Fridge / Door Left Shelf ----
  { name: "Straus 2% Milk", category: "Dairy", location: "Fridge", shelf: "Door Left Shelf", quantity: 1, unit: "carton", level: "Full" },
  { name: "Oatly Chocolate Milk", category: "Dairy", location: "Fridge", shelf: "Door Left Shelf", quantity: 1, unit: "box", level: "Full" },

  // ---- Fridge / Door Right Shelf ----
  { name: "Oatly Oat Milk", category: "Dairy", location: "Fridge", shelf: "Door Right Shelf", quantity: 1, unit: "box", level: "Full" },
  { name: "Whipped Cream", category: "Dairy", location: "Fridge", shelf: "Door Right Shelf", quantity: 1, unit: "can", level: "Full" },
  { name: "Chocolate Chips", category: "Baking", location: "Fridge", shelf: "Door Right Shelf", quantity: 1, unit: "bag", level: "Full" },
  { name: "Tomato Paste", category: "Sauces", location: "Fridge", shelf: "Door Right Shelf", quantity: 1, unit: "tube", level: "1/4", notes: "Leftover, partial tube" },
];

async function importCurrentInventory() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run importCurrentInventory() again.");
    return;
  }

  console.log("Saving Freezer + Fridge layouts…");
  await runAdminCloud("adminSaveStorageLayout", IMPORT_FREEZER_LAYOUT);
  await runAdminCloud("adminSaveStorageLayout", IMPORT_FRIDGE_LAYOUT);

  console.log(`Importing ${IMPORT_ITEMS.length} inventory items…`);
  for (let i = 0; i < IMPORT_ITEMS.length; i++) {
    const item = IMPORT_ITEMS[i];
    await runAdminCloud("adminCreateInventoryItem", item);
    console.log(`  (${i + 1}/${IMPORT_ITEMS.length}) ${item.name}`);
  }

  console.log("Done. Reload Inventory and Admin → Layout to see it.");
}
