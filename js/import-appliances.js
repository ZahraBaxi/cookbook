/**
 * import-appliances.js  (optional — not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * One-time bulk import of your current kitchen appliances, each with a
 * plain free-text location (they don't use the doll-house Fridge/Freezer/
 * Pantry system — that's food-only).
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the ENTIRE contents of this file into the console and hit
 *      enter, then run:
 *          importAppliances()
 *   4. Wait for "Done." in the console.
 *   5. Reload Admin → Inventory (filter to APPLIANCES) to see it.
 *
 * SAFE TO RE-RUN? No — re-running this creates duplicate entries, since
 * adminCreateInventoryItem always inserts a new row. Delete the
 * previously imported appliances first if you need to re-run it.
 * -----------------------------------------------------------------------
 */

const IMPORT_APPLIANCES = [
  { name: "Toaster", itemType: "Appliance", location: "On top of fridge" },
  { name: "Waffle Maker", itemType: "Appliance", location: "On top of shelf" },
  { name: "French Press", itemType: "Appliance", location: "On cart" },
  { name: "Gooseneck Tea Kettle", variant: "Bodum", itemType: "Appliance", location: "On coffee corner" },
  { name: "Blender", itemType: "Appliance", location: "On top of fridge" },
  { name: "Immersion Blender", variant: "With attachments", itemType: "Appliance", location: "On top of fridge" },
  { name: "Instant Pot", itemType: "Appliance", location: "On top of shelf" },
  { name: "Yogurt Maker", itemType: "Appliance", location: "On top of shelf" },
  { name: "Egg Maker", variant: "Dash", itemType: "Appliance", location: "On top of fridge, in mixing bowl" },
  { name: "Panini / Grilled Cheese Maker", variant: "Dash", itemType: "Appliance", location: "On top of shelf" },
];

async function importAppliances() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run importAppliances() again.");
    return;
  }

  console.log(`Importing ${IMPORT_APPLIANCES.length} appliances…`);
  for (let i = 0; i < IMPORT_APPLIANCES.length; i++) {
    const item = IMPORT_APPLIANCES[i];
    await runAdminCloud("adminCreateInventoryItem", item);
    console.log(`  (${i + 1}/${IMPORT_APPLIANCES.length}) ${item.name}`);
  }

  console.log("Done. Reload Admin → Inventory (filter: APPLIANCES) to see it.");
}
