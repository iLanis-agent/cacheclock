(function (root) {
  // HTTP cache freshness per RFC 9111 sections 3, 3.5, 4.2.1 to 4.2.4. Times are in milliseconds, ages and lifetimes in seconds.
  var HEURISTIC = [200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414, 501];
  function parseCC(s) {
    var out = { dirs: {}, dup: false, invalid: [] };
    if (!s) return out;
    var re = /\s*([!#$%&'*+.^_`|~0-9A-Za-z-]+)\s*(?:=\s*("(?:[^"\\]|\\.)*"|[^,]*))?\s*(?:,|$)/g, m, last = 0;
    while ((m = re.exec(s)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }
      var k = m[1].toLowerCase(), v = m[2] === undefined ? true : m[2].trim().replace(/^"(.*)"$/, '$1');
      if (Object.prototype.hasOwnProperty.call(out.dirs, k)) { out.dup = true; continue; }
      out.dirs[k] = v; last = re.lastIndex;
    }
    return out;
  }
  function delta(v) { return typeof v === 'string' && /^\d+$/.test(v) ? parseInt(v, 10) : null; }
  function parseDate(s) { if (s === null || s === undefined || s === '') return null; var t = Date.parse(s); return isNaN(t) ? NaN : t; }
  // p: {status, shared, hasAuth, cacheControl, expires, date, lastModified, age, requestTime, responseTime, now, fraction}
  function evaluate(p) {
    var cc = parseCC(p.cacheControl), d = cc.dirs, shared = !!p.shared, why = [], notes = [];
    var frac = p.fraction === undefined ? 0.1 : p.fraction;
    // storing (section 3)
    var storable = true;
    if (d['no-store']) { storable = false; why.push('no-store: the response must not be stored.'); }
    if (shared && d['private'] === true) { storable = false; why.push('private: a shared cache must not store it.'); }
    if (shared && p.hasAuth && !(d['public'] || d['must-revalidate'] || d['s-maxage'] !== undefined)) { storable = false; why.push('The request had Authorization and the response does not explicitly allow shared caching (public, must-revalidate or s-maxage).'); }
    var explicitFresh = (d['max-age'] !== undefined) || (shared && d['s-maxage'] !== undefined) || (p.expires !== null && p.expires !== undefined && p.expires !== '');
    var heurStatus = HEURISTIC.indexOf(p.status) >= 0;
    var allows = d['public'] || (!shared && d['private']) || explicitFresh || heurStatus;
    if (storable && !allows) { storable = false; why.push('Nothing in the response allows storing it: no public, max-age, Expires, and status ' + p.status + ' is not heuristically cacheable.'); }
    // freshness lifetime (4.2.1, 4.2.2)
    var life = 0, src = '', date = parseDate(p.date), exp = parseDate(p.expires), lm = parseDate(p.lastModified);
    var dateOrResp = (date === null || isNaN(date)) ? p.responseTime : date;
    var bad = false;
    if (shared && d['s-maxage'] !== undefined) { var s = delta(d['s-maxage']); if (s === null) { bad = true; notes.push('s-maxage is not a whole number, so the response is treated as stale.'); } else { life = s; src = 's-maxage'; } }
    else if (d['max-age'] !== undefined) { var a = delta(d['max-age']); if (a === null) { bad = true; notes.push('max-age is not a whole number, so the response is treated as stale.'); } else { life = a; src = 'max-age'; } }
    else if (p.expires !== null && p.expires !== undefined && p.expires !== '') {
      if (isNaN(exp)) { src = 'Expires (invalid date, treated as already expired)'; life = 0; }
      else { life = Math.max(0, Math.round((exp - dateOrResp) / 1000)); src = 'Expires minus Date'; }
    } else if ((heurStatus || d['public']) && lm !== null && !isNaN(lm) && !isNaN(dateOrResp)) {
      life = Math.max(0, Math.floor(Math.max(0, dateOrResp - lm) / 1000 * frac)); src = 'heuristic: ' + Math.round(frac * 100) + '% of time since Last-Modified';
    } else if (heurStatus || d['public'] || (!shared && d['private'])) { life = 0; src = 'none (no explicit lifetime, no Last-Modified to base a heuristic on)'; }
    else { life = 0; src = 'none'; }
    if (bad) { life = 0; src = 'invalid, treated as stale'; }
    if (cc.dup) notes.push('A directive appears twice. The first one was used; a cache may also treat this as stale.');
    // age (4.2.3)
    var ageVal = p.age === null || p.age === undefined || p.age === '' ? 0 : +p.age;
    var apparent = (date === null || isNaN(date)) ? 0 : Math.max(0, (p.responseTime - date) / 1000);
    var delay = (p.responseTime - p.requestTime) / 1000, corrected = ageVal + delay, initial = Math.max(apparent, corrected);
    var resident = (p.now - p.responseTime) / 1000, current = initial + resident;
    var fresh = life > current, state, remaining = life - current;
    if (!storable) state = 'not stored';
    else if (d['no-cache'] === true) state = 'revalidate';
    else if (fresh) state = 'fresh';
    else if (d['must-revalidate'] || (shared && d['proxy-revalidate'])) state = 'stale: must revalidate';
    else state = 'stale';
    return { storable: storable, why: why, notes: notes, lifetime: life, source: src, apparentAge: apparent, correctedAge: corrected, initialAge: initial, residentTime: resident, currentAge: current, fresh: fresh, remaining: remaining, state: state, cc: cc };
  }
  var api = { parseCC: parseCC, evaluate: evaluate, HEURISTIC: HEURISTIC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CacheClock = api;
})(typeof window !== 'undefined' ? window : this);
