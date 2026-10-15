/**
 * back4app-client.js
 * -----------------------------------------------------------------------
 * Data layer for the Today / Practice / Growth pages. Everything goes
 * through the site's Cloud Functions (adminMonkFind,
 * adminMonkCreate, adminMonkUpdate, adminMonkDelete), so the one site
 * login covers it and the Monk* classes can stay private.
 *
 * Needs config.js and parse.js loaded first (for CONFIG and the admin
 * session helpers). Calls are plain REST so rows come back exactly as
 * stored (dates and files stay plain JSON).
 * -----------------------------------------------------------------------
 */

async function monkCloud(name, params) {
  var res = await fetch(CONFIG.PARSE_SERVER_URL.replace(/\/$/, '') + '/functions/' + name, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Parse-Application-Id': CONFIG.PARSE_APP_ID,
      'X-Parse-Javascript-Key': CONFIG.PARSE_JS_KEY
    },
    body: JSON.stringify(Object.assign({}, params, { adminToken: getAdminToken() }))
  });
  var data = await res.json();
  if (!res.ok) {
    // Only a truly expired or invalid sign-in (Parse code 209) signs you out.
    // Any other problem (like a function that is not deployed yet) must not.
    if (data.code === 209) {
      clearAdminSession();
      location.reload();
    }
    throw new Error(data.error || ('could not run ' + name));
  }
  return data.result;
}

// Anyone can view; editing needs the site sign-in.
function monkRequireEdit() {
  if (isAdminLoggedIn()) return true;
  if (typeof showToast === 'function') showToast('Sign in on Admin to edit.', 'error');
  return false;
}

/* ---------------- file upload (photos, sketches) ---------------- */

async function b4aUploadFile(filename, dataUrl) {
  var match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) throw new Error('Not a valid image');
  var binary = atob(match[2]);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  var res = await fetch(CONFIG.PARSE_SERVER_URL.replace(/\/$/, '') + '/files/' + encodeURIComponent(filename), {
    method: 'POST',
    headers: {
      'Content-Type': match[1],
      'X-Parse-Application-Id': CONFIG.PARSE_APP_ID,
      'X-Parse-Javascript-Key': CONFIG.PARSE_JS_KEY
    },
    body: bytes
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not upload that image');
  return data; // { name, url }
}

/* ---------------- generic class CRUD ---------------- */

function fetchClass(className, order) {
  // The journal is private: nothing is requested unless signed in.
  if (className === 'MonkJournalEntry' && !isAdminLoggedIn()) return Promise.resolve([]);
  return monkCloud('monkFind', { className: className, order: order || '' });
}

function createInClass(className, fields) {
  if (!monkRequireEdit()) return Promise.reject(new Error('Sign in to edit.'));
  return monkCloud('adminMonkCreate', { className: className, fields: fields });
}

function updateInClass(className, objectId, fields) {
  if (!monkRequireEdit()) return Promise.reject(new Error('Sign in to edit.'));
  return monkCloud('adminMonkUpdate', { className: className, objectId: objectId, fields: fields });
}

function deleteInClass(className, objectId) {
  if (!monkRequireEdit()) return Promise.reject(new Error('Sign in to edit.'));
  return monkCloud('adminMonkDelete', { className: className, objectId: objectId }).then(function () { return true; });
}
