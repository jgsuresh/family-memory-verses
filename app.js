(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var sb = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  var KEY_CACHE = "mv2-cache", KEY_QUEUE = "mv2-queue", KEY_UI = "mv2-ui";

  var state = {
    user: null, lists: [], verses: [], reviews: [], activity: [],
    view: "learn", list: "boys", filter: "all", reveal: {}, renaming: false,
    session: null, loaded: false, authError: "", sync: ""
  };
  var queue = [], flushing = false, dirty = false, toastTimer, pullTimer;
  // Invite and password-reset emails land here with a token in the URL; ask for a new password.
  state.settingPw = /type=(recovery|invite)/.test(location.hash);

  // ---------- tiny helpers ----------
  function $(id) { return document.getElementById(id); }
  function h(tag, props) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === "class") n.className = props[k];
      else if (k === "text") n.textContent = props[k];
      else if (k.slice(0, 2) === "on") n[k] = props[k];
      else if (k === "disabled" || k === "hidden") n[k] = !!props[k];
      else n.setAttribute(k, props[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }
  function jget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }
  function byOrd(a, b) { return a.ord - b.ord; }
  function nowIso() { return new Date().toISOString(); }
  function hintOf(text) { return text.replace(/([A-Za-z0-9])[A-Za-z0-9’'\-]*/g, "$1"); }

  // ---------- data layer ----------
  var VERSE_COLS = ["id", "list_id", "ord", "label", "ref", "body", "status", "review", "custom", "updated_at"];
  function verseRow(v) { var r = {}; VERSE_COLS.forEach(function (c) { r[c] = v[c]; }); return r; }
  function listRow(l) { return { id: l.id, name: l.name, ord: l.ord, current_verse: l.current_verse || null }; }

  function persist() { jset(KEY_CACHE, { lists: state.lists, verses: state.verses, reviews: state.reviews, activity: state.activity, uid: state.user && state.user.id }); }
  function saveQueue() { jset(KEY_QUEUE, queue); }

  function enqueue(op) {
    if (!sb) return;
    queue.push(op); saveQueue(); flush();
  }
  function up(table, row) { enqueue({ t: "up", table: table, row: row }); }
  function del(table, key) { enqueue({ t: "del", table: table, key: key }); }

  async function flush() {
    if (!sb || flushing || !state.user) return;
    flushing = true;
    try {
      while (queue.length) {
        var op = queue[0], res;
        try {
          res = op.t === "up" ? await sb.from(op.table).upsert(op.row) : await sb.from(op.table).delete().match(op.key);
        } catch (e) { res = { error: { message: "network " + e.message } }; }
        if (res.error) {
          var offline = !navigator.onLine || /fetch|network|timeout/i.test(res.error.message || "");
          if (offline) break;
          console.error("dropping write", op, res.error);
          toast("One change couldn't be saved.");
        }
        queue.shift(); saveQueue();
      }
    } finally { flushing = false; setSync(); }
  }

  function setSync() {
    if (!sb) state.sync = "Saved on this device only";
    else if (!navigator.onLine) state.sync = "Offline" + (queue.length ? " · " + queue.length + " waiting" : "");
    else state.sync = queue.length ? "Saving…" : "Synced";
    var s = $("sync"); if (s) s.textContent = state.sync;
  }

  async function pull() {
    if (!sb || !state.user || queue.length) return;
    var r = await Promise.all([sb.from("lists").select("*"), sb.from("verses").select("*"), sb.from("reviews").select("*"),
      sb.from("activity").select("*").gte("day", weekStart())]);
    if (r[0].error || r[1].error || r[2].error) { setSync(); return; }
    if (!r[3].error) state.activity = r[3].data;      // goal bar just stays empty if this table isn't set up yet
    state.lists = r[0].data; state.verses = r[1].data.map(function (v) { v.ord = Number(v.ord); return v; }); state.reviews = r[2].data;
    if (!state.lists.length && !state.verses.length) seed();
    ensureReviews(); persist(); state.loaded = true; setSync(); render();
  }
  // ---------- shared weekly goal ----------
  var WEEKLY_GOAL = 10;   // reviews + newly memorized verses, both of you combined
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function weekStart() { var d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }   // Monday
  function myName() { var w = ((state.user && state.user.email) || "").split("@")[0].split(/[._\d]+/)[0] || "You"; return w.charAt(0).toUpperCase() + w.slice(1); }
  function logActivity() {
    if (!state.user) return;
    var day = ymd(new Date()), row = state.activity.filter(function (a) { return a.user_id === state.user.id && a.day === day; })[0];
    if (!row) { row = { user_id: state.user.id, day: day, who: myName(), count: 0 }; state.activity.push(row); }
    row.count += 1; row.who = myName();
    up("activity", { user_id: row.user_id, day: row.day, who: row.who, count: row.count });
  }
  function weekTotals() {
    var ws = weekStart(), mine = 0, other = 0, otherName = "";
    state.activity.forEach(function (a) {
      if (a.day < ws) return;
      if (state.user && a.user_id === state.user.id) mine += a.count; else { other += a.count; otherName = a.who || otherName; }
    });
    return { mine: mine, other: other, otherName: otherName || "Your partner" };
  }
  function schedulePull() { clearTimeout(pullTimer); pullTimer = setTimeout(pull, 400); }

  function seed() {
    var S = window.SEED;
    state.lists = S.lists.map(function (l) { return Object.assign({}, l); });
    state.verses = S.verses.map(function (v) { return Object.assign({ updated_at: nowIso() }, v); });
    state.lists.forEach(function (l) { up("lists", listRow(l)); });
    state.verses.forEach(function (v) { up("verses", verseRow(v)); });
  }

  // Every memorized verse gets a review row for the signed-in person.
  function ensureReviews() {
    if (!state.user) return;
    var have = {}; state.reviews.forEach(function (r) { have[r.verse_id] = true; });
    state.verses.forEach(function (v) {
      if (v.status === "done" && !have[v.id]) {
        var r = SRS.firstReview(state.user.id, v);
        state.reviews.push(r); up("reviews", r);
      }
    });
  }

  function listById(id) { return state.lists.filter(function (l) { return l.id === id; })[0]; }
  function versesOf(listId) { return state.verses.filter(function (v) { return v.list_id === listId; }).sort(byOrd); }
  function reviewOf(vid) { return state.reviews.filter(function (r) { return r.verse_id === vid; })[0]; }
  function verseById(id) { return state.verses.filter(function (v) { return v.id === id; })[0]; }

  function dueVerses() {
    var now = Date.now();
    return state.reviews
      .filter(function (r) { var v = verseById(r.verse_id); return v && v.status === "done" && new Date(r.due).getTime() <= now; })
      .sort(function (a, b) { return new Date(a.due) - new Date(b.due); })
      .map(function (r) { return r.verse_id; });
  }

  // ---------- mutations ----------
  function setStatus(v, s) {
    if (v.status === s) return;
    v.status = s; v.updated_at = nowIso();
    up("verses", verseRow(v));
    if (s === "done") { ensureReviews(); logActivity(); }
    persist(); render();
  }
  function setCurrent(l, id) { l.current_verse = id; up("lists", listRow(l)); persist(); render(); }
  function addVerse(listId, ref, body, label) {
    var vs = versesOf(listId);
    var v = { id: "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), list_id: listId, ord: vs.length ? vs[vs.length - 1].ord + 1 : 1,
      label: label || "", ref: ref, body: body, status: "todo", review: false, custom: true, updated_at: nowIso() };
    state.verses.push(v); up("verses", verseRow(v)); persist(); render();
  }
  function removeVerse(v) {
    state.verses = state.verses.filter(function (x) { return x.id !== v.id; });
    state.reviews = state.reviews.filter(function (r) { return r.verse_id !== v.id; });
    var l = listById(v.list_id); if (l && l.current_verse === v.id) { l.current_verse = null; up("lists", listRow(l)); }
    del("verses", { id: v.id }); persist(); render();
  }
  function renameList(l, name) { l.name = name; up("lists", listRow(l)); persist(); render(); }

  function gradeCard(vid, g) {
    var r = reviewOf(vid); if (!r) return;
    var n = SRS.nextState(r, g, Date.now());
    Object.assign(r, n); up("reviews", r); logActivity(); persist();
    var s = state.session;
    s.done += 1;
    s.queue.shift();
    if (g === 0) s.queue.push(vid);            // see it again before finishing
    s.mode = "hidden";
    render();
  }

  // ---------- UI pieces ----------
  function verseBlock(v, cls, key) {
    var mode = state.reveal[key] || "hidden";
    var p = h("p", { class: cls });
    if (mode === "full") p.textContent = v.body;
    else if (mode === "hint") { p.textContent = hintOf(v.body); p.className += " hint"; }
    else { p.textContent = "Verse hidden. Say it from memory, then peek if you need to."; p.className += " hidden-v"; }
    var seg = h("div", { class: "seg", role: "group", "aria-label": "How much of " + v.ref + " to show" });
    [["hidden", "Hide"], ["hint", "Hint"], ["full", "Show"]].forEach(function (m) {
      seg.appendChild(h("button", { type: "button", "aria-pressed": mode === m[0] ? "true" : "false", text: m[1],
        onclick: function () { state.reveal[key] = m[0]; render(); } }));
    });
    return h("div", { class: "vt" }, p, seg);
  }
  function statusSeg(v) {
    var seg = h("div", { class: "seg", role: "group", "aria-label": "Progress on " + v.ref });
    [["todo", "Not yet"], ["learning", "Learning"], ["done", "Memorized"]].forEach(function (s) {
      seg.appendChild(h("button", { type: "button", class: "s-" + s[0], "aria-pressed": v.status === s[0] ? "true" : "false", text: s[1],
        onclick: function () { setStatus(v, s[0]); } }));
    });
    return seg;
  }

  function goalCard() {
    var t = weekTotals(), total = t.mine + t.other, met = total >= WEEKLY_GOAL;
    var pct = function (n) { return Math.min(100, n / WEEKLY_GOAL * 100); };
    var mineW = pct(t.mine), otherW = Math.min(pct(t.other), 100 - mineW);
    var tip = "Our week: " + t.mine + " you, " + t.other + " " + t.otherName.toLowerCase() + ". Reviews and newly memorized verses count. Resets Monday.";
    var c = h("div", { class: "goalmini" + (met ? " met" : ""), title: tip, "aria-label": tip },
      h("span", { text: met ? "Our week 🎉" : "Our week" }),
      h("div", { class: "bar goal" }, h("i", { class: "a", style: "width:" + mineW + "%" }), h("i", { class: "b", style: "width:" + otherW + "%" })),
      h("span", { class: "n", text: total + "/" + WEEKLY_GOAL }));
    return c;
  }

  function renderLearn(root) {
    var l = listById(state.list) || state.lists.slice().sort(byOrd)[0];
    if (!l) { root.appendChild(h("p", { class: "note", text: "Loading verses…" })); return; }
    state.list = l.id;
    var tabs = h("div", { class: "tabs", role: "tablist" });
    state.lists.slice().sort(byOrd).forEach(function (x) {
      var vs = versesOf(x.id), d = vs.filter(function (v) { return v.status === "done"; }).length;
      tabs.appendChild(h("button", { type: "button", class: "tab", role: "tab", "aria-selected": x.id === l.id ? "true" : "false",
        onclick: function () { state.list = x.id; state.renaming = false; state.filter = "all"; jset(KEY_UI, { list: x.id }); render(); } },
        h("span", { text: x.name }), h("small", { text: d + "/" + vs.length })));
    });
    root.appendChild(tabs);

    var vs = versesOf(l.id);
    var done = vs.filter(function (v) { return v.status === "done"; }).length;
    var learning = vs.filter(function (v) { return v.status === "learning"; }).length;

    var head = h("div", { class: "top" });
    if (state.renaming) {
      var inp = h("input", { id: "rn", value: l.name, "aria-label": "Name", style: "padding:6px 10px;border:2px solid var(--line);border-radius:10px;background:var(--surface)" });
      inp.value = l.name;
      var f = h("form", { style: "flex-direction:row;margin:0", onsubmit: function (e) {
        e.preventDefault(); state.renaming = false;
        var n = inp.value.trim(); if (n) renameList(l, n); else render();
      } }, inp, h("button", { class: "btn", type: "submit", text: "Save" }));
      head.appendChild(f); setTimeout(function () { inp.focus(); inp.select(); }, 0);
    } else {
      head.appendChild(h("h2", { text: l.name }));
      head.appendChild(h("button", { class: "link", type: "button", text: "Rename", onclick: function () { state.renaming = true; render(); } }));
    }
    root.appendChild(head);

    var pr = h("div");
    var bar = h("div", { class: "bar", role: "img", "aria-label": done + " of " + vs.length + " memorized" },
      h("i", { class: "d", style: "width:" + (vs.length ? done / vs.length * 100 : 0) + "%" }),
      h("i", { class: "l", style: "width:" + (vs.length ? learning / vs.length * 100 : 0) + "%" }));
    var lg = h("div", { class: "legend" });
    [[done, " memorized"], [learning, " learning"], [vs.length - done - learning, " not started"]].forEach(function (x) {
      lg.appendChild(h("span", null, h("b", { text: String(x[0]) }), x[1]));
    });
    pr.appendChild(bar); pr.appendChild(lg); root.appendChild(pr);

    if (l.id === "parents") root.appendChild(goalCard());

    var cur = vs.filter(function (v) { return v.id === l.current_verse; })[0];
    if (cur) {
      var nextV = vs.filter(function (v) { return v.ord > cur.ord && v.status !== "done"; })[0];
      var now = h("div", { class: "now" },
        h("div", { class: "label", text: "This week" + (cur.label ? " · " + cur.label : "") }),
        h("div", { class: "ref", text: cur.ref }),
        verseBlock(cur, "txt", "cur:" + cur.id));
      var row = h("div", { class: "row" });
      row.appendChild(h("button", { class: "btn green", type: "button", text: nextV ? "Memorized, next verse" : "Memorized", onclick: function () {
        setStatus(cur, "done");
        if (nextV) { setCurrent(l, nextV.id); if (nextV.status === "todo") setStatus(nextV, "learning"); }
      } }));
      if (cur.status === "todo") row.appendChild(h("button", { class: "btn ghost", type: "button", text: "Start learning", onclick: function () { setStatus(cur, "learning"); } }));
      row.appendChild(h("button", { class: "btn ghost", type: "button", text: "Clear", onclick: function () { setCurrent(l, null); } }));
      now.appendChild(row); root.appendChild(now);
    }

    var fl = h("div", { class: "filters" });
    [["all", "All " + vs.length], ["open", "To learn " + (vs.length - done)], ["done", "Memorized " + done]].forEach(function (f) {
      fl.appendChild(h("button", { class: "chip", type: "button", text: f[1], "aria-pressed": state.filter === f[0] ? "true" : "false",
        onclick: function () { state.filter = f[0]; render(); } }));
    });
    root.appendChild(fl);

    var shown = vs.filter(function (v) { return state.filter === "all" || (state.filter === "done" ? v.status === "done" : v.status !== "done"); });
    var list = h("div", { class: "list" });
    if (!shown.length) list.appendChild(h("p", { class: "empty", text: vs.length ? "Nothing here yet." : "No verses yet. Add the first one below." }));
    shown.forEach(function (v) {
      var left = h("div", null,
        h("div", { class: "meta" }, h("span", { class: "r", text: v.ref }), v.label ? h("span", { class: "tag", text: v.label + (v.review ? " · review" : "") }) : null),
        verseBlock(v, "t", "v:" + v.id));
      var acts = h("div", { class: "acts" });
      if (v.id !== l.current_verse && v.status !== "done") {
        acts.appendChild(h("button", { class: "link", type: "button", text: "Make this week's verse", onclick: function () { setCurrent(l, v.id); if (v.status === "todo") setStatus(v, "learning"); } }));
      }
      if (v.custom) {
        var rm = h("button", { class: "link", type: "button", text: "Remove", style: "color:var(--danger)" });
        rm.onclick = function () { if (rm.dataset.sure !== "1") { rm.dataset.sure = "1"; rm.textContent = "Tap again to remove"; return; } removeVerse(v); };
        acts.appendChild(rm);
      }
      if (acts.childNodes.length) left.appendChild(acts);
      list.appendChild(h("div", { class: "v" + (v.status === "done" ? " done" : "") + (v.id === l.current_verse ? " cur" : "") }, left, statusSeg(v)));
    });
    root.appendChild(list);

    var fRef = h("input", { id: "f-ref", required: "", placeholder: "e.g. Psalm 119:11", autocomplete: "off" });
    var fText = h("textarea", { id: "f-text", required: "", placeholder: "Type or paste the verse" });
    var fLabel = h("input", { id: "f-label", placeholder: "e.g. Week of Jan 5, or why this one", autocomplete: "off" });
    var form = h("form", { onsubmit: function (e) {
      e.preventDefault();
      var r = fRef.value.trim(), b = fText.value.trim(); if (!r || !b) return;
      addVerse(l.id, r, b, fLabel.value.trim()); toast("Added " + r);
    } },
      h("label", null, "Reference", fRef), h("label", null, "Verse text", fText), h("label", null, "Note (optional)", fLabel),
      h("div", null, h("button", { class: "btn", type: "submit", text: "Add to " + l.name })));
    root.appendChild(h("details", { class: "add" }, h("summary", { text: "Add a verse" }), form));
  }

  function when(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "due now";
    var d = Math.ceil(ms / SRS.DAY);
    if (d === 1) return "tomorrow";
    if (d < 14) return "in " + d + " days";
    if (d < 60) return "in " + Math.round(d / 7) + " weeks";
    return "in " + Math.round(d / 30) + " months";
  }

  function renderReview(root) {
    var due = dueVerses();
    var memorized = state.verses.filter(function (v) { return v.status === "done"; }).length;
    var s = state.session;

    if (s && s.queue.length) {
      var vid = s.queue[0], v = verseById(vid), r = reviewOf(vid);
      if (!v || !r) { s.queue.shift(); return renderReview(root); }
      var list = listById(v.list_id);
      var total = s.done + s.queue.length;
      root.appendChild(h("div", { class: "top" }, h("h2", { text: "Review" }), h("span", { class: "sync", text: (s.done + 1) + " of " + total })));
      var card = h("div", { class: "card" });
      card.appendChild(h("div", { class: "label", text: (list ? list.name : "") + (v.label ? " · " + v.label : "") }));
      card.appendChild(h("div", { class: "ref", text: v.ref }));
      if (s.mode === "hidden") {
        card.appendChild(h("p", { class: "txt hidden-v", style: "font-style:italic;color:var(--muted)", text: "Say it out loud from memory." }));
        card.appendChild(h("div", { class: "row" },
          h("button", { class: "btn ghost", type: "button", text: "Hint", onclick: function () { s.mode = "hint"; render(); } }),
          h("button", { class: "btn", type: "button", text: "Show verse", onclick: function () { s.mode = "full"; render(); } })));
      } else if (s.mode === "hint") {
        card.appendChild(h("p", { class: "txt hint", style: "letter-spacing:.14em;word-spacing:.4em", text: hintOf(v.body) }));
        card.appendChild(h("div", { class: "row" }, h("button", { class: "btn", type: "button", text: "Show verse", onclick: function () { s.mode = "full"; render(); } })));
      } else {
        card.appendChild(h("p", { class: "txt", text: v.body }));
        card.appendChild(h("div", { class: "label", text: "How did that go?" }));
        var g = h("div", { class: "grades" });
        [["Again", 0], ["Hard", 1], ["Good", 2], ["Easy", 3]].forEach(function (x) {
          g.appendChild(h("button", { class: "g" + x[1], type: "button", onclick: function () { gradeCard(vid, x[1]); } },
            h("span", { text: x[0] }), h("small", { text: SRS.gapLabel(r, x[1], Date.now()) })));
        });
        card.appendChild(g);
      }
      root.appendChild(card);
      root.appendChild(h("button", { class: "link", type: "button", text: "End session", onclick: function () { state.session = null; render(); } }));
      return;
    }

    root.appendChild(h("div", { class: "top" }, h("h2", { text: "Review" })));
    if (s && !s.queue.length) {
      root.appendChild(h("div", { class: "now" },
        h("div", { class: "label", text: "Session complete" }),
        h("div", { class: "ref", text: s.done + (s.done === 1 ? " verse" : " verses") + " reviewed" }),
        h("p", { class: "txt", text: "Nice work. The next ones will come back when they're due." })));
      state.session = null;
    }
    var stats = h("div", { class: "stats" },
      h("div", { class: "stat" }, h("b", { text: String(due.length) }), "due now"),
      h("div", { class: "stat" }, h("b", { text: String(memorized) }), "memorized"));
    root.appendChild(stats);
    if (due.length) {
      root.appendChild(h("div", null, h("button", { class: "btn", type: "button", text: "Start review (" + due.length + ")", onclick: function () {
        state.session = { queue: dueVerses(), mode: "hidden", done: 0 }; render();
      } })));
    } else {
      root.appendChild(h("p", { class: "note", text: memorized ? "Nothing due. Check back later." : "Verses show up here the day after you mark them Memorized." }));
    }
    var upcoming = state.reviews
      .filter(function (r) { var v = verseById(r.verse_id); return v && v.status === "done" && new Date(r.due).getTime() > Date.now(); })
      .sort(function (a, b) { return new Date(a.due) - new Date(b.due); }).slice(0, 12);
    if (upcoming.length) {
      root.appendChild(h("div", { class: "label", text: "Coming up for you" }));
      var box = h("div");
      upcoming.forEach(function (r) {
        var v = verseById(r.verse_id);
        box.appendChild(h("div", { class: "up" }, h("span", { text: v.ref }), h("span", { text: when(r.due) })));
      });
      root.appendChild(box);
    }
    root.appendChild(h("p", { class: "foot", text: "Your review schedule is your own. Each of you sees different reminders for the same verses." }));
  }

  function renderLogin(root) {
    var email = h("input", { id: "em", type: "email", required: "", autocomplete: "username", placeholder: "Email" });
    var pw = h("input", { id: "pw", type: "password", required: "", autocomplete: "current-password", placeholder: "Password" });
    var err = h("div", { class: "err", role: "alert", text: state.authError });
    var forgot = h("button", { class: "link", type: "button", text: "First time, or forgot your password? Email me a link", onclick: async function () {
      var em = email.value.trim();
      if (!em) { err.textContent = "Type your email above first."; return; }
      var r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
      err.textContent = r.error ? "Couldn't send that email: " + (r.error.message || r.error.code || "unknown error") : "Check your email (and spam) for a link to set your password.";
    } });
    var form = h("form", { class: "login", onsubmit: async function (e) {
      e.preventDefault();
      var r = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
      if (r.error) { state.authError = "That email and password didn't work."; render(); }
    } }, h("h1", { text: "Family Memory Verses" }), email, pw, err, h("button", { class: "btn", type: "submit", text: "Sign in" }), forgot);
    root.appendChild(form);
  }

  function renderSetPassword(root) {
    var pw = h("input", { id: "np", type: "password", required: "", minlength: "8", autocomplete: "new-password", placeholder: "New password (8+ characters)" });
    var err = h("div", { class: "err", role: "alert" });
    root.appendChild(h("form", { class: "login", onsubmit: async function (e) {
      e.preventDefault();
      var r = await sb.auth.updateUser({ password: pw.value });
      if (r.error) { err.textContent = r.error.message; return; }
      state.settingPw = false;
      try { history.replaceState(null, "", location.pathname); } catch (x) {}
      toast("Password saved. You're in."); render();
    } }, h("h1", { text: "Choose a password" }), h("p", { class: "note", text: "You'll use it with your email to sign in on this phone." }), pw, err,
      h("button", { class: "btn", type: "submit", text: "Save password" })));
  }

  function renderNav() {
    var nav = $("nav");
    if (!state.user) { nav.hidden = true; return; }
    nav.hidden = false; nav.textContent = "";
    var n = dueVerses().length;
    [["learn", "Learn"], ["review", "Review"]].forEach(function (x) {
      var b = h("button", { type: "button", onclick: function () { state.view = x[0]; render(); window.scrollTo(0, 0); } }, x[1]);
      if (state.view === x[0]) b.setAttribute("aria-current", "page");
      if (x[0] === "review" && n) b.appendChild(h("span", { class: "count", text: String(n) }));
      nav.appendChild(b);
    });
    try { if (navigator.setAppBadge) { n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } } catch (e) {}
  }

  function render() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.id !== "rn" && $("app").contains(a)) { dirty = true; return; }
    dirty = false;
    var root = $("app"); root.textContent = "";
    if (sb && !state.user) { renderLogin(root); renderNav(); return; }
    if (sb && state.settingPw) { renderSetPassword(root); renderNav(); return; }
    var top = h("div", { class: "top" }, h("h1", { text: "Family Memory Verses" }), h("span", { class: "sync", id: "sync", text: state.sync }));
    root.appendChild(top);
    if (state.view === "review") renderReview(root); else renderLearn(root);
    var foot = h("p", { class: "foot" }, state.user && sb ? ("Signed in as " + state.user.email + " · ") : "");
    if (sb) foot.appendChild(h("button", { class: "link", type: "button", text: "Sign out", onclick: function () { sb.auth.signOut(); } }));
    foot.appendChild(document.createTextNode(" Cubbies verses: short versions, ESV, from a church's 2026–27 HoneyComb verse sheet."));
    root.appendChild(foot);
    renderNav();
  }
  document.addEventListener("focusout", function () { setTimeout(function () { if (dirty) render(); }, 0); });

  // ---------- boot ----------
  async function startSignedIn(user) {
    state.user = user;
    var c = jget(KEY_CACHE, null);
    if (c && c.uid === user.id) { state.lists = c.lists; state.verses = c.verses; state.reviews = c.reviews; state.activity = c.activity || []; state.loaded = true; }
    queue = jget(KEY_QUEUE, []);
    var ui = jget(KEY_UI, {}); if (ui.list) state.list = ui.list;
    setSync(); render();
    if (sb) {
      await flush(); await pull();
      sb.channel("shared").on("postgres_changes", { event: "*", schema: "public", table: "verses" }, schedulePull)
        .on("postgres_changes", { event: "*", schema: "public", table: "lists" }, schedulePull)
        .on("postgres_changes", { event: "*", schema: "public", table: "activity" }, schedulePull).subscribe();
    }
  }

  async function boot() {
    if (!sb) {
      var c = jget(KEY_CACHE, null);
      state.user = { id: "local", email: "this device" };
      queue = [];
      var ui = jget(KEY_UI, {}); if (ui.list) state.list = ui.list;
      if (c && c.verses && c.verses.length) { state.lists = c.lists; state.verses = c.verses; state.reviews = c.reviews; state.activity = c.activity || []; }
      else { seed(); }
      ensureReviews(); persist(); state.loaded = true; setSync(); render();
      return;
    }
    var s = await sb.auth.getSession();
    if (s.data.session) await startSignedIn({ id: s.data.session.user.id, email: s.data.session.user.email });
    else render();
    sb.auth.onAuthStateChange(function (ev, session) {
      if (ev === "PASSWORD_RECOVERY") { state.settingPw = true; render(); }
      if (ev === "SIGNED_IN" && session && (!state.user || state.user.id !== session.user.id)) { state.authError = ""; startSignedIn({ id: session.user.id, email: session.user.email }); }
      if (ev === "SIGNED_OUT") { state.user = null; state.lists = []; state.verses = []; state.reviews = []; state.activity = []; jset(KEY_CACHE, null); render(); }
    });
  }

  window.addEventListener("online", function () { flush().then(pull); });
  window.addEventListener("offline", setSync);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { if (sb && state.user) flush().then(pull); else render(); } });

  if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }
  boot();
})();
