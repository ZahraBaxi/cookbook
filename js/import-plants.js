/**
 * import-plants.js  (optional — not loaded by any page automatically)
 * -----------------------------------------------------------------------
 * One-time bulk import of your current plants. baseWaterDays below are
 * reasonable starting guesses based on the plant type — not exact, and
 * meant to be adjusted from Admin → Plants once you see how each one
 * actually does on that schedule. Outdoor plants' next-due date will
 * additionally get nudged by recent weather once this is in.
 *
 * HOW TO RUN:
 *   1. Log into admin.html as zeebug.
 *   2. Open the browser devtools console on that page.
 *   3. Paste the ENTIRE contents of this file into the console and hit
 *      enter, then run:
 *          importPlants()
 *   4. Wait for "Done." in the console.
 *   5. Reload Admin → Plants to see it.
 *
 * SAFE TO RE-RUN? No — re-running this creates duplicate entries.
 * Delete the previously imported plants first if you need to re-run it.
 * -----------------------------------------------------------------------
 */

const IMPORT_PLANTS = [
  { name: "Slowbolt Cilantro", location: "Above windowsill", isOutdoor: false, baseWaterDays: 4 },
  { name: "Jalapeño", location: "Outside", isOutdoor: true, baseWaterDays: 3 },
  { name: "Cherry Falls Tomatoes", location: "Outside", isOutdoor: true, baseWaterDays: 3 },
  { name: "Butterfly Pea Flower", location: "Outside", isOutdoor: true, baseWaterDays: 4 },
  { name: "Pothos", location: "Above windowsill", isOutdoor: false, baseWaterDays: 9 },
  { name: "Pothos", location: "Above, on mezzanine", isOutdoor: false, baseWaterDays: 9 },
  { name: "Mini Cactus", location: "Above windowsill", isOutdoor: false, baseWaterDays: 18 },
  { name: "Italian Genovese Basil", location: "Above fridge", isOutdoor: false, baseWaterDays: 4 },
  { name: "Sweet Thai Basil", location: "Above fridge", isOutdoor: false, baseWaterDays: 4 },
  { name: "Juniper Bonsai", location: "Outside", isOutdoor: true, baseWaterDays: 2 },
  { name: "Juniper Bonsai", location: "Outside", isOutdoor: true, baseWaterDays: 2 },
  { name: "Begonia Maculata", location: "On top of shelf", isOutdoor: false, baseWaterDays: 6, notes: "Polka dot begonia" },
  { name: "Spider Plant", location: "AC unit", isOutdoor: false, baseWaterDays: 8 },
  { name: "Monstera", location: "By door", isOutdoor: false, baseWaterDays: 7 },
  { name: "Indigo", location: "On bookshelf", isOutdoor: false, baseWaterDays: 5 },
];

async function importPlants() {
  if (!isAdminLoggedIn()) {
    console.error("Log into admin.html first, then run importPlants() again.");
    return;
  }

  console.log(`Importing ${IMPORT_PLANTS.length} plants…`);
  for (let i = 0; i < IMPORT_PLANTS.length; i++) {
    const plant = IMPORT_PLANTS[i];
    await runAdminCloud("adminSavePlant", plant);
    console.log(`  (${i + 1}/${IMPORT_PLANTS.length}) ${plant.name} — ${plant.location}`);
  }

  console.log("Done. Reload Admin → Plants to see it.");
}
