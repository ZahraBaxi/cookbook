/**
 * mealprep.js
 * -----------------------------------------------------------------------
 * Weekly meal prep. Anyone can see the plan (read through the mealPrepFind
 * Cloud Function). Adding, editing, ticking meals off, and the weekly reset need the
 * admin session (sign in on admin.html in the same tab first).
 *
 * Each entry = one thing prepped (optionally tied to a Recipe) on a
 * prep day, plus the easy meals it makes: [{ name, when, done }].
 * Two entries on different days cover "half Saturday, half Sunday".
 * -----------------------------------------------------------------------
 */

const RecipeClassForPrep = Parse.Object.extend("Recipe");

const PREP_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const MEAL_TIMES = ["Breakfast", "Lunch", "Dinner", "Snack", "Any"];

let prepEntries = [];
let prepRecipes = [];
let editingPrepId = null;

function canEditPrep() {
  return isAdminLoggedIn();
}

async function loadMealPrep() {
  try {
    const [entries, recipes] = await Promise.all([
      Parse.Cloud.run("mealPrepFind"),
      new Parse.Query(RecipeClassForPrep).ascending("title").limit(1000).find(),
    ]);
    prepEntries = entries.map(toPrepEntry);
    prepRecipes = recipes;
    renderMealPrep();
  } catch (err) {
    console.error(err);
    document.getElementById("mealprep-ready").innerHTML = `<div class="empty-state"><p class="empty-state__title">Couldn't load meal prep.</p><p>${escapeHtml((err && err.message) || "")}${/invalid function/i.test((err && err.message) || "") ? ". The latest Cloud Code is not deployed yet. Deploy the newest main.js in Back4App, then reload." : ""}</p></div>`;
  }
}

// Entries come back as plain JSON; wrap them so the rest of the page can
// keep using entry.get("field") and entry.id.
function toPrepEntry(json) {
  return { id: json.objectId, get: (k) => json[k], set: (k, v) => { json[k] = v; } };
}

// Shows what actually went wrong, and signs you out if the session ended.
function prepError(err, fallback) {
  if (err && err.code === Parse.Error.INVALID_SESSION_TOKEN) {
    clearAdminSession();
    renderMealPrep();
    showToast("Your sign-in ended. Sign in on Admin again.", "error");
    return;
  }
  showToast(fallback + ((err && err.message) ? " (" + err.message + ")" : ""), "error");
}

function prepMeals(entry) {
  return Array.isArray(entry.get("meals")) ? entry.get("meals") : [];
}

function renderMealPrep() {
  const edit = canEditPrep();
  document.getElementById("mealprep-toolbar").hidden = !edit;
  document.getElementById("mealprep-signin").hidden = edit;
  renderReadyMeals(edit);
  renderPrepPlan(edit);
}

/* Easy meals you can make right now, grouped by meal of the day. */
function renderReadyMeals(edit) {
  const el = document.getElementById("mealprep-ready");
  const all = [];
  prepEntries.forEach((entry) => {
    prepMeals(entry).forEach((meal, index) => all.push({ entry, meal, index }));
  });

  if (all.length === 0) {
    el.innerHTML = `<p class="admin-missing-empty">Nothing prepped yet this week.</p>`;
    return;
  }

  const groups = MEAL_TIMES.map((when) => ({ when, items: all.filter((m) => (m.meal.when || "Any") === when) })).filter((g) => g.items.length);
  el.innerHTML = groups
    .map((g) => {
      const sorted = [...g.items].sort((a, b) => Number(!!a.meal.done) - Number(!!b.meal.done));
      const left = g.items.filter((m) => !m.meal.done).length;
      const rows = sorted
        .map(
          (m) => `
        <div class="missing-ingredient-row">
          <label class="checkbox-field" style="flex:1 1 200px;">
            <input type="checkbox" data-prep-meal="${m.entry.id}:${m.index}" ${m.meal.done ? "checked" : ""} ${edit ? "" : "disabled"} />
            <span style="${m.meal.done ? "text-decoration:line-through; opacity:0.5;" : ""}">${escapeHtml(m.meal.name || "")}</span>
          </label>
          <div class="missing-ingredient-row__recipes">from ${escapeHtml(m.entry.get("title") || "")}</div>
        </div>`
        )
        .join("");
      return `<div class="admin-missing-section"><div class="admin-missing-section__title">${escapeHtml(g.when.toUpperCase())} (${left} left)</div>${rows}</div>`;
    })
    .join("");

  el.querySelectorAll("[data-prep-meal]").forEach((box) => {
    box.addEventListener("change", () => {
      const [id, idx] = box.getAttribute("data-prep-meal").split(":");
      toggleMealDone(id, Number(idx), box.checked);
    });
  });
}

