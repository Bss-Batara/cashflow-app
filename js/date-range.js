/**
 * date-range.js — RENTANG DATA (filter tanggal) untuk tampilan dan ekspor.
 *
 * - Default: tanggal 1 bulan berjalan sampai HARI INI (inklusif).
 * - Aman timezone: tanggal diperlakukan sebagai string "YYYY-MM-DD" dari komponen
 *   tanggal LOKAL (tanpa toISOString/UTC) dan dibandingkan secara leksikografis.
 * - Modal kalender 7 kolom (SUN..SAT), navigasi bulan, highlight awal/akhir/range.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'cf.dateRange.v1';
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const pad = (n) => String(n).padStart(2, '0');
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  const firstOfMonth = (iso) => iso.slice(0, 7) + '-01';
  const defaultRange = () => ({ from: firstOfMonth(todayISO()), to: todayISO() });

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultRange();
      const parsed = JSON.parse(raw);
      if (isIso(parsed.from) && isIso(parsed.to) && parsed.from <= parsed.to) return { from: parsed.from, to: parsed.to };
    } catch (error) { /* default */ }
    return defaultRange();
  }

  let state = load();
  let draft = { ...state };
  let view = { year: Number(state.from.slice(0, 4)), month: Number(state.from.slice(5, 7)) - 1 };

  function formatLabel(iso) {
    if (!isIso(iso)) return '';
    const parts = iso.split('-').map(Number);
    return parts[2] + ' ' + MONTHS[parts[1] - 1] + ' ' + parts[0];
  }
  const label = (range = state) => formatLabel(range.from) + ' \u2013 ' + formatLabel(range.to);

  /** From & To inklusif. */
  function matches(date) {
    const value = String(date || '').slice(0, 10);
    if (!isIso(value)) return false;
    if (state.from && value < state.from) return false;
    if (state.to && value > state.to) return false;
    return true;
  }

  const persist = () => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* abaikan */ } };

  function renderLabel() {
    const node = document.getElementById('range-label');
    if (node) node.textContent = label();
  }

  function renderCalendar() {
    const grid = document.getElementById('range-grid');
    const head = document.getElementById('range-month');
    if (!grid) return;
    if (head) head.textContent = MONTHS[view.month] + ' ' + view.year;

    const firstWeekday = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const today = todayISO();
    let cells = '';
    for (let i = 0; i < firstWeekday; i += 1) cells += '<span class="range-day is-empty"></span>';
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = view.year + '-' + pad(view.month + 1) + '-' + pad(day);
      const classes = ['range-day'];
      if (draft.from && iso === draft.from) classes.push('is-start');
      if (draft.to && iso === draft.to) classes.push('is-end');
      if (draft.from && draft.to && iso > draft.from && iso < draft.to) classes.push('in-range');
      if (iso === today) classes.push('is-today');
      cells += '<button type="button" class="' + classes.join(' ') + '" data-date="' + iso + '">' + day + '</button>';
    }
    grid.innerHTML = cells;
  }

  function renderInputs() {
    const from = document.getElementById('range-from');
    const to = document.getElementById('range-to');
    if (from) from.value = draft.from || '';
    if (to) to.value = draft.to || '';
    const err = document.getElementById('range-error');
    if (err) err.textContent = '';
  }

  function setDraft(from, to) {
    if (isIso(from) && isIso(to) && from > to) {
      const err = document.getElementById('range-error');
      if (err) err.textContent = 'Tanggal "From" tidak boleh melebihi "To".';
      return false;
    }
    draft = { from: from || '', to: to || '' };
    if (isIso(draft.from)) view = { year: Number(draft.from.slice(0, 4)), month: Number(draft.from.slice(5, 7)) - 1 };
    return true;
  }

  function openModal() {
    draft = { ...state };
    view = { year: Number(draft.from.slice(0, 4)), month: Number(draft.from.slice(5, 7)) - 1 };
    renderInputs();
    renderCalendar();
    document.getElementById('range-modal')?.classList.add('active');
  }
  const closeModal = () => document.getElementById('range-modal')?.classList.remove('active');

  function applyRange() {
    if (isIso(draft.from) && isIso(draft.to) && draft.from > draft.to) {
      const err = document.getElementById('range-error');
      if (err) err.textContent = 'Rentang tidak valid: "From" melebihi "To".';
      return;
    }
    state = { from: draft.from, to: draft.to };
    persist();
    renderLabel();
    if (window.app && typeof window.app.render === 'function') window.app.render();
    closeModal();
  }

  function resetRange() { draft = defaultRange(); renderInputs(); renderCalendar(); }

  function stepMonth(delta) {
    const next = new Date(view.year, view.month + delta, 1);
    view = { year: next.getFullYear(), month: next.getMonth() };
    renderCalendar();
  }

  function wire() {
    const modal = document.getElementById('range-modal');
    if (!modal) return;
    document.getElementById('range-open')?.addEventListener('click', openModal);
    document.getElementById('range-close')?.addEventListener('click', closeModal);
    document.getElementById('range-reset')?.addEventListener('click', resetRange);
    document.getElementById('range-confirm')?.addEventListener('click', applyRange);
    document.getElementById('range-prev')?.addEventListener('click', () => stepMonth(-1));
    document.getElementById('range-next')?.addEventListener('click', () => stepMonth(1));
    document.getElementById('range-grid')?.addEventListener('click', (event) => {
      const button = event.target.closest('.range-day[data-date]');
      if (!button) return;
      const iso = button.getAttribute('data-date');
      if (!draft.from || (draft.from && draft.to)) setDraft(iso, '');
      else if (iso >= draft.from) setDraft(draft.from, iso);
      else setDraft(iso, '');
      renderInputs();
      renderCalendar();
    });
    document.getElementById('range-from')?.addEventListener('change', (event) => { setDraft(String(event.target.value || ''), draft.to); renderCalendar(); });
    document.getElementById('range-to')?.addEventListener('change', (event) => { setDraft(draft.from, String(event.target.value || '')); renderCalendar(); });
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    renderLabel();
  }

  window.cashflowDateRange = {
    get: () => ({ ...state }),
    defaultRange: defaultRange,
    matches: matches,
    label: label,
    reset: () => { state = defaultRange(); persist(); renderLabel(); },
    set: (from, to) => { setDraft(from, to); applyRange(); },
    __open: openModal,
    __close: closeModal
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true });
  else wire();
})();
