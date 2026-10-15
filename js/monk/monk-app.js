/* ============================================================
   monk-app.js
   "Urban Monk Rule", navigation + interactions.

   Storage: uses this project's own js/back4app-client.js
   (its own Back4App app, entirely separate from any other
   project) via the generic fetchClass / createInClass /
   updateInClass helpers, against these classes:

     MonkDay, one row per date: checklist state
     MonkPlaceNote, observation notes
     MonkJournalEntry, journal entries
     MonkActivity, every other logged practice (craft,
                           joy, solitude, stewardship, learning,
                           presence, attention taps, random
                           practice, vow, sourdough recipes tried,
                           watchlist items watched, plant stage
                           advances)
     MonkSourdoughFeeding, starter feeding log
     MonkWatchlistItem, watchlist: title, note, watched
     MonkBook, reading list: title, author, status
     MonkBookNote, annotations against a book: quote,
                           note, page
     MonkDharmaEntry, contemplation journal: date, prompt, note

   MonkDay also carries a third checklist field, preceptItems,
   for the Dharma chapter's daily precept reflections, same
   shape as morningItems/eveningItems.


   If Back4App is unreachable (offline, keys not filled in
   yet), everything still works against an in-memory cache for
   the session, it just won't persist across reloads.
   ============================================================ */