/* The prep plan itself, grouped by the day it gets made. */
function renderPrepPlan(edit) {
  const el = document.getElementById("mealprep-plan");
  if (prepEntries.length === 0) {
    el.innerHTML = "";
    return;
  }
  const days = [...PREP_DAYS, ""];
  const sections = days
    .map((day) => ({ day, entries: prepEntries.filter((e) => (e.get("prepDay") || "") === day) }))
    .filter((s) => s.entries.length);

  el.innerHTML =
    `<h2 style="margin:2rem 0 1rem;">PREP PLAN</h2>` +
    sections
      .map((s) => {
        const rows = s.entries
          .map((e) => {
            const meals = prepMeals(e).map((m) => escapeHtml(m.name || "")).join(", ");
            return `
          <div class="missing-ingredient-row">
            <div>
              <div class="missing-ingredient-row__name">${escapeHtml(e.get("title") || "")}</div>
              ${meals ? `<div class="missing-ingredient-row__recipes">Makes: ${meals}</div>` : ""}
              ${e.get("notes") ? `<div class="missing-ingredient-row__recipes">${escapeHtml(e.get("notes"))}</div>` : ""}
            </div>
            ${edit ? `<button type="button" class="btn btn--ghost btn--small" data-prep-edit="${e.id}">EDIT</button>` : ""}
          </div>`;
          })
          .join("");
        return `<div class="admin-missing-section"><div class="admin-missing-section__title">${escapeHtml((s.day || "No day set").toUpperCase())}</div>${rows}</div>`;
      })
      .join("");

  el.querySelectorAll("[data-prep-edit]").forEach((btn) => btn.addEventListener("click", () => openPrepModal(btn.getAttribute("data-prep-edit"))));
}

async function toggleMealDone(id, index, done) {
  const entry = prepEntries.find((e) => e.id === id);
  if (!entry) return;
  const meals = prepMeals(entry).map((m) => ({ ...m }));
  if (!meals[index]) return;
  meals[index].done = done;
  try {
    await runAdminCloud("adminSaveMealPrepEntry", { id, meals });
    entry.set("meals", meals);
  } catch (err) {
    console.error(err);
    prepError(err, "Couldn't save that.");
  }
  renderMealPrep();
}

/* ---------------------------------------------------------------------
 * Add / edit modal
 * ------------------------------------------------------------------- */

