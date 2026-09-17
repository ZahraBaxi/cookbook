/**
 * parse.js
 * -----------------------------------------------------------------------
 * Initializes the Parse JS SDK using CONFIG. Every other module assumes
 * Parse is already initialized once this file has loaded.
 * -----------------------------------------------------------------------
 */

Parse.initialize(CONFIG.PARSE_APP_ID, CONFIG.PARSE_JS_KEY);
Parse.serverURL = CONFIG.PARSE_SERVER_URL;

/**
 * Attaches the current admin session token (if any) as a header on
 * every Cloud Function call that needs it. The Cloud Functions are
 * responsible for validating this token server-side — the frontend
 * sending it is a convenience, not a security boundary by itself.
 */
function getAdminToken() {
  return sessionStorage.getItem(CONFIG.ADMIN_TOKEN_KEY) || null;
}

function isAdminLoggedIn() {
  return !!getAdminToken();
}

function setAdminSession(token, username) {
  sessionStorage.setItem(CONFIG.ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(CONFIG.ADMIN_USER_KEY, username);
}

function clearAdminSession() {
  sessionStorage.removeItem(CONFIG.ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(CONFIG.ADMIN_USER_KEY);
}

/**
 * Runs a Cloud Function, automatically including the admin token as a
 * parameter so server-side code can validate the session.
 */
async function runAdminCloud(name, params = {}) {
  const token = getAdminToken();
  return Parse.Cloud.run(name, { ...params, adminToken: token });
}

/**
 * Same idea as the admin session helpers above, but for the grocery
 * list's 4-digit PIN gate — a much lighter-weight, low-stakes check
 * meant to keep casual visitors out, not withstand a determined
 * attacker (same spirit as the housewarming site's shared password).
 * Uses localStorage rather than sessionStorage so it survives closing
 * the browser/app on a phone at the store.
 */
function getGroceryToken() {
  return localStorage.getItem(CONFIG.GROCERY_TOKEN_KEY) || null;
}

function isGroceryUnlocked() {
  return !!getGroceryToken();
}

function setGrocerySession(token) {
  localStorage.setItem(CONFIG.GROCERY_TOKEN_KEY, token);
}

function clearGrocerySession() {
  localStorage.removeItem(CONFIG.GROCERY_TOKEN_KEY);
}

async function runGroceryCloud(name, params = {}) {
  const token = getGroceryToken();
  return Parse.Cloud.run(name, { ...params, groceryToken: token });
}
