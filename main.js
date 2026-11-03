/* ============================================================
   INSTELLINGEN — pas alleen dit blok aan
   ============================================================ */
var CONFIG = {
  calUsername: 'menno-mooibroek-vlkffv',     // je Cal.com gebruikersnaam (of team-slug)
  calEvent: 'kennismaking',       // de slug van het afspraaktype in Cal.com
  timeZone: 'Europe/Amsterdam',
  brandColor: '#111111',
  apiBase: ''  // leeg = automatisch (online eerst /api/cal, anders rechtstreeks Cal.com)
};
/* ============================================================ */

(function () {
  document.body.classList.remove('no-js');
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var CAL_PATH = CONFIG.calUsername + '/' + CONFIG.calEvent;
  var CAL_URL = 'https://cal.com/' + CAL_PATH;
  var IS_DEMO = CONFIG.calUsername === 'jullie-naam';

  var pad = function (n) { return String(n).padStart(2, '0'); };
  var toIso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var WD_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  var WD_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var TIMES = ['09:30', '11:00', '13:30', '15:00', '16:30'];

  /* ============================================================
     AFSPRAKEN — eigen boekingsscherm, gekoppeld aan de Cal.com API
     ============================================================ */
  // Online (http/https): eerst de eigen serverfunctie /api/cal, daarna rechtstreeks Cal.com.
  var API_LIST = CONFIG.apiBase ? [CONFIG.apiBase] :
    (/^https?:$/.test(location.protocol) ? ['/api/cal', 'https://api.cal.com/v2'] : ['https://api.cal.com/v2']);
  API_LIST = API_LIST.map(function (u) { return u.replace(/\/$/, ''); });
  var apiIndex = 0;
  function apiFetch(path, init) {
    function attempt(i) {
      return fetch(API_LIST[i] + path, init).then(function (r) {
        if ((r.status === 404 || r.status === 405) && i < API_LIST.length - 1) throw new Error('next');
        apiIndex = i;
        return r;
      }).catch(function (err) {
        if (i < API_LIST.length - 1) return attempt(i + 1);
        throw err;
      });
    }
    return attempt(apiIndex);
  }
  var USER_TZ = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || CONFIG.timeZone; } catch (e) { return CONFIG.timeZone; } })();
  var apiOk = !IS_DEMO;            // wordt false als de API niet bereikbaar is
  var slotCache = {};              // 'YYYY-MM' -> { 'YYYY-MM-DD': ['ISO', ...] }

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function timeLabel(iso) {
    return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: USER_TZ });
  }
  function dateLabelLong(isoDay) {
    var d = new Date(isoDay + 'T12:00:00');
    return WD_LONG[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function fetchMonth(y, m) {
    var key = y + '-' + pad(m + 1);
    if (slotCache[key]) return Promise.resolve(slotCache[key]);
    if (IS_DEMO) {
      var demo = {}; var today = new Date(); today.setHours(0, 0, 0, 0);
      var dim = new Date(y, m + 1, 0).getDate();
      for (var dn = 1; dn <= dim; dn++) {
        var dt = new Date(y, m, dn);
        if (dt > today && dt.getDay() !== 0 && dt.getDay() !== 6) {
          demo[toIso(dt)] = TIMES.map(function (t) { return toIso(dt) + 'T' + t + ':00'; });
        }
      }
      slotCache[key] = demo;
      return Promise.resolve(demo);
    }
    var start = new Date(y, m, 1); var now = new Date(); if (start < now) start = now;
    var end = new Date(y, m + 1, 1);
    var url = '/slots?username=' + encodeURIComponent(CONFIG.calUsername) +
      '&eventTypeSlug=' + encodeURIComponent(CONFIG.calEvent) +
      '&start=' + encodeURIComponent(start.toISOString()) +
      '&end=' + encodeURIComponent(end.toISOString()) +
      '&timeZone=' + encodeURIComponent(USER_TZ);
    return apiFetch(url, { headers: { 'cal-api-version': '2024-09-04' } })
      .then(function (r) { if (!r.ok) throw new Error('slots ' + r.status); return r.json(); })
      .then(function (json) {
        var out = {};
        var data = (json && json.data) || {};
        Object.keys(data).forEach(function (day) {
          var list = (data[day] || []).map(function (sl) { return typeof sl === 'string' ? sl : (sl.start || sl.time); }).filter(Boolean);
          if (list.length) out[day] = list;
        });
        slotCache[key] = out;
        return out;
      });
  }

  function createBooking(startIso, name, email, notes) {
    if (IS_DEMO) return new Promise(function (res) { setTimeout(function () { res({ demo: true }); }, 600); });
    var body = {
      start: new Date(startIso).toISOString(),
      eventTypeSlug: CONFIG.calEvent,
      username: CONFIG.calUsername,
      attendee: { name: name, email: email, timeZone: USER_TZ, language: 'nl' }
    };
    if (notes) body.bookingFieldsResponses = { notes: notes };
    return apiFetch('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cal-api-version': '2024-08-13' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (json) {
        if (!r.ok || (json && json.status === 'error')) {
          var msg = (json && json.error && (json.error.message || json.error)) || ('Fout ' + r.status);
          throw new Error(typeof msg === 'string' ? msg : 'Boeken mislukt');
        }
        return json;
      });
    });
  }

  var ICON_CLOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var ICON_VIDEO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>';
  var ICON_GLOBE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>';
  var ICON_L = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var ICON_R = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  var ICON_CHECK = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  function pickerHTML(withClose, titleId) {
    return (withClose ? '<button class="modal-close" type="button" data-close aria-label="Sluiten"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg></button>' : '') +
      '<div class="m-info"><span class="avatars" aria-hidden="true"><span style="background:var(--blue)">Ma</span><span style="background:var(--pink)">Me</span></span>' +
      '<p style="font-size:14px;color:var(--subtle);margin:12px 0 0">Marcel &amp; Menno</p>' +
      '<p id="' + titleId + '" style="font-family:var(--display);font-size:24px;margin:4px 0 0">Kennismaking</p>' +
      '<p style="font-size:14px;line-height:1.55;color:var(--muted);margin:10px 0 0">Jij vertelt waar je mee bezig bent, wij vertellen hoe we werken.</p>' +
      '<div class="meta"><span>' + ICON_CLOCK + '30 min</span><span>' + ICON_VIDEO + 'Google Meet</span><span>' + ICON_GLOBE + esc(USER_TZ) + '</span></div>' +
      '<div class="js-chosen" hidden style="margin-top:20px;padding:12px 14px;border-radius:12px;background:var(--soft);font-size:14px;line-height:1.5"></div></div>' +
      // stap 1 + 2: dag en tijd
      '<div class="m-step js-step-pick" style="display:contents">' +
      '<div class="m-cal"><div class="cal-head"><p class="js-month" aria-live="polite"></p><div>' +
      '<button class="icon-btn js-prev" type="button" aria-label="Vorige maand">' + ICON_L + '</button>' +
      '<button class="icon-btn js-next" type="button" aria-label="Volgende maand">' + ICON_R + '</button></div></div>' +
      '<div class="cal-grid" aria-hidden="true"><div class="cal-wd">ma</div><div class="cal-wd">di</div><div class="cal-wd">wo</div><div class="cal-wd">do</div><div class="cal-wd">vr</div><div class="cal-wd">za</div><div class="cal-wd">zo</div></div>' +
      '<div class="cal-grid js-days"></div><p class="cal-status js-status" aria-live="polite"></p></div>' +
      '<div class="m-times"><p class="js-title" style="margin:0 0 12px;padding-right:40px;font-weight:600;font-size:15px;line-height:1.35">Kies een dag</p>' +
      '<div class="slots js-slots"></div>' +
      '<button class="btn btn-dark btn-sm js-continue" type="button" style="width:100%;margin-top:12px" hidden>Verder</button>' +
      (IS_DEMO ? '<p class="demo-note">Voorbeeldtijden. Zodra de Cal.com-link is ingesteld zie je hier de echte beschikbaarheid.</p>' : '') +
      '</div></div>' +
      // stap 3: gegevens
      '<form class="m-form js-step-form" hidden novalidate>' +
      '<button class="back-link js-back" type="button">' + ICON_L + 'Andere tijd kiezen</button>' +
      '<h3 style="font-size:20px;font-weight:600;margin:14px 0 18px">Je gegevens</h3>' +
      '<label class="field"><span>Naam</span><input class="js-name" type="text" name="name" autocomplete="name" required></label>' +
      '<label class="field"><span>E-mailadres</span><input class="js-email" type="email" name="email" autocomplete="email" required></label>' +
      '<label class="field"><span>Waar kunnen we je mee helpen? <em>(optioneel)</em></span><textarea class="js-notes" name="notes" rows="3"></textarea></label>' +
      '<p class="form-error js-error" role="alert" hidden></p>' +
      '<button class="btn btn-dark btn-lg js-submit" type="submit" style="width:100%">Afspraak bevestigen</button>' +
      '<p style="font-size:13px;color:var(--subtle);margin:12px 0 0;line-height:1.5">Je ontvangt direct een bevestiging per mail, met de Google Meet-link.</p>' +
      '</form>' +
      // stap 4: bevestigd
      '<div class="m-done js-step-done" hidden aria-live="polite">' +
      '<span class="done-icon">' + ICON_CHECK + '</span>' +
      '<h3 style="font-family:var(--display);font-size:30px;font-weight:600;margin:20px 0 0">Gepland!</h3>' +
      '<p class="js-done-text" style="font-size:16px;line-height:1.6;color:var(--muted);margin:12px auto 0;max-width:380px"></p>' +
      '<button class="btn btn-outline js-done-close" type="button" style="margin-top:24px;min-height:48px">Sluiten</button>' +
      '</div>';
  }

  function Picker(root, opts) {
    opts = opts || {};
    var st = { offset: 0, day: null, slot: null, slots: {}, loading: false, step: 'pick' };
    var q = function (s) { return root.querySelector(s); };
    var reqId = 0;

    function show(step) {
      st.step = step;
      q('.js-step-pick').style.display = step === 'pick' ? 'contents' : 'none';
      q('.js-step-form').hidden = step !== 'form';
      q('.js-step-done').hidden = step !== 'done';
      var chosen = q('.js-chosen');
      if (step === 'form' && st.slot) {
        chosen.hidden = false;
        chosen.innerHTML = '<strong style="font-weight:600">' + esc(dateLabelLong(st.day)) + '</strong><br>' + esc(timeLabel(st.slot)) + ' · 30 min';
      } else { chosen.hidden = true; }
      if (step === 'form') setTimeout(function () { q('.js-name').focus(); }, 30);
    }

    q('.js-prev').addEventListener('click', function () { if (st.offset > 0) { st.offset--; load(); } });
    q('.js-next').addEventListener('click', function () { if (st.offset < 3) { st.offset++; load(); } });
    q('.js-continue').addEventListener('click', function () { show('form'); });
    q('.js-back').addEventListener('click', function () { show('pick'); });
    q('.js-done-close').addEventListener('click', function () { if (opts.onDone) opts.onDone(); else reset(); });

    q('.js-step-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = q('.js-name').value.trim(), email = q('.js-email').value.trim(), notes = q('.js-notes').value.trim();
      var err = q('.js-error');
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        err.textContent = 'Vul je naam en een geldig e-mailadres in.'; err.hidden = false; return;
      }
      err.hidden = true;
      var btn = q('.js-submit'); btn.disabled = true; btn.textContent = 'Bezig met plannen…';
      createBooking(st.slot, name, email, notes).then(function () {
        q('.js-done-text').textContent = 'Je kennismaking staat op ' + dateLabelLong(st.day) + ' om ' + timeLabel(st.slot) + '. De bevestiging met de Google Meet-link is onderweg naar ' + email + '.';
        slotCache = {};
        show('done');
      }).catch(function (ex) {
        err.innerHTML = 'Dat lukte niet' + (ex && ex.message ? ' (' + esc(ex.message) + ')' : '') + '. Kies een andere tijd, of <a href="' + CAL_URL + '" target="_blank" rel="noopener">plan via Cal.com</a>.';
        err.hidden = false;
      }).then(function () { btn.disabled = false; btn.textContent = 'Afspraak bevestigen'; });
    });

    function load() {
      var today = new Date();
      var first = new Date(today.getFullYear(), today.getMonth() + st.offset, 1);
      var y = first.getFullYear(), m = first.getMonth();
      st.loading = true; st.slots = {};
      render();
      var id = ++reqId;
      fetchMonth(y, m).then(function (slots) {
        if (id !== reqId) return;
        st.loading = false; st.slots = slots;
        if (st.day && !slots[st.day]) { st.day = null; st.slot = null; }
        render();
      }).catch(function () {
        if (id !== reqId) return;
        st.loading = false;
        apiOk = false;
        var status = q('.js-status');
        if (status) status.textContent = 'De agenda kon niet worden geladen.';
        var grid = q('.js-days'); if (grid) grid.querySelectorAll('.is-loading').forEach(function (c) { c.classList.remove('is-loading'); });
        q('.js-title').textContent = 'Agenda niet bereikbaar';
        q('.js-slots').innerHTML = '<p style="font-size:14px;line-height:1.5;color:var(--muted);margin:0 0 12px">Plan je kennismaking direct in onze agenda op Cal.com.</p>' +
          '<a class="btn btn-dark btn-sm" href="' + CAL_URL + '" target="_blank" rel="noopener" style="width:100%">Open de agenda</a>' +
          '<button class="btn btn-outline js-retry" type="button" style="width:100%;margin-top:8px;min-height:44px;font-size:14px">Opnieuw proberen</button>';
        var retry = q('.js-retry'); if (retry) retry.addEventListener('click', function () { load(); });
      });
    }

    function render() {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var first = new Date(today.getFullYear(), today.getMonth() + st.offset, 1);
      var y = first.getFullYear(), m = first.getMonth();
      q('.js-month').textContent = MONTHS[m] + ' ' + y;
      q('.js-prev').disabled = st.offset === 0;
      q('.js-next').disabled = st.offset === 3;
      var status = q('.js-status');
      var anyDay = Object.keys(st.slots).length > 0;
      status.textContent = st.loading ? 'Beschikbaarheid laden…' : (!anyDay ? 'Geen vrije momenten deze maand. Probeer de volgende maand.' : '');
      var grid = q('.js-days');
      grid.innerHTML = '';
      grid.setAttribute('aria-busy', st.loading ? 'true' : 'false');
      var lead = (first.getDay() + 6) % 7;
      for (var i = 0; i < lead; i++) grid.appendChild(document.createElement('span'));
      var dim = new Date(y, m + 1, 0).getDate();
      for (var dn = 1; dn <= dim; dn++) {
        var dt = new Date(y, m, dn);
        var iso = toIso(dt);
        var avail = !st.loading && !!st.slots[iso];
        var el;
        if (avail) {
          el = document.createElement('button');
          el.type = 'button';
          el.className = 'cal-day';
          el.setAttribute('aria-pressed', st.day === iso ? 'true' : 'false');
          el.setAttribute('aria-label', WD_LONG[dt.getDay()] + ' ' + dn + ' ' + MONTHS[m]);
          el.dataset.iso = iso;
          el.addEventListener('click', function () { st.day = this.dataset.iso; st.slot = null; render(); });
        } else {
          el = document.createElement('span');
          el.className = 'cal-off' + (st.loading ? ' is-loading' : '');
        }
        el.textContent = dn;
        grid.appendChild(el);
      }
      renderSlots();
    }

    function renderSlots() {
      var wrap = q('.js-slots'), title = q('.js-title'), cont = q('.js-continue');
      wrap.innerHTML = '';
      if (!st.day || !st.slots[st.day]) { title.textContent = 'Kies een dag'; cont.hidden = true; return; }
      title.textContent = dateLabelLong(st.day);
      st.slots[st.day].forEach(function (iso) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'slot'; b.textContent = timeLabel(iso);
        b.setAttribute('aria-pressed', st.slot === iso ? 'true' : 'false');
        b.addEventListener('click', function () { st.slot = iso; renderSlots(); });
        wrap.appendChild(b);
      });
      cont.hidden = !st.slot;
    }

    function reset() {
      st.step = 'pick';
      q('.js-step-form').reset();
      q('.js-error').hidden = true;
      show('pick');
    }

    this.set = function (dateIso, slotIso) {
      var today = new Date();
      reset();
      st.day = dateIso || null; st.slot = slotIso || null; st.offset = 0;
      if (dateIso) { var d = new Date(dateIso + 'T12:00:00'); st.offset = Math.max(0, (d.getFullYear() - today.getFullYear()) * 12 + d.getMonth() - today.getMonth()); }
      load();
    };
    show('pick');
    load();
  }

  /* ---------- Venster (modal) ---------- */
  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = '<div class="modal-bg" data-close></div><div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="m-title">' + pickerHTML(true, 'm-title') + '</div>';
  document.body.appendChild(modal);
  var modalPicker = null;
  var lastFocus = null;

  function openModal(dateIso, slotIso) {
    lastFocus = document.activeElement;
    if (!modalPicker) {
      modalPicker = new Picker(modal, { onDone: closeModal });
      if (dateIso) modalPicker.set(dateIso, slotIso);
    } else {
      modalPicker.set(dateIso, slotIso);
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { modal.querySelector('.modal-close').focus(); }, 30);
  }
  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  modal.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', closeModal); });
  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(modal.querySelectorAll('button:not([disabled]), a[href], input, textarea'), function (el) { return el.offsetParent !== null; });
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function openBooking(dateIso, slotIso) {
    openModal(dateIso, slotIso);
  }
  document.querySelectorAll('[data-book]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); closeMobileNav(); openBooking(); });
  });

  /* ---------- Agenda direct op de pagina (contactpagina) ---------- */
  var inline = document.getElementById('booking-inline');
  if (inline) {
    inline.innerHTML = '<div class="modal-panel" aria-labelledby="i-title">' + pickerHTML(false, 'i-title') + '</div>';
    new Picker(inline);
  }

  /* ---------- Eerstvolgende vrije moment ---------- */
  var nextBtns = document.querySelectorAll('[data-next]');
  if (nextBtns.length) {
    var now = new Date();
    var tryMonth = function (k) {
      var d = new Date(now.getFullYear(), now.getMonth() + k, 1);
      return fetchMonth(d.getFullYear(), d.getMonth()).then(function (slots) {
        var days = Object.keys(slots).sort();
        if (days.length) return { day: days[0], slot: slots[days[0]][0] };
        if (k < 2) return tryMonth(k + 1);
        return null;
      });
    };
    tryMonth(0).then(function (found) {
      if (!found) return;
      var d = new Date(found.day + 'T12:00:00');
      var label = WD_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ', ' + timeLabel(found.slot);
      nextBtns.forEach(function (b) {
        b.querySelector('[data-next-label]').textContent = label;
        b.hidden = false;
        b.addEventListener('click', function () { openBooking(found.day, found.slot); });
      });
    }).catch(function () { /* geen eerstvolgende tijd tonen */ });
  }


  /* ---------- Diensten-uitklapmenu ---------- */
  document.querySelectorAll('[data-dd]').forEach(function (dd) {
    var btn = dd.querySelector('.dd-trigger');
    var closeTimer = null;
    function set(open) { dd.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!dd.classList.contains('open')); });
    if (window.matchMedia('(hover: hover)').matches) {
      dd.addEventListener('mouseenter', function () { clearTimeout(closeTimer); set(true); });
      dd.addEventListener('mouseleave', function () { closeTimer = setTimeout(function () { set(false); }, 150); });
    }
    dd.querySelectorAll('.dd-panel a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('click', function (e) { if (!dd.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dd.classList.contains('open')) { set(false); btn.focus(); } });
    dd.addEventListener('focusout', function (e) { if (!dd.contains(e.relatedTarget)) set(false); });
  });

  /* ---------- Vragen ---------- */
  document.querySelectorAll('.faq-q').forEach(function (q, i) {
    var a = q.nextElementSibling;
    var id = 'faq-a-' + i; a.id = id; q.setAttribute('aria-controls', id);
    q.addEventListener('click', function () {
      var open = q.getAttribute('aria-expanded') === 'true';
      q.setAttribute('aria-expanded', open ? 'false' : 'true');
      a.style.maxHeight = open ? '0px' : a.scrollHeight + 'px';
    });
  });

  /* ---------- Mobiel menu ---------- */
  var menuBtn = document.getElementById('menu-btn');
  var mobileNav = document.getElementById('mobile-nav');
  function closeMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Menu openen');
  }
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var open = mobileNav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
  });

  /* ---------- Kopbalk bij scrollen ---------- */
  var header = document.getElementById('header');
  window.addEventListener('scroll', function () { header.classList.toggle('scrolled', window.scrollY > 8); }, { passive: true });

  /* ---------- Rustig inschuiven ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    var heroEls = 0;
    document.querySelectorAll('.reveal').forEach(function (el) {
      if (el.closest('.hero, .page-hero')) { el.style.transitionDelay = (heroEls++ * 60) + 'ms'; }
      io.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }
})();
