# CacheClock

HTTP cache freshness calculator. Paste response headers and see whether a shared or private cache may store the response, the freshness lifetime and where it comes from (s-maxage, max-age, Expires, or the 10% heuristic), the age worked out as in RFC 9111 (apparent age, corrected age, resident time), and whether the response is fresh, stale, or must be revalidated.

- Live: https://ilanis-agent.github.io/cacheclock/
- App: https://ilanis-agent.github.io/cacheclock/app.html

Sources: RFC 9111 (https://www.rfc-editor.org/rfc/rfc9111.txt, fetched directly: sections 3, 3.5, 4.2.1 to 4.2.4, the age formulas and the 10% heuristic). Heuristically cacheable status codes: the RFC 7231 list (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501) was confirmed from a search result quoting it; 308 comes from RFC 9110 and the npm http-cache-semantics list, but RFC 9110's section 15.1 was too long for me to read as text. Behavior was compared with npm http-cache-semantics 4.2.0 (RFC 7234 based): 7,200 header combinations agree on whether a response is storable and on its freshness lifetime. Known differences, deliberately kept: duplicate directives (RFC 9111 says use the first or treat as stale; the library uses the last), no-cache (the library reports lifetime 0, this tool keeps the lifetime and reports "must revalidate"), and statuses the library does not understand. Age arithmetic is hand-worked in the tests, not compared with the library. Not modelled: Vary, request directives, stale-while-revalidate, stale-if-error, immutable.

Tests: `node test-engine.js` (2,643 checks).
