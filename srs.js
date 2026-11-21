// Spaced repetition for memorized verses (SM-2 style, tuned for verses).
// Grades: 0 = Again (couldn't recall), 1 = Hard, 2 = Good, 3 = Easy.
// A review row: { interval_days, ease, reps, lapses, due, last_reviewed }.
(function (root) {
  var DAY = 86400000, MIN = 60000;

  function nextState(r, grade, now, opts) {
    var fuzz = !(opts && opts.noFuzz);
    var i = r.interval_days || 0, e = r.ease || 2.5, reps = r.reps || 0, lapses = r.lapses || 0;
    var dueMs;
    if (grade === 0) {
      lapses += 1; reps = 0; e = Math.max(1.3, e - 0.2);
      i = 0; dueMs = now + 10 * MIN;                     // ask again this session
    } else {
      if (grade === 1) { i = reps === 0 ? 1 : Math.max(1, i * 1.2); e = Math.max(1.3, e - 0.15); }
      else if (grade === 2) { i = reps === 0 ? 1 : reps === 1 ? 3 : i * e; }
      else { i = reps === 0 ? 3 : reps === 1 ? 6 : i * e * 1.3; e = e + 0.15; }
      reps += 1;
      var days = Math.max(1, Math.round(i * (fuzz ? 0.95 + Math.random() * 0.1 : 1)));
      i = days;
      dueMs = now + days * DAY;
    }
    return { interval_days: i, ease: e, reps: reps, lapses: lapses, due: new Date(dueMs).toISOString(), last_reviewed: new Date(now).toISOString() };
  }

  // Human label for the next gap, e.g. "10m", "3d", "2mo".
  function gapLabel(r, grade, now) {
    var n = nextState(r, grade, now, { noFuzz: true });
    var ms = new Date(n.due).getTime() - now;
    if (ms < 60 * MIN) return Math.round(ms / MIN) + "m";
    var d = Math.round(ms / DAY);
    if (d < 30) return d + "d";
    if (d < 365) return Math.round(d / 30) + "mo";
    return (d / 365).toFixed(1).replace(/\.0$/, "") + "y";
  }

  // A verse becomes reviewable the day after it was marked memorized.
  function firstReview(userId, verse) {
    var from = verse.updated_at ? new Date(verse.updated_at).getTime() : Date.now();
    return { user_id: userId, verse_id: verse.id, due: new Date(from + DAY).toISOString(), interval_days: 0, ease: 2.5, reps: 0, lapses: 0, last_reviewed: null };
  }

  root.SRS = { nextState: nextState, gapLabel: gapLabel, firstReview: firstReview, DAY: DAY };
  if (typeof module !== "undefined") module.exports = root.SRS;
})(typeof window !== "undefined" ? window : globalThis);
