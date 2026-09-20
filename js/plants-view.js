/**
 * plants-view.js
 * -----------------------------------------------------------------------
 * Powers the public, read-only plants.html — just "when do I need to
 * water what," no login needed (Plant is Public Read, same as
 * InventoryItem/Recipe). Logging a watering or editing a plant's
 * schedule still requires Admin -> Plants; this page only displays.
 *
 * The schedule math (computePlantSchedule, fetchRecentWeather,
 * weatherNote) is intentionally identical to the copies in js/admin.js --
 * if you tune the weather-adjustment thresholds in CONFIG, both places
 * pick it up automatically since they both just read CONFIG.
 * -----------------------------------------------------------------------
 */

const PlantClass = Parse.Object.extend("Plant");

async function fetchRecentWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.WEATHER_LATITUDE}&longitude=${CONFIG.WEATHER_LONGITUDE}&daily=precipitation_sum,temperature_2m_max&past_days=5&forecast_days=1&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather request failed");
    const data = await res.json();
    const rain = (data.daily.precipitation_sum || []).reduce((sum, v) => sum + (v || 0), 0);
    const temps = data.daily.temperature_2m_max || [];
    const avgTemp = temps.length ? temps.reduce((sum, v) => sum + (v || 0), 0) / temps.length : null;
    return { recentRainIn: rain, recentMaxTempAvgF: avgTemp };
  } catch (err) {
    console.error("Weather fetch failed", err);
    return null;
  }
}

function weatherNote(weather) {
  if (weather.recentRainIn >= CONFIG.WATER_ADJUST_RAIN_THRESHOLD_IN) return "Outdoor plants' next watering is pushed out.";
  if (weather.recentMaxTempAvgF >= CONFIG.WATER_ADJUST_HEAT_THRESHOLD_F) return "Hot and dry -- outdoor plants' next watering is pulled in.";
  return "No adjustment needed for outdoor plants right now.";
}

function computePlantSchedule(plant, weather) {
  const lastWatered = plant.get("lastWatered") ? new Date(plant.get("lastWatered")) : new Date();
  const baseDays = plant.get("baseWaterDays") || 7;
  let adjustedDays = 0;
  let note = "";

  if (plant.get("isOutdoor") && weather) {
    if (weather.recentRainIn >= CONFIG.WATER_ADJUST_RAIN_THRESHOLD_IN) {
      adjustedDays = CONFIG.WATER_ADJUST_RAIN_DAYS;
      note = `Recent rain (${weather.recentRainIn.toFixed(2)}") -- pushed out ${adjustedDays}d`;
    } else if (weather.recentMaxTempAvgF >= CONFIG.WATER_ADJUST_HEAT_THRESHOLD_F) {
      adjustedDays = -CONFIG.WATER_ADJUST_HEAT_DAYS;
      note = `Hot & dry (avg ${Math.round(weather.recentMaxTempAvgF)}°F) -- pulled in ${Math.abs(adjustedDays)}d`;
    }
  }

  const nextDue = new Date(lastWatered);
  nextDue.setDate(nextDue.getDate() + baseDays + adjustedDays);
  return { lastWatered, nextDue, adjustedDays, note };
}

function renderPlantsView(plants, weather) {
  const container = document.getElementById("plants-view-list");
  if (plants.length === 0) {
    container.innerHTML = `<p class="admin-missing-empty">No plants added yet.</p>`;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const withSchedule = plants.map((plant) => ({ plant, schedule: computePlantSchedule(plant, weather) }));
  withSchedule.sort((a, b) => a.schedule.nextDue - b.schedule.nextDue);

  container.innerHTML = withSchedule
    .map(({ plant, schedule }) => {
      const dueDate = new Date(schedule.nextDue);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
      const dueText = daysUntil < 0 ? `OVERDUE BY ${Math.abs(daysUntil)}D` : daysUntil === 0 ? "DUE TODAY" : `DUE IN ${daysUntil}D`;
      const overdueOrToday = daysUntil <= 0;
      const lastWateredText = schedule.lastWatered.toLocaleDateString();
      const indoorOutdoor = plant.get("isOutdoor") ? "Outdoor" : "Indoor";

      return `
      <div class="missing-ingredient-row">
        <div>
          <div class="missing-ingredient-row__name">${escapeHtml(plant.get("name"))} <span class="missing-ingredient-row__tag" style="${overdueOrToday ? "font-weight:700; color:var(--color-text);" : ""}">${dueText}</span></div>
          <div class="missing-ingredient-row__recipes">${escapeHtml(plant.get("location") || "")} · ${indoorOutdoor} · last watered ${escapeHtml(lastWateredText)}${schedule.note ? " · " + escapeHtml(schedule.note) : ""}${plant.get("notes") ? " · " + escapeHtml(plant.get("notes")) : ""}</div>
        </div>
      </div>`;
    })
    .join("");
}

async function loadPlantsView() {
  const weatherEl = document.getElementById("weather-summary");
  weatherEl.textContent = "Checking recent weather…";

  try {
    const [plants, weather] = await Promise.all([new Parse.Query(PlantClass).ascending("name").limit(200).find(), fetchRecentWeather()]);

    if (weather) {
      weatherEl.textContent = `Last few days near you: ${weather.recentRainIn.toFixed(2)}" rain, ${Math.round(weather.recentMaxTempAvgF)}°F avg high. ${weatherNote(weather)}`;
    } else {
      weatherEl.textContent = "Couldn't reach the weather service — outdoor plants are showing their un-adjusted schedule.";
    }

    renderPlantsView(plants, weather);
  } catch (err) {
    console.error(err);
    document.getElementById("plants-view-list").innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load plants.</p></div>`;
  }
}

document.addEventListener("DOMContentLoaded", loadPlantsView);