(function () {
  "use strict";

  // Each page only holds some of the chapters, so a lookup for an element
  // that lives on another page gets a throwaway stand-in instead of null.
  function standIn() {
    var el = document.createElement('select');
    el.getContext = function () { return null; };
    return el;
  }
  var _stand = {};
  function $id(id) {
    return document.getElementById(id) || _stand[id] || (_stand[id] = standIn());
  }
  function $q(sel) {
    return document.querySelector(sel) || standIn();
  }

  var todayStr = dateStr(new Date());

  // All data goes through the site's admin-gated Cloud Functions, so the
  // one site login covers every page.
  function userFetchClass(className, order) {
    return fetchClass(className, order);
  }
  function userCreateInClass(className, fields) {
    return createInClass(className, fields);
  }

  var cache = {
    days: {},          // date -> {objectId, date, morningItems, eveningItems}
    placeNotes: [],
    journalEntries: [],
    activities: [],
    sourdoughLog: [],
    watchlist: [],
    books: [],
    bookNotes: [],
    dharmaEntries: [],
    learningNodes: [],
    events: [],
    todos: [],
    rhythmItems: { morning: [], evening: [] },
    bookmarks: [],
    kanbanCards: [],
    stitchTypes: [],
    giveaways: []
  };

  /* ---------------- date helpers ---------------- */

  function dateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function addDays(d, n) {
    var copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }
  function daysAgo(n) { return dateStr(addDays(new Date(), -n)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // stable "random" pick for the day, so home doesn't reshuffle on every reload
  function seededPick(arr, seedStr) {
    var seed = 0;
    for (var i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    return arr[seed % arr.length];
  }

  // Shuffle bag: draws every item from a list in random order before
  // any item repeats, then reshuffles and starts a new pass. Used
  // anywhere a "give me another one" button exists, so cycling
  // through prompts doesn't feel repetitive within a session.
  function makeBag(list) {
    var bag = [];
    function refill() {
      bag = list.slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
      }
    }
    return function next() {
      if (!bag.length) refill();
      return bag.pop();
    };
  }

  function flattenCraft() {
    var pool = [];
    Object.keys(MONK.craft).forEach(function (cat) {
      MONK.craft[cat].forEach(function (item) { pool.push({ cat: cat, item: item }); });
    });
    return pool;
  }

  // One bag per pool of prompts/practices. Learning is keyed per
  // category since the pool depends on which category is selected.
  var bags = {
    quote: makeBag(MONK.quotes),
    worldQuestion: makeBag(MONK.worldQuestions),
    place: makeBag(MONK.placePrompts),
    presence: makeBag(MONK.presencePrompts),
    solitude: makeBag(MONK.solitudePractices),
    humility: makeBag(MONK.humilityPrompts),
    stewardship: makeBag(MONK.stewardshipActs),
    joy: makeBag(MONK.joys),
    craft: makeBag(flattenCraft()),
    rhythmTask: makeBag(MONK.rhythm.morning.concat(MONK.rhythm.evening)),
    gatha: makeBag(MONK.gathas),
    dharma: makeBag(MONK.dharmaPrompts)
  };
  var learningBags = {};
  function learningBag(cat) {
    if (!learningBags[cat]) learningBags[cat] = makeBag(MONK.learning[cat]);
    return learningBags[cat];
  }

  /* ---------------- navigation ---------------- */

  var sections = Array.prototype.slice.call(document.querySelectorAll('.monk-section'));
  var tabsEl = $id('monk-tabs');

  // Which page each chapter lives on, so a link to a chapter on another
  // page just opens that page.
  var SECTION_PAGE = {
    'sec-home': 'today.html', 'sec-calendar': 'today.html', 'sec-work': 'today.html',
    'sec-journal': 'today.html', 'sec-progress': 'today.html',
    'sec-dharma': 'practice.html', 'sec-movement': 'practice.html', 'sec-place': 'practice.html',
    'sec-presence': 'practice.html', 'sec-attention': 'practice.html', 'sec-joy': 'practice.html',
    'sec-stewardship': 'practice.html',
    'sec-learning': 'growth.html', 'sec-reading': 'growth.html', 'sec-craft': 'growth.html',
    'sec-sourdough': 'growth.html', 'sec-tea': 'growth.html', 'sec-watchlist': 'growth.html'
  };
  var pageLabel = (window.MONK_PAGE && window.MONK_PAGE.label) || '';

  sections.forEach(function (sec) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = sec.getAttribute('data-title');
    btn.setAttribute('data-target', sec.id);
    tabsEl.appendChild(btn);
    var eyebrow = sec.querySelector('.chapter-eyebrow-num');
    if (eyebrow) eyebrow.textContent = pageLabel;
  });

  function showSection(id) {
    if (!document.getElementById(id)) {
      location.href = (SECTION_PAGE[id] || 'today.html') + '#' + id;
      return;
    }
    sections.forEach(function (sec) { sec.classList.toggle('active', sec.id === id); });
    Array.prototype.forEach.call(tabsEl.querySelectorAll('button[data-target]'), function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-target') === id);
    });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    window.scrollTo(0, 0);
  }

  tabsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-target]');
    if (btn) showSection(btn.getAttribute('data-target'));
  });

  /* ---------------- persistence helpers ---------------- */

  function logActivity(category, label) {
    var entry = { date: todayStr, category: category, label: label || '' };
    cache.activities.push(entry);
    renderProgress();
    userCreateInClass('MonkActivity', entry).then(function (res) {
      entry.objectId = res.objectId;
    }).catch(function (err) { console.warn('MonkActivity save failed:', err.message); });
  }

  function saveDay(field, items) {
    var existing = cache.days[todayStr];
    var fields = {};
    fields[field] = items;
    if (existing && existing.objectId) {
      updateInClass('MonkDay', existing.objectId, fields).catch(function (err) {
        console.warn('MonkDay update failed:', err.message);
      });
    } else {
      var payload = { date: todayStr, morningItems: [], eveningItems: [], preceptItems: [] };
      payload[field] = items;
      userCreateInClass('MonkDay', payload).then(function (res) {
        cache.days[todayStr] = Object.assign({ objectId: res.objectId }, payload);
      }).catch(function (err) { console.warn('MonkDay create failed:', err.message); });
    }
  }

  /* ---------------- HOME ---------------- */

  // Picked once per load (seeded so a reload same-day shows the same
  // vow/quote); both can still be cycled by hand via their buttons.
  var currentQuote = seededPick(MONK.quotes, todayStr + 'q');
  var currentVowText = seededPick(MONK.vows, todayStr + 'v');
  var currentWorldQuestion = seededPick(MONK.worldQuestions, todayStr + 'w');

  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return 'Still up.';
    if (h < 12) return 'Good morning.';
    if (h < 17) return 'Good afternoon.';
    if (h < 21) return 'Good evening.';
    return 'Winding down.';
  }

  function renderHome() {
    $id('home-greeting').textContent = greeting();
    $id('home-date').textContent =
      new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    $id('home-quote').textContent = '"' + currentQuote + '"';
    $id('home-vow').textContent = currentVowText;
    $id('home-question').textContent = currentWorldQuestion;
    $id('home-morning-reminder').textContent = MONK.morningReminder;
    $id('home-evening-reminder').textContent = MONK.eveningReminder;
    $id('home-dharma-reminder').textContent = MONK.dharmaReminder;
    renderHomeTodos();
    refreshHomeDynamic();
  }

  // Just the parts that change as the day goes on, safe to call
  // repeatedly (e.g. after a checklist toggle elsewhere) without
  // resetting the quote or re-attaching any listeners.
  function refreshHomeDynamic() {
    var streak = computeStreak();
    $id('home-streak').textContent = streak + ' day' + (streak === 1 ? '' : 's');
    renderStreakDots();
    renderVowState();
  }

  function renderStreakDots() {
    var set = activeDateSet();
    var html = '';
    for (var i = 6; i >= 0; i--) {
      var d = daysAgo(i);
      var cls = 'monk-streak-dot' + (set[d] ? ' filled' : '') + (i === 0 ? ' today' : '');
      html += '<span class="' + cls + '" title="' + d + '"></span>';
    }
    $id('home-streak-dots').innerHTML = html;
  }

  function vowKeptToday() {
    return cache.activities.some(function (a) { return a.category === 'vow' && a.date === todayStr; });
  }

  function renderVowState() {
    var card = $id('home-vow-card');
    var btn = $id('home-vow-btn');
    if (vowKeptToday()) {
      card.classList.add('kept');
      btn.textContent = 'Kept Today';
      btn.disabled = true;
    } else {
      card.classList.remove('kept');
      btn.textContent = 'Mark as Kept';
      btn.disabled = false;
    }
  }

  function renderHomeTodos() {
    var ul = $id('home-todo-list');
    ul.innerHTML = '';
    if (!cache.todos.length) {
      ul.innerHTML = '<li class="monk-empty" style="border:none">Nothing on the list.</li>';
      return;
    }
    cache.todos.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'row';
      li.innerHTML =
        '<label><input type="checkbox"' + (t.done ? ' checked' : '') + '><span></span></label>' +
        '<button class="monk-quiet-link">Remove</button>';
      li.querySelector('span').textContent = t.text;

      li.querySelector('input').addEventListener('change', function (e) {
        t.done = e.target.checked;
        renderHomeTodos();
        if (t.objectId) updateInClass('MonkTodo', t.objectId, { done: t.done }).catch(function (err) { console.warn('MonkTodo update failed:', err.message); });
      });
      li.querySelector('.monk-quiet-link').addEventListener('click', function () {
        var hadId = t.objectId;
        cache.todos = cache.todos.filter(function (x) { return x !== t; });
        renderHomeTodos();
        if (hadId) deleteInClass('MonkTodo', hadId).catch(function (err) { console.warn('MonkTodo delete failed:', err.message); });
      });
      ul.appendChild(li);
    });
  }

  function wireHomeTodoInteractions() {
    function addTodo() {
      var input = $id('home-todo-input');
      var text = input.value.trim();
      if (!text) return;
      var entry = { text: text, done: false };
      cache.todos.push(entry);
      input.value = '';
      renderHomeTodos();
      userCreateInClass('MonkTodo', entry).then(function (res) { entry.objectId = res.objectId; })
        .catch(function (err) { console.warn('MonkTodo save failed:', err.message); });
    }
    $id('home-todo-add').addEventListener('click', addTodo);
    $id('home-todo-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') addTodo();
    });
  }

  // Wired exactly once from renderAll(), never re-attached on
  // later renderHome() calls, so a click can never double-fire.
  function wireHomeInteractions() {
    $id('home-vow-btn').addEventListener('click', function () {
      if (vowKeptToday()) return;
      logActivity('vow', currentVowText);
      refreshHomeDynamic();
    });
    $id('home-quote-new').addEventListener('click', function () {
      currentQuote = bags.quote();
      $id('home-quote').textContent = '"' + currentQuote + '"';
    });
    $id('home-morning-reminder-btn').addEventListener('click', function () {
      $id('home-rhythm-block').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $id('home-evening-reminder-btn').addEventListener('click', function () {
      $id('home-rhythm-block').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $id('home-dharma-reminder-btn').addEventListener('click', function () { showSection('sec-dharma'); });

    // World Question: the actual reason to open this page. Cyclable,
    // and answerable inline, a reply saves straight into the Journal
    // tagged with the question, so reflection and journaling are one
    // motion instead of two.
    $id('home-question-new').addEventListener('click', function () {
      currentWorldQuestion = bags.worldQuestion();
      $id('home-question').textContent = currentWorldQuestion;
      $id('home-question-answer').value = '';
    });
    $id('home-question-reveal').addEventListener('click', function () {
      var wrap = $id('home-question-reflect');
      var open = wrap.style.display !== 'none';
      wrap.style.display = open ? 'none' : 'block';
      this.textContent = open ? 'Reflect on This' : 'Never mind';
      if (!open) $id('home-question-answer').focus();
    });
    withConfirmation($id('home-question-save'), function () {
      var textarea = $id('home-question-answer');
      var text = textarea.value.trim();
      if (!text) return;
      var entry = { date: todayStr, text: 'Q: ' + currentWorldQuestion + '\n' + text };
      cache.journalEntries.push(entry);
      textarea.value = '';
      $id('home-question-reflect').style.display = 'none';
      $id('home-question-reveal').textContent = 'Reflect on This';
      renderJournalEntries();
      renderHome();
      renderProgress();
      userCreateInClass('MonkJournalEntry', entry).catch(function (err) { console.warn('MonkJournalEntry save failed:', err.message); });
    }, 'Saved \u2713');
  }

  function activeDateSet() {
    var set = {};
    Object.keys(cache.days).forEach(function (d) {
      var day = cache.days[d];
      if ((day.morningItems && day.morningItems.length) || (day.eveningItems && day.eveningItems.length) || (day.preceptItems && day.preceptItems.length)) set[d] = true;
    });
    cache.placeNotes.forEach(function (n) { set[n.date] = true; });
    cache.journalEntries.forEach(function (j) { set[j.date] = true; });
    cache.activities.forEach(function (a) { set[a.date] = true; });
    cache.dharmaEntries.forEach(function (n) { set[n.date] = true; });
    return set;
  }

  function computeStreak() {
    var set = activeDateSet();
    var cursor = new Date();
    if (!set[dateStr(cursor)]) cursor = addDays(cursor, -1);
    var streak = 0;
    while (set[dateStr(cursor)]) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  /* ---------------- RHYTHM ---------------- */

  // First time ever (no MonkRhythmItem rows saved yet), carry the
  // built-in default list over as the user's own editable starting
  // point, instead of leaving the checklist empty.
  function seedRhythmItems() {
    ['morning', 'evening'].forEach(function (period) {
      MONK.rhythm[period].forEach(function (item, i) {
        var entry = { period: period, label: item.label, order: i };
        cache.rhythmItems[period].push(entry);
        (isAdminLoggedIn() ? userCreateInClass('MonkRhythmItem', entry) : Promise.resolve({})).then(function (res) { entry.objectId = res.objectId; })
          .catch(function (err) { console.warn('MonkRhythmItem seed failed:', err.message); });
      });
    });
  }

  var rhythmDrag = null; // {period, index} while a pointer-drag is reordering the list

  function renderRhythm() {
    var day = cache.days[todayStr] || { morningItems: [], eveningItems: [] };
    renderRhythmList('rhythm-morning', 'morning', day.morningItems || []);
    renderRhythmList('rhythm-evening', 'evening', day.eveningItems || []);
  }

  function renderRhythmList(ulId, period, checkedIds) {
    var ul = $id(ulId);
    ul.innerHTML = '';
    cache.rhythmItems[period].forEach(function (item, idx) {
      var li = document.createElement('li');
      li.className = 'row monk-rhythm-item' + (rhythmDrag && rhythmDrag.period === period && rhythmDrag.index === idx ? ' dragging' : '');
      var checked = checkedIds.indexOf(item.objectId) !== -1;
      li.innerHTML =
        '<span class="monk-drag-handle">\u22ee\u22ee</span>' +
        '<label><input type="checkbox"' + (checked ? ' checked' : '') + '><span></span></label>' +
        '<button class="monk-quiet-link">Remove</button>';
      li.querySelector('label span').textContent = item.label;

      li.querySelector('input').addEventListener('change', function (e) {
        var field = period === 'morning' ? 'morningItems' : 'eveningItems';
        var day = cache.days[todayStr] || { date: todayStr, morningItems: [], eveningItems: [] };
        var list = day[field] || [];
        if (e.target.checked) { if (list.indexOf(item.objectId) === -1) list.push(item.objectId); }
        else { list = list.filter(function (x) { return x !== item.objectId; }); }
        day[field] = list;
        cache.days[todayStr] = day;
        saveDay(field, list);
        renderHome();
        renderProgress();
      });
      li.querySelector('.monk-quiet-link').addEventListener('click', function () {
        cache.rhythmItems[period] = cache.rhythmItems[period].filter(function (x) { return x !== item; });
        renderRhythm();
        if (item.objectId) deleteInClass('MonkRhythmItem', item.objectId).catch(function (err) { console.warn('MonkRhythmItem delete failed:', err.message); });
      });
      li.querySelector('.monk-drag-handle').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        rhythmDrag = { period: period, index: idx };
        document.addEventListener('pointermove', onRhythmDragMove);
        document.addEventListener('pointerup', onRhythmDragEnd);
        renderRhythm();
      });
      ul.appendChild(li);
    });
  }

  // Listens on document, not the handle itself, since every swap
  // re-renders the list (same reasoning as the Learning web's drag:
  // a per-element listener would be destroyed mid-drag by its own
  // re-render).
  function onRhythmDragMove(e) {
    if (!rhythmDrag) return;
    var ul = $id(rhythmDrag.period === 'morning' ? 'rhythm-morning' : 'rhythm-evening');
    var rows = Array.prototype.slice.call(ul.querySelectorAll('.monk-rhythm-item'));
    var from = rhythmDrag.index;
    for (var i = 0; i < rows.length; i++) {
      if (i === from) continue;
      var rect = rows[i].getBoundingClientRect();
      var mid = rect.top + rect.height / 2;
      if ((i < from && e.clientY < mid) || (i > from && e.clientY > mid)) {
        var arr = cache.rhythmItems[rhythmDrag.period];
        arr.splice(i, 0, arr.splice(from, 1)[0]);
        rhythmDrag.index = i;
        renderRhythm();
        return;
      }
    }
  }

  function onRhythmDragEnd() {
    document.removeEventListener('pointermove', onRhythmDragMove);
    document.removeEventListener('pointerup', onRhythmDragEnd);
    if (!rhythmDrag) return;
    var period = rhythmDrag.period;
    rhythmDrag = null;
    cache.rhythmItems[period].forEach(function (item, i) {
      item.order = i;
      if (item.objectId) updateInClass('MonkRhythmItem', item.objectId, { order: i }).catch(function (err) { console.warn('MonkRhythmItem order save failed:', err.message); });
    });
    renderRhythm();
  }

  function wireRhythmInteractions() {
    function addItem(period, inputId) {
      var input = $id(inputId);
      var label = input.value.trim();
      if (!label) return;
      var entry = { period: period, label: label, order: cache.rhythmItems[period].length };
      cache.rhythmItems[period].push(entry);
      input.value = '';
      renderRhythm();
      (isAdminLoggedIn() ? userCreateInClass('MonkRhythmItem', entry) : Promise.resolve({})).then(function (res) { entry.objectId = res.objectId; })
        .catch(function (err) { console.warn('MonkRhythmItem create failed:', err.message); });
    }
    $id('rhythm-morning-add').addEventListener('click', function () { addItem('morning', 'rhythm-morning-input'); });
    $id('rhythm-morning-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') addItem('morning', 'rhythm-morning-input'); });
    $id('rhythm-evening-add').addEventListener('click', function () { addItem('evening', 'rhythm-evening-input'); });
    $id('rhythm-evening-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') addItem('evening', 'rhythm-evening-input'); });
  }

  function renderChecklist(ulId, items, checkedIds, field) {
    var ul = $id(ulId);
    ul.innerHTML = '';
    items.forEach(function (item) {
      var li = document.createElement('li');
      var checked = checkedIds.indexOf(item.id) !== -1;
      li.innerHTML =
        '<label><input type="checkbox" data-id="' + item.id + '"' + (checked ? ' checked' : '') + '><span>' + item.label + '</span></label>';
      ul.appendChild(li);
    });
    Array.prototype.forEach.call(ul.querySelectorAll('input[type=checkbox]'), function (cb) {
      cb.addEventListener('change', function () {
        var day = cache.days[todayStr] || { date: todayStr, morningItems: [], eveningItems: [] };
        var list = day[field] || [];
        var id = cb.getAttribute('data-id');
        if (cb.checked) {
          if (list.indexOf(id) === -1) list.push(id);
        } else {
          list = list.filter(function (x) { return x !== id; });
        }
        day[field] = list;
        cache.days[todayStr] = day;
        saveDay(field, list);
        renderHome();
        renderProgress();
      });
    });
  }

  /* ---------------- WORK ---------------- */

  var WORK_DURATIONS = [25, 50];
  var workTimerState = { duration: WORK_DURATIONS[0], remaining: 0, total: 0, intervalId: null };
  var kanbanDrag = null; // {card} while a pointer-drag is in progress

  function renderWorkDurations() {
    var row = $id('work-duration-row');
    row.innerHTML = '';
    WORK_DURATIONS.forEach(function (n) {
      var btn = document.createElement('button');
      btn.className = 'monk-tag' + (n === workTimerState.duration ? ' done' : '');
      btn.textContent = n + ' min';
      btn.addEventListener('click', function () { workTimerState.duration = n; renderWorkDurations(); });
      row.appendChild(btn);
    });
  }

  function runWorkTimerInterval() {
    clearInterval(workTimerState.intervalId);
    workTimerState.intervalId = setInterval(function () {
      workTimerState.remaining--;
      $id('work-timer-display').textContent = formatClock(workTimerState.remaining);
      if (workTimerState.remaining <= 0) endWorkTimer(true);
    }, 1000);
  }

  // Ends a session either way -- completed or cut short -- and logs
  // it as focused work, feeding the same Attention counter a manual
  // tap would.
  function endWorkTimer(completed) {
    clearInterval(workTimerState.intervalId);
    workTimerState.intervalId = null;
    var elapsedMinutes = Math.round((workTimerState.total - workTimerState.remaining) / 60);
    var label = completed ? (workTimerState.duration + ' min focus session') : (elapsedMinutes + ' of ' + workTimerState.duration + ' min focus session');
    if (completed || elapsedMinutes > 0) logActivity('attention-focused', label);
    playBell();
    $id('work-timer-active').style.display = 'none';
    $id('work-timer-setup').style.display = 'block';
    $id('work-timer-pause').textContent = 'Pause';
    renderAttention();
    renderProgress();
  }

  function kanbanCardsIn(col) {
    return cache.kanbanCards.filter(function (c) { return c.column === col; }).sort(function (a, b) { return a.order - b.order; });
  }

  function kanbanRenumber(col) {
    kanbanCardsIn(col).forEach(function (c, i) { c.order = i; });
  }

  function renderKanban() {
    ['todo', 'doing', 'done'].forEach(function (col) {
      var body = $id('kanban-body-' + col);
      body.innerHTML = '';
      kanbanCardsIn(col).forEach(function (card) {
        var div = document.createElement('div');
        div.className = 'monk-kanban-card' + (kanbanDrag && kanbanDrag.card === card ? ' dragging' : '');
        div.innerHTML =
          '<span class="monk-drag-handle">\u22ee\u22ee</span>' +
          '<span class="monk-kanban-card-text"></span>' +
          '<button class="monk-quiet-link">Remove</button>';
        div.querySelector('.monk-kanban-card-text').textContent = card.text;
        div.querySelector('.monk-quiet-link').addEventListener('click', function () {
          cache.kanbanCards = cache.kanbanCards.filter(function (x) { return x !== card; });
          kanbanRenumber(col);
          renderKanban();
          if (card.objectId) deleteInClass('MonkKanbanCard', card.objectId).catch(function (err) { console.warn('MonkKanbanCard delete failed:', err.message); });
        });
        div.querySelector('.monk-drag-handle').addEventListener('pointerdown', function (e) {
          e.preventDefault();
          kanbanDrag = { card: card };
          document.addEventListener('pointermove', onKanbanDragMove);
          document.addEventListener('pointerup', onKanbanDragEnd);
          renderKanban();
        });
        body.appendChild(div);
      });
    });
  }

  // Which column a point on screen falls over, by x-position --
  // used so a card can be dropped into a column it isn't in yet,
  // not just reordered within its own.
  function kanbanColumnAt(x) {
    var cols = ['todo', 'doing', 'done'];
    var best = cols[0], bestDist = Infinity;
    cols.forEach(function (col) {
      var rect = $id('kanban-col-' + col).getBoundingClientRect();
      if (x >= rect.left && x <= rect.right) { best = col; bestDist = 0; return; }
      var d = x < rect.left ? rect.left - x : x - rect.right;
      if (d < bestDist) { bestDist = d; best = col; }
    });
    return best;
  }

  // Listens on document rather than the drag handle, same reasoning
  // as the Learning web and Rhythm list: every move re-renders the
  // board, which would destroy a handle-scoped listener mid-drag.
  function onKanbanDragMove(e) {
    if (!kanbanDrag) return;
    var card = kanbanDrag.card;
    var hoverCol = kanbanColumnAt(e.clientX);
    var siblings = kanbanCardsIn(hoverCol).filter(function (c) { return c !== card; });
    var rows = Array.prototype.slice.call($id('kanban-body-' + hoverCol).querySelectorAll('.monk-kanban-card'));
    var insertAt = siblings.length, seen = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].classList.contains('dragging')) continue;
      var rect = rows[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) { insertAt = seen; break; }
      seen++;
    }
    var oldCol = card.column;
    card.column = hoverCol;
    siblings.splice(insertAt, 0, card);
    siblings.forEach(function (c, i) { c.order = i; });
    if (oldCol !== hoverCol) kanbanRenumber(oldCol);
    renderKanban();
  }

  function onKanbanDragEnd() {
    document.removeEventListener('pointermove', onKanbanDragMove);
    document.removeEventListener('pointerup', onKanbanDragEnd);
    if (!kanbanDrag) return;
    kanbanDrag = null;
    renderKanban();
    cache.kanbanCards.forEach(function (c) {
      if (c.objectId) updateInClass('MonkKanbanCard', c.objectId, { column: c.column, order: c.order }).catch(function (err) { console.warn('MonkKanbanCard save failed:', err.message); });
    });
  }

  function wireWorkInteractions() {
    renderWorkDurations();
    $id('work-timer-start').addEventListener('click', function () {
      workTimerState.total = workTimerState.duration * 60;
      workTimerState.remaining = workTimerState.total;
      $id('work-timer-setup').style.display = 'none';
      $id('work-timer-active').style.display = 'block';
      $id('work-timer-display').textContent = formatClock(workTimerState.remaining);
      playBell();
      runWorkTimerInterval();
    });
    $id('work-timer-pause').addEventListener('click', function (e) {
      if (workTimerState.intervalId) {
        clearInterval(workTimerState.intervalId);
        workTimerState.intervalId = null;
        e.target.textContent = 'Resume';
      } else {
        runWorkTimerInterval();
        e.target.textContent = 'Pause';
      }
    });
    $id('work-timer-end').addEventListener('click', function () { endWorkTimer(false); });

    ['todo', 'doing', 'done'].forEach(function (col) {
      $q('[data-col="' + col + '"]').addEventListener('click', function () {
        var input = $id('kanban-add-' + col);
        var text = input.value.trim();
        if (!text) return;
        var entry = { text: text, column: col, order: kanbanCardsIn(col).length };
        cache.kanbanCards.push(entry);
        input.value = '';
        renderKanban();
        userCreateInClass('MonkKanbanCard', entry).then(function (res) { entry.objectId = res.objectId; })
          .catch(function (err) { console.warn('MonkKanbanCard create failed:', err.message); });
      });
    });
  }

  /* ---------------- DHARMA ---------------- */

  var sitState = { practiceId: MONK.meditationPractices[0].id, duration: MONK.sitDefaultDuration, remaining: 0, total: 0, intervalId: null };
  var mettaIndex = 0;
  var malaCount = 0;
  var currentGatha = bags.gatha();
  var currentDharmaPrompt = bags.dharma();

  function formatClock(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function sitMinutesFromLabel(label) {
    var m = /([0-9]+)\s*min/.exec(label || '');
    return m ? parseInt(m[1], 10) : 0;
  }

  function renderSitChoices() {
    var practiceRow = $id('dharma-practice-row');
    practiceRow.innerHTML = '';
    MONK.meditationPractices.forEach(function (p) {
      var btn = document.createElement('button');
      btn.className = 'monk-tag' + (p.id === sitState.practiceId ? ' done' : '');
      btn.textContent = p.label;
      btn.title = p.note;
      btn.addEventListener('click', function () {
        sitState.practiceId = p.id;
        renderSitChoices();
      });
      practiceRow.appendChild(btn);
    });

    var durationRow = $id('dharma-duration-row');
    durationRow.innerHTML = '';
    MONK.sitDurations.forEach(function (n) {
      var btn = document.createElement('button');
      btn.className = 'monk-tag' + (n === sitState.duration ? ' done' : '');
      btn.textContent = n + ' min';
      btn.addEventListener('click', function () {
        sitState.duration = n;
        renderSitChoices();
      });
      durationRow.appendChild(btn);
    });
  }

  function renderSitStats() {
    var sits = cache.activities.filter(function (a) { return a.category === 'meditation'; });
    var totalMinutes = sits.reduce(function (sum, a) { return sum + sitMinutesFromLabel(a.label); }, 0);
    $id('dharma-sit-stats').textContent = sits.length
      ? ('You\u2019ve sat ' + sits.length + ' time' + (sits.length === 1 ? '' : 's') + ', ' + totalMinutes + ' minute' + (totalMinutes === 1 ? '' : 's') + ' total.')
      : 'No sits logged yet. Begin when you\u2019re ready.';
  }

  function endSit(completed) {
    clearInterval(sitState.intervalId);
    var elapsedSeconds = sitState.total - sitState.remaining;
    var elapsedMinutes = Math.round(elapsedSeconds / 60);
    var practice = MONK.meditationPractices.filter(function (p) { return p.id === sitState.practiceId; })[0];
    var label = completed
      ? practice.label + ', ' + sitState.duration + ' min'
      : practice.label + ', ' + elapsedMinutes + ' of ' + sitState.duration + ' min';
    if (completed || elapsedMinutes > 0) logActivity('meditation', label);
    playBell();
    $id('dharma-breath-circle').classList.remove('running');
    $id('dharma-sit-active').style.display = 'none';
    $id('dharma-sit-setup').style.display = 'block';
    renderSitStats();
    renderProgress();
  }

  function renderMetta() {
    var item = MONK.mettaSequence[mettaIndex];
    $id('dharma-metta-stage').textContent = item.stage;
    $id('dharma-metta-phrase').textContent = item.phrase;
  }

  function renderMalaStats() {
    var rounds = cache.activities.filter(function (a) { return a.category === 'mala-round'; }).length;
    $id('dharma-mala-stats').textContent = rounds
      ? (rounds + ' round' + (rounds === 1 ? '' : 's') + ' completed.')
      : 'A round is 108. Tap along with a mantra, a breath, or just a beat.';
  }

  function renderGatha() {
    $id('dharma-gatha').textContent = currentGatha;
  }

  function renderPrecepts() {
    var day = cache.days[todayStr] || { preceptItems: [] };
    renderChecklist('dharma-precepts', MONK.precepts, day.preceptItems || [], 'preceptItems');
  }

  function renderDharmaPrompt() {
    $id('dharma-prompt').textContent = currentDharmaPrompt;
  }
  function renderDharmaEntries() {
    var wrap = $id('dharma-entries');
    wrap.innerHTML = '';
    if (!cache.dharmaEntries.length) { wrap.innerHTML = '<p class="monk-empty">No reflections yet.</p>'; return; }
    cache.dharmaEntries.slice().reverse().forEach(function (n) {
      var div = document.createElement('div');
      div.className = 'monk-entry';
      div.innerHTML = '<p class="monk-entry-date">' + n.date + ' &middot; ' + n.prompt + '</p><p class="monk-entry-body"></p>';
      div.querySelector('.monk-entry-body').textContent = n.note;
      wrap.appendChild(div);
    });
  }

  function renderDharma() {
    renderSitChoices();
    renderSitStats();
    renderMetta();
    renderMalaStats();
    renderGatha();
    renderPrecepts();
    renderDharmaPrompt();
    renderDharmaEntries();
  }

  // Wired once, the sit timer especially can't tolerate being
  // re-attached on every render, or a tick would fire multiple times.
  function wireDharmaInteractions() {
    withConfirmation($id('dharma-refuge-btn'), function () {
      logActivity('refuge', '');
    }, 'Refuge Taken \u2713');

    $id('dharma-sit-start').addEventListener('click', function () {
      sitState.total = sitState.duration * 60;
      sitState.remaining = sitState.total;
      $id('dharma-sit-setup').style.display = 'none';
      $id('dharma-sit-active').style.display = 'block';
      $id('dharma-sit-timer').textContent = formatClock(sitState.remaining);
      var circle = $id('dharma-breath-circle');
      circle.classList.toggle('running', $id('dharma-visual-toggle').checked);
      playBell();
      sitState.intervalId = setInterval(function () {
        sitState.remaining--;
        $id('dharma-sit-timer').textContent = formatClock(sitState.remaining);
        if (sitState.remaining <= 0) endSit(true);
      }, 1000);
    });
    $id('dharma-sit-end').addEventListener('click', function () { endSit(false); });

    $id('dharma-metta-next').addEventListener('click', function () {
      mettaIndex = (mettaIndex + 1) % MONK.mettaSequence.length;
      renderMetta();
    });

    $id('dharma-mala-btn').addEventListener('click', function () {
      malaCount++;
      $id('dharma-mala-n').textContent = malaCount;
      if (malaCount >= 108) {
        var btn = $id('dharma-mala-btn');
        btn.classList.add('complete');
        playBell();
        logActivity('mala-round', '');
        renderProgress();
        setTimeout(function () {
          malaCount = 0;
          $id('dharma-mala-n').textContent = malaCount;
          btn.classList.remove('complete');
          renderMalaStats();
        }, 900);
      }
    });
    $id('dharma-mala-reset').addEventListener('click', function () {
      malaCount = 0;
      $id('dharma-mala-n').textContent = malaCount;
      $id('dharma-mala-btn').classList.remove('complete');
    });

    $id('dharma-gatha-new').addEventListener('click', function () {
      currentGatha = bags.gatha();
      renderGatha();
    });

    $id('dharma-new').addEventListener('click', function () {
      currentDharmaPrompt = bags.dharma();
      renderDharmaPrompt();
    });
    $id('dharma-save').addEventListener('click', function () {
      var textarea = $id('dharma-note');
      var text = textarea.value.trim();
      if (!text) return;
      var entry = { date: todayStr, prompt: currentDharmaPrompt, note: text };
      cache.dharmaEntries.push(entry);
      textarea.value = '';
      renderDharmaEntries();
      renderHome();
      renderProgress();
      userCreateInClass('MonkDharmaEntry', entry).catch(function (err) { console.warn('MonkDharmaEntry save failed:', err.message); });
    });
  }

  /* ---------------- MOVEMENT ---------------- */
  // Unlike Sourdough/Tea's "tried once" tag, a routine is meant to
  // be repeated, so completion here logs every time rather than
  // gating after the first click. The tag still fills in once you've
  // done it at least once, as a quiet visual note, but stays
  // clickable. Removal works the same way as everywhere else
  // (a MonkActivity row, keyed by title).

  function renderMovement() {
    var wrap = $id('movement-tags');
    wrap.innerHTML = '';
    var done = {}, removed = {};
    cache.activities.forEach(function (a) {
      if (a.category === 'movement') done[a.label] = true;
      if (a.category === 'movement-removed') removed[a.label] = true;
    });
    var visible = MONK.movementRoutines.filter(function (r) { return !removed[r.title]; });
    if (!visible.length) {
      wrap.innerHTML = '<p class="monk-empty">Nothing left on this list. Everything here has been removed.</p>';
      return;
    }
    visible.forEach(function (routine) {
      var tag = document.createElement('button');
      tag.className = 'monk-tag' + (done[routine.title] ? ' done' : '');
      tag.textContent = routine.title;
      tag.addEventListener('click', function () { openMovementModal(routine); });
      wrap.appendChild(tag);
    });
  }

  function openMovementModal(routine) {
    var html =
      '<h2></h2>' +
      '<h3>What You\u2019ll Need</h3><ul></ul>' +
      '<h3>The Routine</h3><ol></ol>' +
      '<div class="monk-modal-actions">' +
      '<button class="monk-btn primary" id="modal-movement-done-btn">Mark Today\u2019s Routine Complete</button>' +
      '<button class="monk-quiet-link" id="modal-movement-remove-btn">Remove from list</button>' +
      '</div>';
    openModal(html);
    modalBody.querySelector('h2').textContent = routine.title;
    var ul = modalBody.querySelector('ul');
    routine.ingredients.forEach(function (i) {
      var li = document.createElement('li');
      li.textContent = i;
      ul.appendChild(li);
    });
    var ol = modalBody.querySelector('ol');
    routine.steps.forEach(function (s) {
      var li = document.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    });

    withConfirmation(modalBody.querySelector('#modal-movement-done-btn'), function () {
      logActivity('movement', routine.title);
      renderProgress();
      renderMovement();
    }, 'Logged for Today \u2713');

    modalBody.querySelector('#modal-movement-remove-btn').addEventListener('click', function () {
      logActivity('movement-removed', routine.title);
      closeModal();
      renderMovement();
    });
  }

  /* ---------------- CALENDAR ---------------- */

  var CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var CAL_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var CAL_DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var calView = 'month'; // 'day' | 'week' | 'month' | 'year'
  var calAnchor = new Date(); // the date each view is currently centered on

  function calWeekStart(d) {
    var copy = new Date(d);
    copy.setDate(copy.getDate() - copy.getDay());
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function eventOccursOn(ev, ds) {
    var start = ev.startDate || ev.date || '';
    var end = ev.endDate || start;
    return ds >= start && ds <= end;
  }

  function eventsForDate(ds) {
    return cache.events
      .filter(function (e) { return eventOccursOn(e, ds); })
      .sort(function (a, b) {
        if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
  }

  function calShortDate(ds) {
    var d = new Date(ds + 'T00:00:00');
    return CAL_MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  }

  function calEventTimeLabel(ev) {
    var multiDay = ev.endDate && ev.endDate !== ev.startDate;
    var range = multiDay ? (calShortDate(ev.startDate) + '\u2013' + calShortDate(ev.endDate)) : '';
    if (ev.allDay) return multiDay ? 'All day \u00b7 ' + range : 'All day';
    var t = (ev.startTime || '') + (ev.endTime ? '\u2013' + ev.endTime : '');
    return multiDay ? (t + (t ? ' \u00b7 ' : '') + range) : t;
  }

  function calStep(dir) {
    if (calView === 'day') calAnchor = addDays(calAnchor, dir);
    else if (calView === 'week') calAnchor = addDays(calAnchor, dir * 7);
    else if (calView === 'month') { var d = new Date(calAnchor); d.setDate(1); d.setMonth(d.getMonth() + dir); calAnchor = d; }
    else { var y = new Date(calAnchor); y.setFullYear(y.getFullYear() + dir); calAnchor = y; }
    renderCalendar();
  }

  function renderCalendar() {
    Array.prototype.forEach.call(document.querySelectorAll('#cal-view-switch button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === calView);
    });
    var label = $id('cal-label');
    if (calView === 'day') {
      label.textContent = CAL_DOW_FULL[calAnchor.getDay()] + ', ' + CAL_MONTHS[calAnchor.getMonth()] + ' ' + calAnchor.getDate() + ', ' + calAnchor.getFullYear();
      renderCalDay();
    } else if (calView === 'week') {
      var start = calWeekStart(calAnchor), end = addDays(start, 6);
      var range = CAL_MONTHS[start.getMonth()] + ' ' + start.getDate();
      range += '\u2013' + (end.getMonth() !== start.getMonth() ? CAL_MONTHS[end.getMonth()] + ' ' : '') + end.getDate() + ', ' + end.getFullYear();
      label.textContent = range;
      renderCalWeek(start);
    } else if (calView === 'month') {
      label.textContent = CAL_MONTHS[calAnchor.getMonth()] + ' ' + calAnchor.getFullYear();
      renderCalMonth();
    } else {
      label.textContent = '' + calAnchor.getFullYear();
      renderCalYear();
    }
  }

  function calGridStart(year, month) {
    return calWeekStart(new Date(year, month, 1));
  }

  function renderCalMonth() {
    var wrap = $id('cal-view');
    var year = calAnchor.getFullYear(), month = calAnchor.getMonth();
    var cursor = calGridStart(year, month);
    var html = '<div class="monk-cal-month">';
    html += '<div class="monk-cal-month-dow">' + CAL_DOW.map(function (d) { return '<div>' + d + '</div>'; }).join('') + '</div>';
    html += '<div class="monk-cal-month-grid">';
    for (var i = 0; i < 42; i++) {
      var ds = dateStr(cursor);
      var dayEvents = eventsForDate(ds);
      var outside = cursor.getMonth() !== month;
      var cls = 'monk-cal-day' + (dayEvents.length ? ' has-events' : '') + (outside ? ' outside' : '') + (ds === todayStr ? ' today' : '');
      html += '<div class="' + cls + '" data-date="' + ds + '"><span class="monk-cal-day-dot">' + cursor.getDate() + '</span></div>';
      cursor = addDays(cursor, 1);
    }
    html += '</div></div>';
    wrap.innerHTML = html;
    Array.prototype.forEach.call(wrap.querySelectorAll('.monk-cal-day'), function (cell) {
      cell.addEventListener('click', function () {
        calAnchor = new Date(cell.getAttribute('data-date') + 'T00:00:00');
        calView = 'day';
        renderCalendar();
      });
    });
  }

  function calEventMarkup(ev, big) {
    var html = '<div class="monk-cal-event' + (ev.allDay ? ' all-day' : '') + '" data-id="' + ev.objectId + '">' +
      '<span class="monk-cal-event-time">' + calEventTimeLabel(ev) + '</span>' +
      '<span class="monk-cal-event-title">' + escapeHtml(ev.title) + '</span>';
    if (ev.location) html += '<span class="monk-cal-event-location">' + escapeHtml(ev.location) + '</span>';
    if (big && ev.description) html += '<p class="monk-cal-event-notes">' + escapeHtml(ev.description) + '</p>';
    html += '</div>';
    return html;
  }

  function renderCalWeek(start) {
    var wrap = $id('cal-view');
    var html = '<div class="monk-cal-week">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(start, i);
      var ds = dateStr(d);
      var dayEvents = eventsForDate(ds);
      html += '<div class="monk-cal-weekcol' + (ds === todayStr ? ' today' : '') + '">';
      html += '<div class="monk-cal-weekhead' + (dayEvents.length ? ' has-events' : '') + '"><span>' + CAL_DOW[d.getDay()] + '</span><span class="monk-cal-daynum">' + d.getDate() + '</span></div>';
      html += '<div class="monk-cal-weekbody">';
      dayEvents.forEach(function (ev) { html += calEventMarkup(ev, false); });
      html += '<button type="button" class="monk-cal-addlink" data-date="' + ds + '">+ Add</button>';
      html += '</div></div>';
    }
    html += '</div>';
    wrap.innerHTML = html;
    wireCalEventClicks(wrap);
  }

  function renderCalDay() {
    var wrap = $id('cal-view');
    var dayEvents = eventsForDate(dateStr(calAnchor));
    var html = '<div class="monk-cal-day-hero">' +
      '<span class="monk-cal-day-hero-num">' + calAnchor.getDate() + '</span>' +
      '<span class="monk-cal-day-hero-dow">' + CAL_DOW_FULL[calAnchor.getDay()] + '</span></div>';
    html += '<div class="monk-cal-day-agenda">';
    if (!dayEvents.length) {
      html += '<p class="monk-empty">Nothing scheduled. Add an appointment above.</p>';
    } else {
      dayEvents.forEach(function (ev) { html += calEventMarkup(ev, true); });
    }
    html += '</div>';
    wrap.innerHTML = html;
    wireCalEventClicks(wrap);
  }

  function renderCalYear() {
    var wrap = $id('cal-view');
    var year = calAnchor.getFullYear();
    var html = '<div class="monk-cal-year">';
    for (var m = 0; m < 12; m++) {
      html += '<div class="monk-cal-yearmonth">';
      html += '<p class="monk-cal-yearmonth-title" data-month="' + m + '">' + CAL_MONTHS[m] + '</p>';
      html += '<div class="monk-cal-yearmonth-dow">' + CAL_DOW.map(function (d) { return '<span>' + d.charAt(0) + '</span>'; }).join('') + '</div>';
      html += '<div class="monk-cal-yearmonth-grid">';
      var cursor = calGridStart(year, m);
      for (var i = 0; i < 42; i++) {
        var ds = dateStr(cursor);
        var has = eventsForDate(ds).length > 0;
        var outside = cursor.getMonth() !== m;
        var cls = 'monk-cal-yday' + (has ? ' has-events' : '') + (outside ? ' outside' : '') + (ds === todayStr ? ' today' : '');
        html += '<span class="' + cls + '" data-date="' + ds + '">' + cursor.getDate() + '</span>';
        cursor = addDays(cursor, 1);
      }
      html += '</div></div>';
    }
    html += '</div>';
    wrap.innerHTML = html;
    Array.prototype.forEach.call(wrap.querySelectorAll('.monk-cal-yday'), function (el) {
      el.addEventListener('click', function () {
        calAnchor = new Date(el.getAttribute('data-date') + 'T00:00:00');
        calView = 'day';
        renderCalendar();
      });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.monk-cal-yearmonth-title'), function (el) {
      el.addEventListener('click', function () {
        calAnchor = new Date(year, parseInt(el.getAttribute('data-month'), 10), 1);
        calView = 'month';
        renderCalendar();
      });
    });
  }

  // shared between week and day views: click an existing event to
  // edit it, click "+ Add" to create one already dated for that column
  function wireCalEventClicks(wrap) {
    Array.prototype.forEach.call(wrap.querySelectorAll('.monk-cal-addlink'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        calOpenEventEditor(null, btn.getAttribute('data-date'));
      });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.monk-cal-event'), function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var ev = cache.events.filter(function (x) { return x.objectId === el.getAttribute('data-id'); })[0];
        if (ev) calOpenEventEditor(ev);
      });
    });
  }

  function calOpenEventEditor(existing, prefillDate) {
    var html =
      '<h2></h2>' +
      '<input class="monk-input" id="cal-ev-title" placeholder="Title">' +
      '<input class="monk-input" id="cal-ev-location" placeholder="Location">' +
      '<a class="monk-quiet-link" id="cal-ev-map-link" target="_blank" rel="noopener">View on Map \u2197</a>' +
      '<label class="monk-cal-allday-toggle"><input type="checkbox" id="cal-ev-allday"><span>All day</span></label>' +
      '<p class="monk-cal-modal-label">Start date, and end date if it runs longer than one day</p>' +
      '<div class="monk-cal-modal-row">' +
      '<input class="monk-input" id="cal-ev-start-date" type="date">' +
      '<input class="monk-input" id="cal-ev-end-date" type="date">' +
      '</div>' +
      '<div class="monk-cal-modal-row" id="cal-ev-time-row">' +
      '<input class="monk-input" id="cal-ev-start-time" type="time">' +
      '<input class="monk-input" id="cal-ev-end-time" type="time">' +
      '</div>' +
      '<textarea class="monk-textarea" id="cal-ev-desc" placeholder="Description (optional)" style="min-height:100px"></textarea>' +
      '<div class="monk-modal-actions">' +
      (existing ? '<button class="monk-quiet-link" id="cal-ev-remove">Remove</button>' : '') +
      '<button class="monk-btn primary" id="cal-ev-save">Save</button>' +
      '</div>';
    openModal(html);
    modalBody.querySelector('h2').textContent = existing ? 'Edit Appointment' : 'New Appointment';
    var titleInput = modalBody.querySelector('#cal-ev-title');
    var locationInput = modalBody.querySelector('#cal-ev-location');
    var mapLink = modalBody.querySelector('#cal-ev-map-link');
    var alldayInput = modalBody.querySelector('#cal-ev-allday');
    var timeRow = modalBody.querySelector('#cal-ev-time-row');
    var startDateInput = modalBody.querySelector('#cal-ev-start-date');
    var endDateInput = modalBody.querySelector('#cal-ev-end-date');
    var startTimeInput = modalBody.querySelector('#cal-ev-start-time');
    var endTimeInput = modalBody.querySelector('#cal-ev-end-time');
    var descInput = modalBody.querySelector('#cal-ev-desc');

    var fallbackDate = prefillDate || dateStr(calAnchor);
    titleInput.value = existing ? existing.title : '';
    locationInput.value = existing ? (existing.location || '') : '';
    alldayInput.checked = !!(existing && existing.allDay);
    startDateInput.value = existing ? (existing.startDate || existing.date || fallbackDate) : fallbackDate;
    endDateInput.value = existing ? (existing.endDate || existing.startDate || existing.date || fallbackDate) : fallbackDate;
    startTimeInput.value = existing ? (existing.startTime || '') : '';
    endTimeInput.value = existing ? (existing.endTime || '') : '';
    descInput.value = existing ? (existing.description || existing.notes || '') : '';

    function refreshMapLink() {
      var loc = locationInput.value.trim();
      if (loc) {
        mapLink.style.display = '';
        mapLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc);
      } else {
        mapLink.style.display = 'none';
      }
    }
    function refreshAllDay() {
      timeRow.style.display = alldayInput.checked ? 'none' : '';
    }
    locationInput.addEventListener('input', refreshMapLink);
    alldayInput.addEventListener('change', refreshAllDay);
    refreshMapLink();
    refreshAllDay();

    modalBody.querySelector('#cal-ev-save').addEventListener('click', function () {
      var title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      var startDate = startDateInput.value || fallbackDate;
      var endDate = endDateInput.value || startDate;
      if (endDate < startDate) endDate = startDate;
      var fields = {
        title: title,
        location: locationInput.value.trim(),
        allDay: alldayInput.checked,
        startDate: startDate,
        endDate: endDate,
        startTime: alldayInput.checked ? '' : (startTimeInput.value || ''),
        endTime: alldayInput.checked ? '' : (endTimeInput.value || ''),
        description: descInput.value
      };
      if (existing) {
        Object.assign(existing, fields);
        renderCalendar();
        closeModal();
        updateInClass('MonkEvent', existing.objectId, fields).catch(function (err) { console.warn('MonkEvent update failed:', err.message); });
      } else {
        cache.events.push(fields);
        renderCalendar();
        closeModal();
        userCreateInClass('MonkEvent', fields).then(function (res) { fields.objectId = res.objectId; })
          .catch(function (err) { console.warn('MonkEvent create failed:', err.message); });
      }
    });
    if (existing) {
      modalBody.querySelector('#cal-ev-remove').addEventListener('click', function () {
        cache.events = cache.events.filter(function (e) { return e !== existing; });
        renderCalendar();
        closeModal();
        if (existing.objectId) deleteInClass('MonkEvent', existing.objectId).catch(function (err) { console.warn('MonkEvent delete failed:', err.message); });
      });
    }
  }

  function wireCalInteractions() {
    $id('cal-view-switch').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-view]');
      if (!btn) return;
      calView = btn.getAttribute('data-view');
      renderCalendar();
    });
    $id('cal-prev').addEventListener('click', function () { calStep(-1); });
    $id('cal-next').addEventListener('click', function () { calStep(1); });
    $id('cal-today').addEventListener('click', function () { calAnchor = new Date(); renderCalendar(); });
    $id('cal-new-event').addEventListener('click', function () { calOpenEventEditor(null, dateStr(calAnchor)); });
  }

  /* ---------------- PLACE ---------------- */

  var currentPlacePrompt = bags.place();

  function renderPlacePrompt() {
    $id('place-prompt').textContent = currentPlacePrompt;
  }
  function renderPlaceEntries() {
    var wrap = $id('place-entries');
    wrap.innerHTML = '';
    if (!cache.placeNotes.length) { wrap.innerHTML = '<p class="monk-empty">No observations yet.</p>'; return; }
    cache.placeNotes.slice().reverse().forEach(function (n) {
      var div = document.createElement('div');
      div.className = 'monk-entry';
      div.innerHTML = '<p class="monk-entry-date">' + n.date + ' &middot; ' + n.prompt + '</p><p class="monk-entry-body"></p>';
      div.querySelector('.monk-entry-body').textContent = n.note;
      wrap.appendChild(div);
    });
  }

  $id('place-new').addEventListener('click', function () {
    currentPlacePrompt = bags.place();
    renderPlacePrompt();
  });
  $id('place-save').addEventListener('click', function () {
    var textarea = $id('place-note');
    var text = textarea.value.trim();
    if (!text) return;
    var entry = { date: todayStr, prompt: currentPlacePrompt, note: text };
    cache.placeNotes.push(entry);
    textarea.value = '';
    renderPlaceEntries();
    renderHome();
    renderProgress();
    userCreateInClass('MonkPlaceNote', entry).catch(function (err) { console.warn('MonkPlaceNote save failed:', err.message); });
  });

  /* ---------------- confirmation helper ---------------- */
  // Shared by every "mark done" button: shows a brief "Logged" state
  // and disables itself for that window, so a click always gives
  // visible feedback and a rapid double-click (or any code path
  // firing the handler more than once) can never log a duplicate.

  function withConfirmation(btn, onConfirm, confirmLabel) {
    var originalLabel = btn.textContent;
    var busy = false;
    btn.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      onConfirm();
      btn.textContent = confirmLabel || 'Logged \u2713';
      btn.disabled = true;
      setTimeout(function () {
        btn.textContent = originalLabel;
        btn.disabled = false;
        busy = false;
      }, 1100);
    });
  }

  /* ---------------- bell chime (sit timer + mala) ---------------- */
  // A soft, decaying tone built from a fundamental plus two quiet
  // overtones, no audio file needed, and it only ever fires from a
  // real click, so autoplay restrictions are never a problem.

  var bellCtx = null;
  function playBell() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!bellCtx) {
      try { bellCtx = new AC(); } catch (e) { return; }
    }
    var ctx = bellCtx;
    var now = ctx.currentTime;
    var master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    master.connect(ctx.destination);
    [480, 725, 1200].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var partial = ctx.createGain();
      partial.gain.value = i === 0 ? 1 : 0.3 / (i + 1);
      osc.connect(partial);
      partial.connect(master);
      osc.start(now);
      osc.stop(now + 3.3);
    });
  }

  /* ---------------- modal helper ---------------- */
  // One overlay, reused by anything that needs a popup (currently
  // just the sourdough recipe cards). Body content is passed in as
  // an HTML string built by the caller.

  var modalOverlay = $id('monk-modal-overlay');
  var modalBody = $id('monk-modal-body');

  function openModal(html) {
    modalBody.innerHTML = html;
    modalOverlay.style.display = 'flex';
  }
  function closeModal() {
    modalOverlay.style.display = 'none';
    modalBody.innerHTML = '';
  }
  $id('monk-modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalOverlay.style.display !== 'none') closeModal();
  });

  /* ---------------- PRESENCE / SOLITUDE / HUMILITY / STEWARDSHIP / JOY ---------------- */
  // Same shape: pick a random prompt, optional "done" logs an activity.

  function wireRandomCard(promptElId, newBtnId, doneBtnId, drawFn, category) {
    var current = drawFn();
    var el = $id(promptElId);
    el.textContent = current;
    $id(newBtnId).addEventListener('click', function () {
      current = drawFn();
      el.textContent = current;
    });
    if (doneBtnId) {
      withConfirmation($id(doneBtnId), function () {
        logActivity(category, current);
      });
    }
  }

  /* ---------------- LEARNING ---------------- */

  function renderLearning() {
    var select = $id('learning-category');
    if (!select.options.length) {
      Object.keys(MONK.learning).forEach(function (cat) {
        var opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
      });
    }
    var currentTopic = learningBag(select.value)();
    var topicEl = $id('learning-topic');
    topicEl.textContent = currentTopic;

    function pickNew() {
      currentTopic = learningBag(select.value)();
      topicEl.textContent = currentTopic;
    }
    select.addEventListener('change', pickNew);
    $id('learning-new').addEventListener('click', pickNew);
    withConfirmation($id('learning-done'), function () {
      logActivity('learning', select.value + ': ' + currentTopic);
    });

    renderKB();
    wireKBInteractions();
  }

  /* ---- notebook: nested folders, sticky notes, photos, sketches ---- */
  // One class, MonkLearningNode, covers folders and every content
  // type. A folder is just a node with type 'folder' that other
  // nodes point at via parentId. Root-level items use parentId ''.

  // '' = zoomed all the way out, showing the whole notebook as one
  // web. A folder's objectId = zoomed into that folder, showing just
  // its own subtree as a smaller local web. Same drag/drop rules
  // apply at either zoom level.
  var kbCurrentFolderId = '';
  var KB_CX = 900, KB_CY = 700, KB_RADIUS_STEP = 150;
  var kbDrag = null; // {node, dx, dy, moved} while a pointer-drag is in progress
  var kbLastPositions = {}; // nodeId -> {x,y} as last drawn, for drop hit-testing
  var kbLastFolders = [];   // folder nodes currently on screen, i.e. valid drop targets

  function kbChildrenOf(parentId) {
    return cache.learningNodes.filter(function (n) { return (n.parentId || '') === parentId; });
  }

  function kbNodeById(id) {
    return cache.learningNodes.filter(function (n) { return n.objectId === id; })[0];
  }

  function kbPathTo(id) {
    var path = [];
    var node = kbNodeById(id);
    while (node) {
      path.unshift(node);
      node = kbNodeById(node.parentId);
    }
    return path;
  }

  function kbCollectDescendants(id) {
    var out = [];
    kbChildrenOf(id).forEach(function (child) {
      out.push(child);
      if (child.type === 'folder') out = out.concat(kbCollectDescendants(child.objectId));
    });
    return out;
  }

  function kbDeleteNode(node) {
    var toRemove = [node].concat(node.type === 'folder' ? kbCollectDescendants(node.objectId) : []);
    var removeIds = toRemove.map(function (n) { return n.objectId; });
    cache.learningNodes = cache.learningNodes.filter(function (n) { return removeIds.indexOf(n.objectId) === -1; });
    if (removeIds.indexOf(kbCurrentFolderId) !== -1) kbCurrentFolderId = node.parentId || '';
    renderKB();
    toRemove.forEach(function (n) {
      if (n.objectId) deleteInClass('MonkLearningNode', n.objectId).catch(function (err) { console.warn('MonkLearningNode delete failed:', err.message); });
    });
  }

  // Auto-layout: a radial tree rooted at rootId (a folder's id, or
  // '' for the whole notebook), spreading each node's children
  // around it by angle and one ring further out per level. Only
  // used as a fallback for nodes that don't have a saved (dragged)
  // position yet; manual drags always take priority.
  function kbAutoLayout(rootId) {
    var positions = {};
    function countLeaves(id) {
      var kids = kbChildrenOf(id);
      if (!kids.length) return 1;
      var sum = 0;
      kids.forEach(function (c) { sum += countLeaves(c.objectId); });
      return sum;
    }
    function place(id, depth, angleStart, angleEnd) {
      var angle = (angleStart + angleEnd) / 2;
      positions[id] = depth === 0
        ? { x: KB_CX, y: KB_CY }
        : { x: KB_CX + depth * KB_RADIUS_STEP * Math.cos(angle), y: KB_CY + depth * KB_RADIUS_STEP * Math.sin(angle) };
      var kids = kbChildrenOf(id);
      if (!kids.length) return;
      var total = countLeaves(id);
      var cursor = angleStart;
      kids.forEach(function (c) {
        var slice = (countLeaves(c.objectId) / total) * (angleEnd - angleStart);
        place(c.objectId, depth + 1, cursor, cursor + slice);
        cursor += slice;
      });
    }
    place(rootId, 0, 0, Math.PI * 2);
    return positions;
  }

  function kbNodePos(node, auto) {
    if (typeof node.x === 'number' && typeof node.y === 'number') return { x: node.x, y: node.y };
    return auto[node.objectId] || { x: KB_CX, y: KB_CY };
  }

  // Rough estimate of wrapped line count at the sticky note's fixed
  // width, so the box can be tall enough to show the whole note
  // instead of clipping it.
  function kbEstimateNoteHeight(title, body) {
    var perLine = 19;
    function lineCount(s) {
      if (!s) return 0;
      return s.split('\n').reduce(function (sum, para) { return sum + Math.max(1, Math.ceil(para.length / perLine)); }, 0);
    }
    return 40 + lineCount(title) * 15 + (body ? 8 + lineCount(body) * 14 : 0);
  }

  function kbPersistPosition(node) {
    if (!node.objectId) return;
    updateInClass('MonkLearningNode', node.objectId, { x: node.x, y: node.y, parentId: node.parentId || '' })
      .catch(function (err) { console.warn('MonkLearningNode position save failed:', err.message); });
  }

  function renderKB() {
    // breadcrumb
    var crumbWrap = $id('kb-breadcrumb');
    crumbWrap.innerHTML = '';
    var rootBtn = document.createElement('button');
    rootBtn.textContent = 'Whole Web';
    rootBtn.addEventListener('click', function () { kbCurrentFolderId = ''; renderKB(); });
    crumbWrap.appendChild(rootBtn);
    kbPathTo(kbCurrentFolderId).forEach(function (n) {
      var sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '/';
      crumbWrap.appendChild(sep);
      var btn = document.createElement('button');
      btn.textContent = n.title;
      btn.addEventListener('click', function () { kbCurrentFolderId = n.objectId; renderKB(); });
      crumbWrap.appendChild(btn);
    });

    kbRenderGraph(true);
  }

  // The graph itself: every node reachable from the current zoom
  // level (the whole notebook when kbCurrentFolderId is '', or one
  // folder's own subtree once you've zoomed in), drawn as circles
  // connected to their parent. A node's spot is auto-arranged the
  // first time it shows up; once you drag it, it keeps that spot.
  function kbRenderGraph(recenter) {
    var wrap = $id('kb-web');
    var focusNode = kbCurrentFolderId ? kbNodeById(kbCurrentFolderId) : null;
    var rootId = kbCurrentFolderId || '';
    var nodes = focusNode ? [focusNode].concat(kbCollectDescendants(focusNode.objectId)) : cache.learningNodes.slice();

    if (!nodes.length) {
      wrap.innerHTML = '<p class="monk-empty" style="border:none">Nothing here yet. Add a folder or some content below.</p>';
      kbLastPositions = {};
      kbLastFolders = [];
      return;
    }

    var auto = kbAutoLayout(rootId);
    var byId = {};
    nodes.forEach(function (n) { byId[n.objectId] = kbNodePos(n, auto); });
    // the hub itself: the folder you've zoomed into, or a virtual
    // "Notebook" center when you're looking at the whole web. Every
    // top-level node connects to this, so the whole thing reads as
    // one web instead of a scatter of disconnected dots.
    byId[rootId] = focusNode ? byId[focusNode.objectId] : (auto[rootId] || { x: KB_CX, y: KB_CY });
    kbLastPositions = byId;
    kbLastFolders = nodes.filter(function (n) { return n.type === 'folder'; });
    if (!focusNode) kbLastFolders.push({ objectId: '' }); // dropping near the hub promotes a node back to top level

    var xs = Object.keys(byId).map(function (id) { return byId[id].x; });
    var ys = Object.keys(byId).map(function (id) { return byId[id].y; });
    var minX = Math.min.apply(null, xs) - 100, maxX = Math.max.apply(null, xs) + 100;
    var minY = Math.min.apply(null, ys) - 60, maxY = Math.max.apply(null, ys) + 70;
    var w = Math.max(600, maxX - minX);
    var h = Math.max(420, maxY - minY);

    var svg = '<svg data-ox="' + minX + '" data-oy="' + minY + '" viewBox="' + minX + ' ' + minY + ' ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">';

    // lines: every node connects back to its parent, and every
    // top-level node connects to the hub
    nodes.forEach(function (n) {
      var p = byId[n.parentId || ''] || byId[rootId];
      if (!p || n.objectId === rootId) return;
      var c = byId[n.objectId];
      svg += '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + c.x + '" y2="' + c.y + '"></line>';
    });

    function nodeMarkup(n, isRoot) {
      var pos = isRoot ? byId[rootId] : byId[n.objectId];
      var label = n.title.length > 16 ? n.title.slice(0, 15) + '\u2026' : n.title;
      if (isRoot) {
        var r0 = 9;
        return '<g class="kb-node current"><circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + r0 + '"></circle>' +
          '<text class="kb-node-label" x="' + pos.x + '" y="' + (pos.y + r0 + 16) + '" text-anchor="middle">' + label + '</text></g>';
      }

      var g = '<g class="kb-node kb-node-' + n.type + '" data-kb-node="' + n.objectId + '">';

      if (n.type === 'photo' && n.photoUrl) {
        var pr = 20;
        var clipId = 'kbclip-' + n.objectId;
        var grayscale = n.colorMode === 'color' ? '' : ' style="filter:grayscale(100%)"';
        g += '<clipPath id="' + clipId + '"><circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + pr + '"></circle></clipPath>';
        g += '<image href="' + n.photoUrl + '" x="' + (pos.x - pr) + '" y="' + (pos.y - pr) + '" width="' + (pr * 2) + '" height="' + (pr * 2) + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + clipId + ')"' + grayscale + '></image>';
        g += '<circle class="kb-node-photo-ring" cx="' + pos.x + '" cy="' + pos.y + '" r="' + pr + '"></circle>';
        g += '<text class="kb-node-label" x="' + pos.x + '" y="' + (pos.y + pr + 16) + '" text-anchor="middle">' + label + '</text>';
        g += '<text class="kb-node-remove" x="' + (pos.x + pr + 3) + '" y="' + (pos.y - pr - 2) + '" text-anchor="start">\u00d7</text>';
      } else if (n.type === 'note') {
        var noteW = 132;
        var noteH = kbEstimateNoteHeight(n.title, n.body);
        var fx = pos.x - noteW / 2, fy = pos.y - noteH / 2;
        g += '<foreignObject x="' + fx + '" y="' + fy + '" width="' + noteW + '" height="' + noteH + '">' +
          '<div xmlns="http://www.w3.org/1999/xhtml" class="kb-node-sticky">' +
          '<div class="kb-node-sticky-title">' + escapeHtml(n.title) + '</div>' +
          (n.body ? '<div class="kb-node-sticky-body">' + escapeHtml(n.body) + '</div>' : '') +
          '</div></foreignObject>';
        g += '<text class="kb-node-remove kb-node-remove-sticky" x="' + (fx + noteW - 4) + '" y="' + (fy + 13) + '" text-anchor="end">\u00d7</text>';
      } else {
        var r = n.type === 'folder' ? 9 : 6;
        var badge = n.type === 'sketch' ? 'S' : '';
        g += '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + r + '"></circle>';
        if (badge) g += '<text class="kb-node-badge" x="' + (pos.x - r - 3) + '" y="' + (pos.y - r - 2) + '" text-anchor="end">' + badge + '</text>';
        g += '<text class="kb-node-label" x="' + pos.x + '" y="' + (pos.y + r + 16) + '" text-anchor="middle">' + label + '</text>';
        g += '<text class="kb-node-remove" x="' + (pos.x + r + 3) + '" y="' + (pos.y - r - 2) + '" text-anchor="start">\u00d7</text>';
      }

      g += '</g>';
      return g;
    }

    svg += nodeMarkup(focusNode || { title: 'Notebook' }, true);
    nodes.forEach(function (n) {
      if (focusNode && n.objectId === focusNode.objectId) return;
      svg += nodeMarkup(n, false);
    });

    svg += '</svg>';
    wrap.innerHTML = svg;

    var svgEl = wrap.querySelector('svg');
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-kb-node]'), function (g) {
      var id = g.getAttribute('data-kb-node');
      var n = kbNodeById(id);
      var removeEl = g.querySelector('.kb-node-remove');
      removeEl.addEventListener('click', function (e) { e.stopPropagation(); kbDeleteNode(n); });
      g.addEventListener('pointerdown', function (e) {
        if (e.target === removeEl) return;
        kbStartDrag(e, n);
      });
    });

    if (recenter) {
      var focusPos = byId[rootId];
      requestAnimationFrame(function () {
        wrap.scrollLeft = (focusPos.x - minX) - wrap.clientWidth / 2;
        wrap.scrollTop = (focusPos.y - minY) - wrap.clientHeight / 2;
      });
    }
  }

  function kbSvgPoint(svgEl, evt) {
    var rect = svgEl.getBoundingClientRect();
    var ox = parseFloat(svgEl.getAttribute('data-ox'));
    var oy = parseFloat(svgEl.getAttribute('data-oy'));
    var vb = svgEl.viewBox.baseVal;
    var scaleX = vb.width / rect.width, scaleY = vb.height / rect.height;
    return { x: ox + (evt.clientX - rect.left) * scaleX, y: oy + (evt.clientY - rect.top) * scaleY };
  }

  // Drag listens on document, not on the node's own <g>, because
  // every pointermove re-renders the graph (kbRenderGraph replaces
  // the whole <svg> via innerHTML), which would otherwise destroy
  // the exact element a per-node listener was attached to partway
  // through the drag. document never gets destroyed, so the stream
  // survives; each handler re-queries the current <svg> fresh.
  function kbStartDrag(e, n) {
    e.preventDefault();
    var svgEl = $q('#kb-web svg');
    if (!svgEl) return;
    var pos = kbLastPositions[n.objectId] || { x: n.x || KB_CX, y: n.y || KB_CY };
    var pt = kbSvgPoint(svgEl, e);
    kbDrag = { node: n, dx: pt.x - pos.x, dy: pt.y - pos.y, moved: false };
    document.addEventListener('pointermove', kbOnDragMove);
    document.addEventListener('pointerup', kbOnDragEnd);
    document.addEventListener('pointercancel', kbOnDragEnd);
  }

  function kbOnDragMove(e) {
    if (!kbDrag) return;
    var svgEl = $q('#kb-web svg');
    if (!svgEl) return;
    var pt = kbSvgPoint(svgEl, e);
    kbDrag.node.x = pt.x - kbDrag.dx;
    kbDrag.node.y = pt.y - kbDrag.dy;
    kbDrag.moved = true;
    kbRenderGraph(false);
  }

  // A plain click (no movement) opens the node, same as before.
  // A drag repositions it and, if it's dropped on top of a folder
  // (or the hub, to pull it back out to this level), files it in
  // there; dropped anywhere else it just keeps its new spot.
  function kbOnDragEnd() {
    document.removeEventListener('pointermove', kbOnDragMove);
    document.removeEventListener('pointerup', kbOnDragEnd);
    document.removeEventListener('pointercancel', kbOnDragEnd);
    if (!kbDrag) return;
    var n = kbDrag.node;
    var moved = kbDrag.moved;
    kbDrag = null;
    if (!moved) { kbOpenNode(n); return; }

    var excludeIds = [n.objectId].concat(kbCollectDescendants(n.objectId).map(function (d) { return d.objectId; }));
    var target = null, best = 34;
    kbLastFolders.forEach(function (f) {
      if (excludeIds.indexOf(f.objectId) !== -1) return;
      var p = kbLastPositions[f.objectId];
      if (!p) return;
      var dist = Math.hypot(p.x - n.x, p.y - n.y);
      if (dist < best) { best = dist; target = f; }
    });
    if (target && target.objectId !== (n.parentId || '')) n.parentId = target.objectId;

    kbRenderGraph(false);
    kbPersistPosition(n);
  }


  function kbOpenNode(n) {
    if (n.type === 'folder') { kbCurrentFolderId = n.objectId; renderKB(); return; }
    if (n.type === 'note') { kbOpenNoteEditor(n); return; }
    if (n.type === 'photo') { kbOpenPhotoViewer(n); return; }
    if (n.type === 'sketch') { kbOpenSketch(n); return; }
  }

  function kbOpenNoteEditor(existing) {
    var html =
      '<h2></h2>' +
      '<input class="monk-input monk-kb-note-title" placeholder="Title">' +
      '<textarea class="monk-textarea monk-kb-note-body" placeholder="Notes, bullet points, whatever you want. Start a line with - for a bullet." style="min-height:160px"></textarea>' +
      '<div class="monk-modal-actions">' +
      (existing ? '<button class="monk-quiet-link" id="kb-note-remove">Remove</button>' : '') +
      '<button class="monk-btn primary" id="kb-note-save">Save</button></div>';
    openModal(html);
    modalBody.querySelector('h2').textContent = existing ? 'Edit Note' : 'New Sticky Note';
    var titleInput = modalBody.querySelector('.monk-kb-note-title');
    var bodyInput = modalBody.querySelector('.monk-kb-note-body');
    titleInput.value = existing ? existing.title : '';
    bodyInput.value = existing ? existing.body : '';
    modalBody.querySelector('#kb-note-save').addEventListener('click', function () {
      var title = titleInput.value.trim() || 'Untitled Note';
      var body = bodyInput.value;
      if (existing) {
        existing.title = title;
        existing.body = body;
        renderKB();
        closeModal();
        updateInClass('MonkLearningNode', existing.objectId, { title: title, body: body }).catch(function (err) { console.warn('MonkLearningNode update failed:', err.message); });
      } else {
        var entry = { type: 'note', parentId: kbCurrentFolderId, title: title, body: body };
        cache.learningNodes.push(entry);
        renderKB();
        closeModal();
        userCreateInClass('MonkLearningNode', entry).then(function (res) { entry.objectId = res.objectId; })
          .catch(function (err) { console.warn('MonkLearningNode create failed:', err.message); });
      }
    });
    if (existing) {
      modalBody.querySelector('#kb-note-remove').addEventListener('click', function () {
        closeModal();
        kbDeleteNode(existing);
      });
    }
  }

  function kbOpenPhotoViewer(n) {
    var html =
      '<h2></h2>' +
      '<img class="monk-kb-photo-full" src="' + n.photoUrl + '" alt="">' +
      '<label class="monk-kb-color-toggle"><input type="checkbox" id="kb-color-toggle"><span>Show in color</span></label>' +
      '<div class="monk-modal-actions"><button class="monk-quiet-link" id="kb-photo-remove">Remove Photo</button></div>';
    openModal(html);
    modalBody.querySelector('h2').textContent = n.title;
    var img = modalBody.querySelector('.monk-kb-photo-full');
    var toggle = modalBody.querySelector('#kb-color-toggle');
    toggle.checked = n.colorMode === 'color';
    img.style.filter = toggle.checked ? 'none' : 'grayscale(100%)';
    toggle.addEventListener('change', function () {
      n.colorMode = toggle.checked ? 'color' : 'bw';
      img.style.filter = toggle.checked ? 'none' : 'grayscale(100%)';
      if (n.objectId) updateInClass('MonkLearningNode', n.objectId, { colorMode: n.colorMode }).catch(function (err) { console.warn('MonkLearningNode update failed:', err.message); });
    });
    modalBody.querySelector('#kb-photo-remove').addEventListener('click', function () {
      closeModal();
      kbDeleteNode(n);
    });
  }

  /* ---- sketches: pen + eraser + thickness + undo, on a canvas ---- */

  var kbCanvas = $id('kb-canvas');
  var kbCtx = kbCanvas.getContext('2d');
  var kbSketchOverlay = $id('kb-sketch-overlay');
  var kbStrokes = [];
  var kbCurrentStroke = null;
  var kbDrawing = false;
  var kbTool = 'pen';
  var kbThickness = 3;
  var kbActiveSketchNode = null;

  function kbRedraw() {
    if (!kbCtx) return;
    kbCtx.clearRect(0, 0, kbCanvas.width, kbCanvas.height);
    kbCtx.fillStyle = '#ffffff';
    kbCtx.fillRect(0, 0, kbCanvas.width, kbCanvas.height);
    kbStrokes.forEach(function (stroke) {
      if (stroke.points.length < 2) return;
      kbCtx.beginPath();
      kbCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (var i = 1; i < stroke.points.length; i++) kbCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
      kbCtx.lineCap = 'round';
      kbCtx.lineJoin = 'round';
      kbCtx.lineWidth = stroke.thickness;
      kbCtx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
      kbCtx.strokeStyle = '#000000';
      kbCtx.stroke();
    });
    kbCtx.globalCompositeOperation = 'source-over';
  }

  function kbCanvasPoint(e) {
    var rect = kbCanvas.getBoundingClientRect();
    var scaleX = kbCanvas.width / rect.width;
    var scaleY = kbCanvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  var kbSketchTitleInput = $id('kb-sketch-title');

  function kbSaveSketch() {
    if (!kbActiveSketchNode) return;
    var title = kbSketchTitleInput.value.trim() || 'Untitled Sketch';
    kbActiveSketchNode.title = title;
    var data = JSON.stringify(kbStrokes);
    kbActiveSketchNode.sketchStrokes = data;
    if (kbActiveSketchNode.objectId) {
      updateInClass('MonkLearningNode', kbActiveSketchNode.objectId, { title: title, sketchStrokes: data }).catch(function (err) { console.warn('MonkLearningNode update failed:', err.message); });
    } else {
      userCreateInClass('MonkLearningNode', kbActiveSketchNode).then(function (res) { kbActiveSketchNode.objectId = res.objectId; })
        .catch(function (err) { console.warn('MonkLearningNode create failed:', err.message); });
    }
  }

  function kbOpenSketch(existing) {
    if (existing) {
      kbActiveSketchNode = existing;
      kbStrokes = existing.sketchStrokes ? JSON.parse(existing.sketchStrokes) : [];
    } else {
      kbActiveSketchNode = { type: 'sketch', parentId: kbCurrentFolderId, title: 'Untitled Sketch', sketchStrokes: '[]' };
      cache.learningNodes.push(kbActiveSketchNode);
      kbStrokes = [];
    }
    kbSketchTitleInput.value = kbActiveSketchNode.title;
    kbRedraw();
    kbSketchOverlay.style.display = 'flex';
  }

  function kbCloseSketch() {
    kbSketchOverlay.style.display = 'none';
    renderKB();
    kbActiveSketchNode = null;
  }

  function kbUndo() {
    kbStrokes.pop();
    kbRedraw();
    kbSaveSketch();
  }

  function wireKBInteractions() {
    kbSketchTitleInput.addEventListener('blur', kbSaveSketch);
    kbSketchTitleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); kbSaveSketch(); kbSketchTitleInput.blur(); }
    });

    $id('kb-new-folder').addEventListener('click', function () {
      var html =
        '<h2>New Folder</h2>' +
        '<input class="monk-input" id="kb-folder-title" placeholder="Folder name">' +
        '<div class="monk-modal-actions"><button class="monk-btn primary" id="kb-folder-create">Create Folder</button></div>';
      openModal(html);
      modalBody.querySelector('#kb-folder-create').addEventListener('click', function () {
        var title = modalBody.querySelector('#kb-folder-title').value.trim();
        if (!title) return;
        var entry = { type: 'folder', parentId: kbCurrentFolderId, title: title };
        cache.learningNodes.push(entry);
        closeModal();
        renderKB();
        userCreateInClass('MonkLearningNode', entry).then(function (res) { entry.objectId = res.objectId; })
          .catch(function (err) { console.warn('MonkLearningNode create failed:', err.message); });
      });
    });

    $id('kb-new-content').addEventListener('click', function () {
      var html =
        '<h2>Add Content</h2>' +
        '<div class="monk-modal-actions">' +
        '<button class="monk-btn primary" id="kb-add-note">Sticky Note</button>' +
        '<button class="monk-btn primary" id="kb-add-photo">Photo</button>' +
        '<button class="monk-btn primary" id="kb-add-sketch">Sketch</button>' +
        '</div>';
      openModal(html);
      modalBody.querySelector('#kb-add-note').addEventListener('click', function () { closeModal(); kbOpenNoteEditor(null); });
      modalBody.querySelector('#kb-add-photo').addEventListener('click', function () { closeModal(); $id('kb-photo-input').click(); });
      modalBody.querySelector('#kb-add-sketch').addEventListener('click', function () { closeModal(); kbOpenSketch(null); });
    });

    $id('kb-photo-input').addEventListener('change', function (e) {
      var file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        var entry = { type: 'photo', parentId: kbCurrentFolderId, title: file.name.replace(/\.[a-zA-Z0-9]+$/, '') || 'Photo', photoUrl: '', photoName: file.name, colorMode: 'bw' };
        cache.learningNodes.push(entry);
        renderKB();
        b4aUploadFile(Date.now() + '_' + file.name, dataUrl).then(function (res) {
          entry.photoUrl = res.url;
          renderKB();
          return userCreateInClass('MonkLearningNode', entry);
        }).then(function (res) {
          if (res) entry.objectId = res.objectId;
        }).catch(function (err) { console.warn('Photo upload failed:', err.message); });
      };
      reader.readAsDataURL(file);
    });

    // sketch toolbar
    var penBtn = $id('kb-tool-pen');
    var eraserBtn = $id('kb-tool-eraser');
    function setTool(tool) {
      kbTool = tool;
      penBtn.classList.toggle('active', tool === 'pen');
      eraserBtn.classList.toggle('active', tool === 'eraser');
      kbCanvas.classList.toggle('tool-pen', tool === 'pen');
      kbCanvas.classList.toggle('tool-eraser', tool === 'eraser');
    }
    penBtn.addEventListener('click', function () { setTool('pen'); });
    eraserBtn.addEventListener('click', function () { setTool('eraser'); });
    $id('kb-thickness').addEventListener('input', function (e) { kbThickness = parseInt(e.target.value, 10); });
    $id('kb-undo').addEventListener('click', kbUndo);
    $id('kb-sketch-done').addEventListener('click', function () { kbSaveSketch(); kbCloseSketch(); });

    document.addEventListener('keydown', function (e) {
      if (kbSketchOverlay.style.display === 'none') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); kbUndo(); }
    });

    kbCanvas.addEventListener('pointerdown', function (e) {
      kbDrawing = true;
      kbCurrentStroke = { points: [kbCanvasPoint(e)], thickness: kbThickness, erase: kbTool === 'eraser' };
      kbStrokes.push(kbCurrentStroke);
      if (kbCanvas.setPointerCapture) {
        try { kbCanvas.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      }
    });
    kbCanvas.addEventListener('pointermove', function (e) {
      if (!kbDrawing || !kbCurrentStroke) return;
      kbCurrentStroke.points.push(kbCanvasPoint(e));
      kbRedraw();
    });
    function endStroke() {
      if (!kbDrawing) return;
      kbDrawing = false;
      kbCurrentStroke = null;
      kbSaveSketch();
    }
    kbCanvas.addEventListener('pointerup', endStroke);
    kbCanvas.addEventListener('pointerleave', endStroke);
  }

  /* ---------------- READING ---------------- */
  // Books and their annotations are linked by object reference in
  // memory (same trick as plants/watchlist: cache.bookNotes[i].book
  // points straight at the book object it belongs to), and by
  // Back4App objectId once both sides have been saved for real.

  var BOOK_STATUSES = ['Want to Read', 'Reading', 'Finished'];

  function ensureBookPersisted(b, afterSaved) {
    if (b.objectId) { afterSaved(); return; }
    userCreateInClass('MonkBook', { title: b.title, author: b.author, status: b.status }).then(function (res) {
      b.objectId = res.objectId;
      afterSaved();
    }).catch(function (err) { console.warn('MonkBook create failed:', err.message); afterSaved(); });
  }

  function persistBookStatus(b) {
    if (b.objectId) {
      updateInClass('MonkBook', b.objectId, { status: b.status }).catch(function (err) { console.warn('MonkBook update failed:', err.message); });
    } else {
      ensureBookPersisted(b, function () {});
    }
  }

  function renderReading() {
    var wrap = $id('book-list');
    wrap.innerHTML = '';
    if (!cache.books.length) {
      wrap.innerHTML = '<p class="monk-empty">Nothing on the shelf yet. Add a book above.</p>';
      return;
    }
    cache.books.forEach(function (b) {
      var card = document.createElement('div');
      card.className = 'monk-book-card' + (b.open ? ' open' : '');
      card.innerHTML =
        '<button class="monk-book-header" type="button">' +
        '<span class="monk-book-titles"><span class="monk-book-title"></span><span class="monk-book-author"></span></span>' +
        '<span class="monk-book-status"></span>' +
        '<span class="monk-book-chevron">\u203A</span>' +
        '</button>' +
        '<div class="monk-book-body">' +
        '<div class="monk-annotation-form">' +
        '<textarea class="monk-textarea note-quote" placeholder="A line worth keeping..." style="min-height:64px"></textarea>' +
        '<input class="monk-input note-page" placeholder="Page, optional">' +
        '<textarea class="monk-textarea note-note" placeholder="What it means to you, optional" style="min-height:64px"></textarea>' +
        '<button class="monk-btn primary note-add">Save to Book</button>' +
        '</div>' +
        '<div class="book-annotations"></div>' +
        '<button class="monk-quiet-link monk-book-remove">Remove Book</button>' +
        '</div>';

      card.querySelector('.monk-book-title').textContent = b.title;
      card.querySelector('.monk-book-author').textContent = b.author || '';
      var statusBtn = card.querySelector('.monk-book-status');
      statusBtn.textContent = b.status;
      statusBtn.classList.toggle('finished', b.status === 'Finished');

      card.querySelector('.monk-book-header').addEventListener('click', function () {
        b.open = !b.open;
        renderReading();
      });

      statusBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = BOOK_STATUSES.indexOf(b.status);
        var nextStatus = BOOK_STATUSES[(idx + 1) % BOOK_STATUSES.length];
        b.status = nextStatus;
        if (nextStatus === 'Finished') logActivity('book-finished', b.title);
        persistBookStatus(b);
        renderReading();
      });

      // Annotations belonging to this book
      var notesWrap = card.querySelector('.book-annotations');
      var notesForBook = cache.bookNotes.filter(function (n) { return n.book === b; });
      if (notesForBook.length) {
        notesForBook.slice().reverse().forEach(function (n) {
          var ann = document.createElement('div');
          ann.className = 'monk-annotation';
          ann.innerHTML =
            '<p class="monk-annotation-quote"></p>' +
            '<p class="monk-annotation-meta"></p>' +
            (n.note ? '<p class="monk-annotation-note"></p>' : '') +
            '<button class="monk-quiet-link ann-remove">Remove</button>';
          ann.querySelector('.monk-annotation-quote').textContent = n.quote;
          ann.querySelector('.monk-annotation-meta').textContent = n.date + (n.page ? ' \u00b7 p. ' + n.page : '');
          if (n.note) ann.querySelector('.monk-annotation-note').textContent = n.note;
          ann.querySelector('.ann-remove').addEventListener('click', function () {
            cache.bookNotes = cache.bookNotes.filter(function (x) { return x !== n; });
            renderReading();
            if (n.objectId) deleteInClass('MonkBookNote', n.objectId).catch(function (err) { console.warn('MonkBookNote delete failed:', err.message); });
          });
          notesWrap.appendChild(ann);
        });
      } else {
        notesWrap.innerHTML = '<p class="monk-empty">No quotes or notes saved yet.</p>' + notesWrap.innerHTML;
      }

      card.querySelector('.note-add').addEventListener('click', function () {
        var quoteInput = card.querySelector('.note-quote');
        var pageInput = card.querySelector('.note-page');
        var noteInput = card.querySelector('.note-note');
        var quote = quoteInput.value.trim();
        var note = noteInput.value.trim();
        if (!quote && !note) return;
        var entry = { book: b, quote: quote, page: pageInput.value.trim(), note: note, date: todayStr };
        cache.bookNotes.push(entry);
        logActivity('reading', b.title);
        renderReading();
        ensureBookPersisted(b, function () {
          userCreateInClass('MonkBookNote', { bookId: b.objectId, quote: entry.quote, page: entry.page, note: entry.note, date: entry.date })
            .then(function (res) { entry.objectId = res.objectId; })
            .catch(function (err) { console.warn('MonkBookNote save failed:', err.message); });
        });
      });

      card.querySelector('.monk-book-remove').addEventListener('click', function () {
        var removedNotes = cache.bookNotes.filter(function (n) { return n.book === b; });
        cache.books = cache.books.filter(function (x) { return x !== b; });
        cache.bookNotes = cache.bookNotes.filter(function (n) { return n.book !== b; });
        renderReading();
        if (b.objectId) deleteInClass('MonkBook', b.objectId).catch(function (err) { console.warn('MonkBook delete failed:', err.message); });
        removedNotes.forEach(function (n) {
          if (n.objectId) deleteInClass('MonkBookNote', n.objectId).catch(function (err) { console.warn('MonkBookNote delete failed:', err.message); });
        });
      });

      wrap.appendChild(card);
    });
  }

  $id('book-add').addEventListener('click', function () {
    var titleInput = $id('book-title-input');
    var authorInput = $id('book-author-input');
    var title = titleInput.value.trim();
    if (!title) return;
    var entry = { title: title, author: authorInput.value.trim(), status: BOOK_STATUSES[0], open: true };
    cache.books.push(entry);
    titleInput.value = '';
    authorInput.value = '';
    renderReading();
    ensureBookPersisted(entry, function () {});
  });

  /* ---------------- CRAFT ---------------- */

  var currentCraft = '';

  function renderCraftGroups() {
    var wrap = $id('craft-groups');
    wrap.innerHTML = '';
    Object.keys(MONK.craft).forEach(function (cat) {
      var group = document.createElement('div');
      group.className = 'monk-group';
      group.innerHTML = '<p class="monk-group-title">' + cat + '</p><div class="monk-tag-row"></div>';
      var row = group.querySelector('.monk-tag-row');
      MONK.craft[cat].forEach(function (item) {
        var tag = document.createElement('button');
        tag.className = 'monk-tag';
        tag.textContent = item;
        var tagBusy = false;
        tag.addEventListener('click', function () {
          if (tagBusy) return;
          tagBusy = true;
          tag.classList.add('done');
          logActivity('craft', item);
        });
        row.appendChild(tag);
      });
      wrap.appendChild(group);
    });
  }

  function pickCraft() {
    var pick = bags.craft();
    currentCraft = pick.item;
    $id('craft-prompt').textContent = pick.cat + ': ' + pick.item;
  }
  $id('craft-new').addEventListener('click', pickCraft);
  withConfirmation($id('craft-done'), function () {
    if (!currentCraft) { pickCraft(); return; }
    logActivity('craft', currentCraft);
  });

  /* ---------------- SOURDOUGH ---------------- */

  function renderSourdough() {
    renderSourdoughLog();
    renderRecipeTagList('sourdough-discard-tags', MONK.sourdoughDiscardRecipes, 'sourdough-discard', renderSourdough);
    renderRecipeTagList('sourdough-recipe-tags', MONK.sourdoughRecipes, 'sourdough-recipe', renderSourdough);
  }

  function renderSourdoughLog() {
    var lastEl = $id('sourdough-last-fed');
    if (cache.sourdoughLog.length) {
      var last = cache.sourdoughLog[cache.sourdoughLog.length - 1];
      var daysSince = Math.round((new Date(todayStr) - new Date(last.date)) / 86400000);
      var when = daysSince <= 0 ? 'today' : daysSince === 1 ? 'yesterday' : daysSince + ' days ago';
      lastEl.textContent = 'Last fed ' + when + '.';
    } else {
      lastEl.textContent = 'No feedings logged yet.';
    }

    var wrap = $id('sourdough-log-entries');
    wrap.innerHTML = '';
    if (!cache.sourdoughLog.length) { wrap.innerHTML = '<p class="monk-empty">No feedings yet.</p>'; return; }
    cache.sourdoughLog.slice().reverse().slice(0, 20).forEach(function (f) {
      var div = document.createElement('div');
      div.className = 'monk-entry';
      div.innerHTML = '<p class="monk-entry-date"></p><p class="monk-entry-body"></p>';
      div.querySelector('.monk-entry-date').textContent = f.date;
      div.querySelector('.monk-entry-body').textContent = f.note || 'Fed.';
      wrap.appendChild(div);
    });
  }

  $id('sourdough-log').addEventListener('click', function () {
    var noteInput = $id('sourdough-note-input');
    var entry = { date: todayStr, note: noteInput.value.trim() };
    cache.sourdoughLog.push(entry);
    noteInput.value = '';
    renderSourdoughLog();
    logActivity('sourdough-feed', entry.note);
    userCreateInClass('MonkSourdoughFeeding', entry).then(function (res) { entry.objectId = res.objectId; })
      .catch(function (err) { console.warn('MonkSourdoughFeeding save failed:', err.message); });
  });

  // Shared by Sourdough's two recipe lists and Tea's blend list: a
  // row of tags. Clicking one opens the full recipe in a popup
  // rather than marking it tried right away. "Tried" and "removed"
  // are both tracked as MonkActivity rows (same mechanism as Craft),
  // keyed by the recipe's title, so no new schema is needed for
  // either. `onChange` re-renders whichever list called this, and
  // the label args let the modal say "Blend"/"Steeping" for Tea
  // instead of "Ingredients"/"Method".
  function renderRecipeTagList(wrapId, recipes, category, onChange, ingredientsLabel, stepsLabel) {
    var wrap = $id(wrapId);
    wrap.innerHTML = '';
    var tried = {}, removed = {};
    cache.activities.forEach(function (a) {
      if (a.category === category) tried[a.label] = true;
      if (a.category === category + '-removed') removed[a.label] = true;
    });
    var visible = recipes.filter(function (r) { return !removed[r.title]; });
    if (!visible.length) {
      wrap.innerHTML = '<p class="monk-empty">Nothing left on this list. Everything here has been removed.</p>';
      return;
    }
    visible.forEach(function (recipe) {
      var tag = document.createElement('button');
      tag.className = 'monk-tag' + (tried[recipe.title] ? ' done' : '');
      tag.textContent = recipe.title;
      tag.addEventListener('click', function () {
        openRecipeModal(recipe, category, !!tried[recipe.title], onChange, ingredientsLabel, stepsLabel);
      });
      wrap.appendChild(tag);
    });
  }

  function openRecipeModal(recipe, category, alreadyTried, onChange, ingredientsLabel, stepsLabel) {
    var html =
      '<h2></h2>' +
      '<h3>' + (ingredientsLabel || 'Ingredients') + '</h3><ul></ul>' +
      '<h3>' + (stepsLabel || 'Method') + '</h3><ol></ol>' +
      '<div class="monk-modal-actions">' +
      '<button class="monk-btn primary" id="modal-tried-btn"></button>' +
      '<button class="monk-quiet-link" id="modal-remove-btn">Remove from list</button>' +
      '</div>';
    openModal(html);
    modalBody.querySelector('h2').textContent = recipe.title;
    var ul = modalBody.querySelector('ul');
    recipe.ingredients.forEach(function (i) {
      var li = document.createElement('li');
      li.textContent = i;
      ul.appendChild(li);
    });
    var ol = modalBody.querySelector('ol');
    recipe.steps.forEach(function (s) {
      var li = document.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    });

    var triedBtn = modalBody.querySelector('#modal-tried-btn');
    var tried = alreadyTried;
    triedBtn.textContent = tried ? 'Tried \u2713' : 'Mark as Tried';
    triedBtn.disabled = tried;
    triedBtn.addEventListener('click', function () {
      if (tried) return;
      tried = true;
      logActivity(category, recipe.title);
      triedBtn.textContent = 'Tried \u2713';
      triedBtn.disabled = true;
      renderProgress();
      if (onChange) onChange();
    });

    modalBody.querySelector('#modal-remove-btn').addEventListener('click', function () {
      logActivity(category + '-removed', recipe.title);
      closeModal();
      if (onChange) onChange();
    });
  }

  /* ---------------- TEA ---------------- */

  function renderTea() {
    renderRecipeTagList('tea-tags', MONK.teaBlends, 'tea-blend', renderTea, 'Blend', 'Steeping');
  }

  /* ---------------- WATCHLIST ---------------- */

  function renderWatchlist() {
    var ul = $id('watch-list');
    ul.innerHTML = '';
    if (!cache.watchlist.length) {
      ul.innerHTML = '<li class="monk-empty" style="border:none">Nothing on the list yet.</li>';
      return;
    }
    cache.watchlist.forEach(function (w) {
      var li = document.createElement('li');
      li.className = 'row';
      li.innerHTML =
        '<label><input type="checkbox"' + (w.watched ? ' checked' : '') + '><span></span></label>' +
        '<button class="monk-quiet-link">Remove</button>';
      li.querySelector('span').textContent = w.title + (w.note ? ': ' + w.note : '');

      li.querySelector('input').addEventListener('change', function (e) {
        w.watched = e.target.checked;
        ensureWatchlistPersisted(w, function () {
          updateInClass('MonkWatchlistItem', w.objectId, { watched: w.watched }).catch(function (err) { console.warn('MonkWatchlistItem update failed:', err.message); });
        });
        if (w.watched) logActivity('watchlist', w.title);
        renderWatchlist();
      });

      li.querySelector('.monk-quiet-link').addEventListener('click', function () {
        var hadId = w.objectId;
        cache.watchlist = cache.watchlist.filter(function (x) { return x !== w; });
        renderWatchlist();
        if (hadId) deleteInClass('MonkWatchlistItem', hadId).catch(function (err) { console.warn('MonkWatchlistItem delete failed:', err.message); });
      });

      ul.appendChild(li);
    });
  }

  // Starter suggestions live only in memory until you actually touch
  // one, then it's saved for real, same as anything you add yourself.
  function ensureWatchlistPersisted(w, afterSaved) {
    if (w.objectId) { afterSaved(); return; }
    userCreateInClass('MonkWatchlistItem', { title: w.title, note: w.note, watched: w.watched }).then(function (res) {
      w.objectId = res.objectId;
      afterSaved();
    }).catch(function (err) { console.warn('MonkWatchlistItem create failed:', err.message); });
  }

  $id('watch-add').addEventListener('click', function () {
    var titleInput = $id('watch-title-input');
    var noteInput = $id('watch-note-input');
    var title = titleInput.value.trim();
    if (!title) return;
    var entry = { title: title, note: noteInput.value.trim(), watched: false };
    cache.watchlist.push(entry);
    titleInput.value = '';
    noteInput.value = '';
    renderWatchlist();
    userCreateInClass('MonkWatchlistItem', entry).then(function (res) { entry.objectId = res.objectId; })
      .catch(function (err) { console.warn('MonkWatchlistItem save failed:', err.message); });
  });

  $id('watch-surprise').addEventListener('click', function () {
    var el = $id('watch-suggestion');
    var unwatched = cache.watchlist.filter(function (w) { return !w.watched; });
    if (!unwatched.length) {
      el.textContent = 'Nothing waiting, add something above.';
    } else {
      var pick = unwatched[Math.floor(Math.random() * unwatched.length)];
      el.textContent = '"' + pick.title + '"' + (pick.note ? ': ' + pick.note : '');
    }
    el.style.display = 'block';
  });

  /* ---------------- STEWARDSHIP LISTS ---------------- */

  // A running reference of mending techniques, seeded with common
  // ones the first time so it isn't empty, but entirely yours to
  // reshape from there.
  function seedStitchTypes() {
    ['Running stitch', 'Backstitch', 'Whip stitch', 'Blanket stitch', 'Darning', 'Patch', 'Button reattachment', 'Hem repair']
      .forEach(function (label, i) {
        var entry = { label: label, order: i };
        cache.stitchTypes.push(entry);
        (isAdminLoggedIn() ? userCreateInClass('MonkStitchType', entry) : Promise.resolve({})).then(function (res) { entry.objectId = res.objectId; })
          .catch(function (err) { console.warn('MonkStitchType seed failed:', err.message); });
      });
  }

  function renderStitchList() {
    var ul = $id('stitch-list');
    ul.innerHTML = '';
    if (!cache.stitchTypes.length) {
      ul.innerHTML = '<li class="monk-empty" style="border:none">Nothing here yet.</li>';
      return;
    }
    cache.stitchTypes.forEach(function (s) {
      var li = document.createElement('li');
      li.innerHTML = '<span></span><button class="monk-quiet-link">Remove</button>';
      li.querySelector('span').textContent = s.label;
      li.querySelector('.monk-quiet-link').addEventListener('click', function () {
        cache.stitchTypes = cache.stitchTypes.filter(function (x) { return x !== s; });
        renderStitchList();
        if (s.objectId) deleteInClass('MonkStitchType', s.objectId).catch(function (err) { console.warn('MonkStitchType delete failed:', err.message); });
      });
      ul.appendChild(li);
    });
  }

  // Give Away is deliberately not a checklist you tick and forget --
  // marking something given removes it from the list and adds to a
  // lifetime tally that only ever goes up.
  function renderGiveawayList() {
    var ul = $id('giveaway-list');
    ul.innerHTML = '';
    var lifetime = cache.activities.filter(function (a) { return a.category === 'gave-away'; }).length;
    $id('giveaway-stats').textContent = lifetime
      ? (lifetime + ' thing' + (lifetime === 1 ? '' : 's') + ' given away so far.')
      : 'Nothing given away yet. That number only goes up from here.';
    if (!cache.giveaways.length) {
      ul.innerHTML = '<li class="monk-empty" style="border:none">Nothing on the list.</li>';
      return;
    }
    cache.giveaways.forEach(function (g) {
      var li = document.createElement('li');
      li.className = 'row';
      li.innerHTML =
        '<span class="monk-giveaway-text"></span>' +
        '<span class="monk-giveaway-actions"><button class="monk-quiet-link" data-act="given">Given Away</button><button class="monk-quiet-link" data-act="remove">Remove</button></span>';
      li.querySelector('.monk-giveaway-text').textContent = g.text;
      li.querySelector('[data-act="given"]').addEventListener('click', function () {
        logActivity('gave-away', g.text);
        cache.giveaways = cache.giveaways.filter(function (x) { return x !== g; });
        renderGiveawayList();
        renderProgress();
        if (g.objectId) deleteInClass('MonkGiveaway', g.objectId).catch(function (err) { console.warn('MonkGiveaway delete failed:', err.message); });
      });
      li.querySelector('[data-act="remove"]').addEventListener('click', function () {
        cache.giveaways = cache.giveaways.filter(function (x) { return x !== g; });
        renderGiveawayList();
        if (g.objectId) deleteInClass('MonkGiveaway', g.objectId).catch(function (err) { console.warn('MonkGiveaway delete failed:', err.message); });
      });
      ul.appendChild(li);
    });
  }

  function renderStewardshipLists() {
    renderStitchList();
    renderGiveawayList();
  }

  function wireStewardshipLists() {
    $id('stitch-add').addEventListener('click', function () {
      var input = $id('stitch-input');
      var label = input.value.trim();
      if (!label) return;
      var entry = { label: label, order: cache.stitchTypes.length };
      cache.stitchTypes.push(entry);
      input.value = '';
      renderStitchList();
      (isAdminLoggedIn() ? userCreateInClass('MonkStitchType', entry) : Promise.resolve({})).then(function (res) { entry.objectId = res.objectId; })
        .catch(function (err) { console.warn('MonkStitchType create failed:', err.message); });
    });
    $id('giveaway-add').addEventListener('click', function () {
      var input = $id('giveaway-input');
      var text = input.value.trim();
      if (!text) return;
      var entry = { text: text, order: cache.giveaways.length };
      cache.giveaways.push(entry);
      input.value = '';
      renderGiveawayList();
      userCreateInClass('MonkGiveaway', entry).then(function (res) { entry.objectId = res.objectId; })
        .catch(function (err) { console.warn('MonkGiveaway create failed:', err.message); });
    });
  }

  /* ---------------- ATTENTION ---------------- */

  function renderAttention() {
    ['reached', 'noticed', 'focused'].forEach(function (type) {
      var count = cache.activities.filter(function (a) {
        return a.category === 'attention-' + type && a.date >= daysAgo(6);
      }).length;
      $id('attn-n-' + type).textContent = count;
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.monk-counter-btn'), function (btn) {
    btn.addEventListener('click', function () {
      var type = btn.getAttribute('data-attn');
      logActivity('attention-' + type, '');
      renderAttention();
      if (type === 'reached') suggestBookmark();
    });
  });

  // First time ever (no bookmarks saved), seed the two things
  // mentioned when this feature was being planned, rather than
  // leaving the list empty.
  function seedBookmarks() {
    [{ label: 'Radio Garden', url: 'https://radio.garden' }, { label: 'The New York Times', url: 'https://www.nytimes.com' }]
      .forEach(function (b, i) {
        var entry = { label: b.label, url: b.url, order: i };
        cache.bookmarks.push(entry);
        (isAdminLoggedIn() ? userCreateInClass('MonkBookmark', entry) : Promise.resolve({})).then(function (res) { entry.objectId = res.objectId; })
          .catch(function (err) { console.warn('MonkBookmark seed failed:', err.message); });
      });
  }

  function suggestBookmark() {
    var el = $id('attn-redirect');
    if (!cache.bookmarks.length) { el.style.display = 'none'; return; }
    var pick = cache.bookmarks[Math.floor(Math.random() * cache.bookmarks.length)];
    el.innerHTML = 'Try instead: <a href="' + escapeHtml(pick.url) + '" target="_blank" rel="noopener">' + escapeHtml(pick.label) + '</a>';
    el.style.display = 'block';
  }

  function renderBookmarks() {
    var ul = $id('attn-bookmarks');
    ul.innerHTML = '';
    if (!cache.bookmarks.length) {
      ul.innerHTML = '<li class="monk-empty" style="border:none">Nothing here yet.</li>';
      return;
    }
    cache.bookmarks.forEach(function (b) {
      var li = document.createElement('li');
      li.innerHTML =
        '<a target="_blank" rel="noopener"></a>' +
        '<button class="monk-quiet-link">Remove</button>';
      var a = li.querySelector('a');
      a.href = b.url;
      a.textContent = b.label;
      li.querySelector('.monk-quiet-link').addEventListener('click', function () {
        cache.bookmarks = cache.bookmarks.filter(function (x) { return x !== b; });
        renderBookmarks();
        if (b.objectId) deleteInClass('MonkBookmark', b.objectId).catch(function (err) { console.warn('MonkBookmark delete failed:', err.message); });
      });
      ul.appendChild(li);
    });
  }

  function wireBookmarkInteractions() {
    $id('attn-bookmark-add').addEventListener('click', function () {
      var labelInput = $id('attn-bookmark-label');
      var urlInput = $id('attn-bookmark-url');
      var label = labelInput.value.trim();
      var url = urlInput.value.trim();
      if (!label || !url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      var entry = { label: label, url: url, order: cache.bookmarks.length };
      cache.bookmarks.push(entry);
      labelInput.value = '';
      urlInput.value = '';
      renderBookmarks();
      (isAdminLoggedIn() ? userCreateInClass('MonkBookmark', entry) : Promise.resolve({})).then(function (res) { entry.objectId = res.objectId; })
        .catch(function (err) { console.warn('MonkBookmark create failed:', err.message); });
    });
  }

  /* ---------------- JOURNAL ---------------- */

  function renderJournalEntries() {
    var wrap = $id('journal-entries');
    wrap.innerHTML = '';
    if (!cache.journalEntries.length) { wrap.innerHTML = '<p class="monk-empty">No entries yet.</p>'; return; }
    cache.journalEntries.slice().reverse().forEach(function (j) {
      var div = document.createElement('div');
      div.className = 'monk-entry';
      div.innerHTML = '<p class="monk-entry-date">' + j.date + '</p><p class="monk-entry-body"></p>';
      div.querySelector('.monk-entry-body').textContent = j.text;
      wrap.appendChild(div);
    });
  }
  $id('journal-save').addEventListener('click', function () {
    var textarea = $id('journal-text');
    var text = textarea.value.trim();
    if (!text) return;
    var entry = { date: todayStr, text: text };
    cache.journalEntries.push(entry);
    textarea.value = '';
    renderJournalEntries();
    renderHome();
    renderProgress();
    userCreateInClass('MonkJournalEntry', entry).catch(function (err) { console.warn('MonkJournalEntry save failed:', err.message); });
  });

  /* ---------------- PROGRESS ---------------- */

  function renderProgress() {
    var checklistCompleted = 0;
    Object.keys(cache.days).forEach(function (d) {
      var day = cache.days[d];
      checklistCompleted += (day.morningItems || []).length + (day.eveningItems || []).length;
    });
    var craftsCompleted = cache.activities.filter(function (a) { return a.category === 'craft'; }).length;
    var journalCount = cache.journalEntries.length;
    var stewardshipCount = cache.activities.filter(function (a) { return a.category === 'stewardship'; }).length;
    var givenAwayCount = cache.activities.filter(function (a) { return a.category === 'gave-away'; }).length;
    var observationDays = {};
    cache.placeNotes.forEach(function (n) { observationDays[n.date] = true; });
    var observationDayCount = Object.keys(observationDays).length;
    var joyCount = cache.activities.filter(function (a) { return a.category === 'joy'; }).length;
    var solitudeCount = cache.activities.filter(function (a) { return a.category === 'solitude'; }).length;
    var booksFinished = cache.activities.filter(function (a) { return a.category === 'book-finished'; }).length;
    var passagesSaved = cache.bookNotes.length;
    var sitsCompleted = cache.activities.filter(function (a) { return a.category === 'meditation'; }).length;
    var minutesMeditated = cache.activities
      .filter(function (a) { return a.category === 'meditation'; })
      .reduce(function (sum, a) { return sum + sitMinutesFromLabel(a.label); }, 0);
    var malaRounds = cache.activities.filter(function (a) { return a.category === 'mala-round'; }).length;
    var contemplationsWritten = cache.dharmaEntries.length;
    var movementCompletions = cache.activities.filter(function (a) { return a.category === 'movement'; }).length;
    var teaBlendsTried = cache.activities.filter(function (a) { return a.category === 'tea-blend'; }).length;

    var rows = [
      ['Checklist items completed', checklistCompleted],
      ['Crafts completed', craftsCompleted],
      ['Journal entries', journalCount],
      ['Acts of stewardship', stewardshipCount],
      ['Given away', givenAwayCount],
      ['Observation days', observationDayCount],
      ['Joy moments', joyCount],
      ['Solitude practices', solitudeCount],
      ['Books finished', booksFinished],
      ['Passages saved', passagesSaved],
      ['Sits completed', sitsCompleted],
      ['Minutes meditated', minutesMeditated],
      ['Mala rounds completed', malaRounds],
      ['Contemplations written', contemplationsWritten],
      ['Movement routines completed', movementCompletions],
      ['Tea blends tried', teaBlendsTried]
    ];
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));

    var wrap = $id('progress-bars');
    wrap.innerHTML = rows.map(function (r) {
      var pct = Math.round((r[1] / max) * 100);
      return '<div class="monk-progress-row">' +
        '<div class="monk-progress-label"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>' +
        '<div class="monk-progress-track"><div class="monk-progress-fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- init ---------------- */

  function init() {
    Promise.all([
      userFetchClass('MonkDay').catch(function () { return []; }),
      userFetchClass('MonkPlaceNote', 'date').catch(function () { return []; }),
      userFetchClass('MonkJournalEntry', 'date').catch(function () { return []; }),
      userFetchClass('MonkActivity', 'date').catch(function () { return []; }),
      userFetchClass('MonkSourdoughFeeding', 'date').catch(function () { return []; }),
      userFetchClass('MonkWatchlistItem').catch(function () { return []; }),
      userFetchClass('MonkBook').catch(function () { return []; }),
      userFetchClass('MonkBookNote', 'date').catch(function () { return []; }),
      userFetchClass('MonkDharmaEntry', 'date').catch(function () { return []; }),
      userFetchClass('MonkLearningNode').catch(function () { return []; }),
      userFetchClass('MonkEvent', 'startDate').catch(function () { return []; }),
      userFetchClass('MonkTodo').catch(function () { return []; }),
      userFetchClass('MonkRhythmItem', 'order').catch(function () { return []; }),
      userFetchClass('MonkBookmark', 'order').catch(function () { return []; }),
      userFetchClass('MonkKanbanCard', 'order').catch(function () { return []; }),
      userFetchClass('MonkStitchType', 'order').catch(function () { return []; }),
      userFetchClass('MonkGiveaway', 'order').catch(function () { return []; })
    ]).then(function (results) {
      var days = results[0], placeNotes = results[1], journalEntries = results[2], activities = results[3];
      var sourdoughLog = results[4], watchlist = results[5];
      var books = results[6], bookNotes = results[7];
      var dharmaEntries = results[8], learningNodes = results[9], events = results[10], todos = results[11], rhythmItems = results[12], bookmarks = results[13];
      var kanbanCards = results[14], stitchTypes = results[15], giveaways = results[16];
      days.forEach(function (row) {
        cache.days[row.date] = {
          objectId: row.objectId,
          date: row.date,
          morningItems: row.morningItems || [],
          eveningItems: row.eveningItems || [],
          preceptItems: row.preceptItems || []
        };
      });
      cache.placeNotes = placeNotes.map(function (r) { return { objectId: r.objectId, date: r.date, prompt: r.prompt, note: r.note }; });
      cache.journalEntries = journalEntries.map(function (r) { return { objectId: r.objectId, date: r.date, text: r.text }; });
      cache.activities = activities.map(function (r) { return { objectId: r.objectId, date: r.date, category: r.category, label: r.label }; });
      cache.sourdoughLog = sourdoughLog.map(function (r) { return { objectId: r.objectId, date: r.date, note: r.note || '' }; });
      // Fresh installs get the starter suggestions; once anything's
      // been added, only the user's own saved items are shown.
      cache.watchlist = watchlist.length
        ? watchlist.map(function (r) { return { objectId: r.objectId, title: r.title, note: r.note || '', watched: !!r.watched }; })
        : MONK.watchlistStarter.map(function (w) { return { title: w.title, note: w.note, watched: false }; });

      cache.books = books.map(function (r) { return { objectId: r.objectId, title: r.title, author: r.author || '', status: r.status || BOOK_STATUSES[0], open: false }; });
      cache.bookNotes = bookNotes.map(function (r) {
        var parent = cache.books.filter(function (b) { return b.objectId === r.bookId; })[0];
        return parent ? { objectId: r.objectId, book: parent, quote: r.quote || '', page: r.page || '', note: r.note || '', date: r.date } : null;
      }).filter(function (n) { return n; });
      cache.dharmaEntries = dharmaEntries.map(function (r) { return { objectId: r.objectId, date: r.date, prompt: r.prompt, note: r.note }; });
      cache.learningNodes = learningNodes.map(function (r) {
        return {
          objectId: r.objectId,
          type: r.type,
          parentId: r.parentId || '',
          title: r.title || '',
          body: r.body || '',
          photoUrl: r.photoUrl || '',
          photoName: r.photoName || '',
          colorMode: r.colorMode || 'bw',
          sketchStrokes: r.sketchStrokes || '[]',
          x: typeof r.x === 'number' ? r.x : null,
          y: typeof r.y === 'number' ? r.y : null
        };
      });
      cache.events = events.map(function (r) {
        var startDate = r.startDate || r.date || '';
        return {
          objectId: r.objectId,
          title: r.title || '',
          location: r.location || '',
          allDay: !!r.allDay,
          startDate: startDate,
          endDate: r.endDate || startDate,
          startTime: r.startTime || '',
          endTime: r.endTime || '',
          description: r.description || r.notes || ''
        };
      });
      cache.todos = todos.map(function (r) {
        return { objectId: r.objectId, text: r.text || '', done: !!r.done };
      });
      var loadedRhythm = rhythmItems.map(function (r) {
        return { objectId: r.objectId, period: r.period || 'morning', label: r.label || '', order: typeof r.order === 'number' ? r.order : 0 };
      });
      cache.rhythmItems.morning = loadedRhythm.filter(function (r) { return r.period === 'morning'; });
      cache.rhythmItems.evening = loadedRhythm.filter(function (r) { return r.period === 'evening'; });
      if (!loadedRhythm.length) seedRhythmItems();
      cache.bookmarks = bookmarks.map(function (r) {
        return { objectId: r.objectId, label: r.label || '', url: r.url || '', order: typeof r.order === 'number' ? r.order : 0 };
      });
      if (!cache.bookmarks.length) seedBookmarks();
      cache.kanbanCards = kanbanCards.map(function (r) {
        return { objectId: r.objectId, text: r.text || '', column: r.column || 'todo', order: typeof r.order === 'number' ? r.order : 0 };
      });
      cache.stitchTypes = stitchTypes.map(function (r) {
        return { objectId: r.objectId, label: r.label || '', order: typeof r.order === 'number' ? r.order : 0 };
      });
      if (!cache.stitchTypes.length) seedStitchTypes();
      cache.giveaways = giveaways.map(function (r) {
        return { objectId: r.objectId, text: r.text || '', order: typeof r.order === 'number' ? r.order : 0 };
      });
    }).catch(function (err) {
      // Only catches problems loading/parsing the fetched data above.
      // renderAll() itself is called exactly once below regardless of
      // which branch ran, so a hiccup here can never double-wire buttons.
      console.warn('Could not load from Back4App, starting with an empty session:', err.message);
    }).then(function () {
      renderAll();
    });
  }

  function renderAll() {
    renderHome();
    wireHomeInteractions();
    wireHomeTodoInteractions();
    renderRhythm();
    wireRhythmInteractions();
    renderMovement();
    renderCalendar();
    wireCalInteractions();
    renderKanban();
    wireWorkInteractions();
    renderDharma();
    wireDharmaInteractions();
    renderPlacePrompt();
    renderPlaceEntries();
    wireRandomCard('presence-prompt', 'presence-new', 'presence-done', bags.presence, 'presence');
    wireRandomCard('solitude-prompt', 'solitude-new', 'solitude-done', bags.solitude, 'solitude');
    wireRandomCard('humility-prompt', 'humility-new', null, bags.humility, 'humility');
    wireRandomCard('stewardship-prompt', 'stewardship-new', 'stewardship-done', bags.stewardship, 'stewardship');
    renderStewardshipLists();
    wireStewardshipLists();
    wireRandomCard('joy-prompt', 'joy-new', 'joy-done', bags.joy, 'joy');
    renderLearning();
    renderReading();
    renderCraftGroups();
    pickCraft();
    renderSourdough();
    renderTea();
    renderWatchlist();
    renderAttention();
    renderBookmarks();
    wireBookmarkInteractions();
    renderJournalEntries();
    renderProgress();
    var wanted = location.hash.slice(1);
    showSection(document.getElementById(wanted) && wanted.indexOf('sec-') === 0 ? wanted : sections[0].id);
  }

  /* ---------------- site login ---------------- */
  // No separate account. The pages open for whoever is signed in on the
  // site (Admin), and show a short prompt for everyone else.

  // Anyone can look around. Editing needs the Admin sign-in, and the
  // journal stays private, so it is replaced by a short prompt when signed out.
  var gateEl = $id('monk-gate');
  var shellEl = $id('monk-shell');
  shellEl.style.display = 'block';
  if (!isAdminLoggedIn()) {
    gateEl.hidden = false;
    var journalSec = document.getElementById('sec-journal');
    if (journalSec) {
      journalSec.innerHTML = '<p class="monk-eyebrow">Journal</p><h1 class="monk-h1">Journal</h1>' +
        '<p class="monk-lede">The journal is private. <a href="#" id="journal-signin-link" style="text-decoration:underline">Sign in</a> to open it.</p>';
      var jl = document.getElementById('journal-signin-link');
      if (jl) jl.addEventListener('click', function (e) { e.preventDefault(); goToAdminSignIn(); });
    }
  }
  init();
})();