function mealRowHtml(meal) {
  const opts = MEAL_TIMES.map((t) => `<option value="${t}" ${(meal.when || "Lunch") === t ? "selected" : ""}>${t}</option>`).join("");
  return `
    <div class="mealprep-meal-row" style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">
      <input type="text" class="mealprep-meal-name" placeholder="Quesadillas" value="${escapeHtml(meal.name || "")}" style="flex:1;" />
      <select class="mealprep-meal-when" style="width:auto;">${opts}</select>
      <input type="hidden" class="mealprep-meal-done" value="${meal.done ? "1" : ""}" />
      <button type="button" class="btn btn--ghost btn--small mealprep-meal-remove" aria-label="Remove meal"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
}

function addMealRow(meal) {
  const wrap = document.getElementById("mealprep-meals");
  wrap.insertAdjacentHTML("beforeend", mealRowHtml(meal || {}));
  const row = wrap.lastElementChild;
  row.querySelector(".mealprep-meal-remove").addEventListener("click", () => row.remove());
}

function openPrepModal(id) {
  editingPrepId = id || null;
  const entry = id ? prepEntries.find((e) => e.id === id) : null;
  document.getElementById("mealprep-modal-title").textContent = entry ? "Edit prep" : "Add prep";

  const recipeSel = document.getElementById("mealprep-recipe");
  recipeSel.innerHTML =
    `<option value="">Something else (type below)</option>` +
    prepRecipes.map((r) => `<option value="${r.id}" ${entry && entry.get("recipeId") === r.id ? "selected" : ""}>${escapeHtml(r.get("title") || "")}</option>`).join("");

  document.getElementById("mealprep-title").value = entry ? entry.get("title") || "" : "";
  document.getElementById("mealprep-day").innerHTML =
    `<option value="">No day set</option>` + PREP_DAYS.map((d) => `<option value="${d}" ${entry && entry.get("prepDay") === d ? "selected" : ""}>${d}</option>`).join("");
  document.getElementById("mealprep-notes").value = entry ? entry.get("notes") || "" : "";
  document.getElementById("mealprep-meals").innerHTML = "";
  const meals = entry ? prepMeals(entry) : [];
  (meals.length ? meals : [{}]).forEach((m) => addMealRow(m));
  document.getElementById("mealprep-delete-btn").hidden = !entry;
  openModal(document.getElementById("mealprep-modal-overlay"));
}

async function handlePrepSubmit(e) {
  e.preventDefault();
  const title = document.getElementById("mealprep-title").value.trim();
  if (!title) {
    showToast("Add what you prepped.", "error");
    return;
  }
  const meals = Array.from(document.querySelectorAll(".mealprep-meal-row"))
    .map((row) => ({
      name: row.querySelector(".mealprep-meal-name").value.trim(),
      when: row.querySelector(".mealprep-meal-when").value,
      done: !!row.querySelector(".mealprep-meal-done").value,
    }))
    .filter((m) => m.name);

  try {
    await runAdminCloud("adminSaveMealPrepEntry", {
      id: editingPrepId,
      title,
      recipeId: document.getElementById("mealprep-recipe").value,
      prepDay: document.getElementById("mealprep-day").value,
      notes: document.getElementById("mealprep-notes").value.trim(),
      meals,
    });
    closeModal(document.getElementById("mealprep-modal-overlay"));
    showToast("Saved.");
    await loadMealPrep();
  } catch (err) {
    console.error(err);
    prepError(err, "Couldn't save.");
  }
}

async function handlePrepDelete() {
  if (!editingPrepId) return;
  try {
    await runAdminCloud("adminDeleteMealPrepEntry", { id: editingPrepId });
    closeModal(document.getElementById("mealprep-modal-overlay"));
    await loadMealPrep();
  } catch (err) {
    console.error(err);
    prepError(err, "Couldn't delete that.");
  }
}

async function handlePrepReset() {
  try {
    await runAdminCloud("adminResetMealPrep");
    closeModal(document.getElementById("mealprep-confirm-overlay"));
    showToast("Week reset.");
    await loadMealPrep();
  } catch (err) {
    console.error(err);
    prepError(err, "Couldn't reset the week.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const byId = (id) => document.getElementById(id);
  byId("mealprep-add-btn").addEventListener("click", () => openPrepModal(null));
  byId("mealprep-add-meal-btn").addEventListener("click", () => addMealRow({}));
  byId("mealprep-form").addEventListener("submit", handlePrepSubmit);
  byId("mealprep-delete-btn").addEventListener("click", handlePrepDelete);
  byId("mealprep-modal-close").addEventListener("click", () => closeModal(byId("mealprep-modal-overlay")));
  byId("mealprep-cancel-btn").addEventListener("click", () => closeModal(byId("mealprep-modal-overlay")));
  byId("mealprep-reset-btn").addEventListener("click", () => openModal(byId("mealprep-confirm-overlay")));
  byId("mealprep-confirm-btn").addEventListener("click", handlePrepReset);
  byId("mealprep-confirm-close").addEventListener("click", () => closeModal(byId("mealprep-confirm-overlay")));
  byId("mealprep-confirm-cancel-btn").addEventListener("click", () => closeModal(byId("mealprep-confirm-overlay")));
  // Picking a recipe fills in the title if it is still empty.
  byId("mealprep-recipe").addEventListener("change", (e) => {
    const rec = prepRecipes.find((r) => r.id === e.target.value);
    const titleEl = byId("mealprep-title");
    if (rec && !titleEl.value.trim()) titleEl.value = rec.get("title") || "";
  });
  loadMealPrep();
});
