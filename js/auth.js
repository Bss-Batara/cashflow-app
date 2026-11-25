/**
 * CashFlow - js/auth.js
 * Gerbang login lokal untuk halaman index.html.
 *
 * CARA KERJA
 * - Saat halaman dibuka, overlay `#cf-login` dipasang di atas aplikasi.
 *   Selama belum masuk, `.app-container` dikunci (atribut `inert`) sehingga
 *   dashboard tidak bisa diklik walau terlihat di belakang.
 * - Password tidak pernah disimpan mentah. Yang disimpan hanya hash
 *   SHA-256 + salt acak per akun di localStorage (`cashflow_auth_v1`).
 * - Sesi disimpan di sessionStorage (`cashflow_session_v1`): hilang saat tab
 *   ditutup, tidak ikut ke tab lain, berlaku 8 jam.
 * - Jika perangkat belum punya akun, overlay otomatis memakai mode
 *   "buat akun" sehingga tidak ada password bawaan yang harus ditebak.
 *
 * BATAS KEAMANAN
 * Ini bukan autentikasi server. CashFlow menyimpan data di localStorage,
 * jadi lapisan ini berfungsi sebagai kunci layar (screen lock) di perangkat
 * ini — bukan kontrol akses data. Backend Google Apps Script memakai
 * allowlist akun Google (`backend/apps-script/Auth.gs`) dan tidak
 * berhubungan dengan form ini.
 *
 * Tanpa dependensi. Kompatibel dengan skrip klasik (bukan ES module).
 */
(function () {
  'use strict';

  const AUTH_KEY = 'cashflow_auth_v1';
  const SESSION_KEY = 'cashflow_session_v1';
  const SESSION_MS = 8 * 60 * 60 * 1000; // 8 jam
  const MAX_FAILS = 5;
  const LOCK_MS = 30 * 1000; // jeda setelah 5 percobaan gagal
  const MIN_USERNAME = 3;
  const MIN_PASSWORD = 6;

  /** @type {{fails:number, lockedUntil:number, mode:'login'|'setup', busy:boolean}} */
  const state = { fails: 0, lockedUntil: 0, mode: 'login', busy: false };

  const listeners = new Set();

  // ------------------------------------------------------------------ utilitas

  function readJSON(storage, key) {
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeJSON(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(storage, key) {
    try {
      storage.removeItem(key);
    } catch (error) {
      /* storage bisa diblokir di mode privat */
    }
  }

  function randomHex(bytes) {
    const size = bytes || 16;
    const buffer = new Uint8Array(size);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(buffer);
    } else {
      for (let i = 0; i < size; i += 1) buffer[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(buffer, function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  /**
   * Hash teks menjadi hex. Memakai Web Crypto bila tersedia (konteks aman:
   * https atau localhost). Bila tidak, jatuh ke FNV-1a berulang yang jauh
   * lebih lemah — overlay menampilkan peringatan pada kasus itu.
   */
  async function hashText(text) {
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
      try {
        const data = new TextEncoder().encode(text);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return {
          alg: 'sha256',
          hex: Array.from(new Uint8Array(digest), function (b) {
            return b.toString(16).padStart(2, '0');
          }).join('')
        };
      } catch (error) {
        /* lanjut ke cadangan */
      }
    }

    return { alg: 'fnv', hex: fnvHex(text) };
  }

  function fnvHex(text) {
    // Empat state FNV-1a 32-bit paralel supaya hasilnya lebih panjang.
    const h = [0x811c9dc5, 0x01000193, 0x7fffffff, 0x9e3779b9];
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      for (let j = 0; j < 4; j += 1) {
        h[j] ^= code + j;
        h[j] = Math.imul(h[j], 16777619) >>> 0;
      }
    }
    return h.map(function (value) {
      return value.toString(16).padStart(8, '0');
    }).join('');
  }

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // ------------------------------------------------ penyimpanan akun & sesi

  function readAccount() {
    const account = readJSON(window.localStorage, AUTH_KEY);
    if (!account || typeof account.hash !== 'string' || typeof account.salt !== 'string') {
      return null;
    }
    return account;
  }

  async function createAccount(username, password) {
    const salt = randomHex(16);
    const hashed = await hashText(password + ':' + salt);
    const account = {
      version: 1,
      username: username,
      salt: salt,
      hash: hashed.hex,
      alg: hashed.alg,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    if (!writeJSON(window.localStorage, AUTH_KEY, account)) {
      throw new Error('Penyimpanan browser tidak dapat ditulis. Nonaktifkan mode privat lalu coba lagi.');
    }
    return account;
  }

  function readSession() {
    const session = readJSON(window.sessionStorage, SESSION_KEY);
    if (!session || typeof session.token !== 'string' || session.token === '') return null;
    if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      remove(window.sessionStorage, SESSION_KEY);
      return null;
    }
    return session;
  }

  function writeSession(account) {
    const session = {
      token: randomHex(32),
      username: account.username,
      expiresAt: Date.now() + SESSION_MS,
      savedAt: Date.now()
    };
    writeJSON(window.sessionStorage, SESSION_KEY, session);
    return session;
  }

  // ------------------------------------------------------------------ elemen

  const el = {};

  function cacheElements() {
    el.screen = document.getElementById('cf-login');
    el.form = document.getElementById('cf-login-form');
    el.username = document.getElementById('cf-login-user');
    el.password = document.getElementById('cf-login-pass');
    el.confirm = document.getElementById('cf-login-pass2');
    el.confirmField = document.getElementById('cf-login-pass2-field');
    el.error = document.getElementById('cf-login-error');
    el.submit = document.getElementById('cf-login-submit');
    el.toggle = document.getElementById('cf-login-toggle');
    el.title = document.getElementById('cf-login-title');
    el.subtitle = document.getElementById('cf-login-subtitle');
    el.switchWrap = document.getElementById('cf-login-switch');
    el.switchBtn = document.getElementById('cf-login-switch-btn');
    el.warn = document.getElementById('cf-login-warn');
    el.app = document.querySelector('.app-container');
  }

  function setError(message) {
    if (!el.error) return;
    el.error.textContent = message || '';
    if (el.username) el.username.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (el.password) el.password.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function setBusy(busy) {
    state.busy = busy;
    if (!el.submit) return;
    el.submit.disabled = busy;
    el.submit.dataset.busy = busy ? 'true' : 'false';
    const label = el.submit.querySelector('.cf-login-btn-label');
    if (label) label.textContent = busy ? 'Memeriksa…' : state.mode === 'setup' ? 'Buat akun' : 'Masuk';
  }

  function applyMode(mode) {
    state.mode = mode === 'setup' ? 'setup' : 'login';
    if (!el.form) return;

    if (el.title) el.title.textContent = 'CashFlow';
    if (el.subtitle) {
      el.subtitle.textContent = state.mode === 'setup'
        ? 'Buat akun lokal untuk mengunci data keuangan Anda.'
        : 'Masuk untuk membuka dasbor keuangan Anda.';
    }
    if (el.confirmField) el.confirmField.hidden = state.mode !== 'setup';
    if (el.confirm) el.confirm.required = state.mode === 'setup';
    if (el.switchWrap) el.switchWrap.hidden = false;
    if (el.switchBtn) {
      el.switchBtn.textContent = state.mode === 'setup' ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Buat sekarang';
    }
    setError('');
    setBusy(false);
  }

  function showWarnIfWeak() {
    if (!el.warn) return;
    const isWeak = !(window.crypto && window.crypto.subtle && window.crypto.subtle.digest);
    el.warn.hidden = !isWeak;
  }

  function lockApp() {
    document.body.classList.add('cf-locked');
    document.body.classList.remove('cf-authed');
    if (el.app && typeof el.app.setAttribute === 'function') el.app.setAttribute('inert', '');
  }

  function unlockApp() {
    document.body.classList.remove('cf-locked');
    document.body.classList.add('cf-authed');
    if (el.app && typeof el.app.removeAttribute === 'function') el.app.removeAttribute('inert');
  }

  function showOverlay() {
    if (!el.screen) return;
    el.screen.hidden = false;
    window.requestAnimationFrame(function () {
      if (el.username && !el.username.value) {
        try { el.username.focus({ preventScroll: true }); } catch (error) { /* noop */ }
      }
    });
  }

  function hideOverlay() {
    if (el.screen) el.screen.hidden = true;
  }

  function notify(type) {
    listeners.forEach(function (fn) {
      try { fn(type); } catch (error) { /* pendengar tidak boleh merusak login */ }
    });
    try {
      window.dispatchEvent(new CustomEvent('cashflow:auth', { detail: { type: type } }));
    } catch (error) {
      /* CustomEvent tidak tersedia di lingkungan sangat lama */
    }
  }

  // ------------------------------------------------------------------ aksi

  async function handleSetup() {
    const username = String(el.username.value || '').trim();
    const password = String(el.password.value || '');
    const confirm = String(el.confirm ? el.confirm.value : '');

    if (username.length < MIN_USERNAME) {
      return setError('Username minimal ' + MIN_USERNAME + ' karakter.');
    }
    if (password.length < MIN_PASSWORD) {
      return setError('Password minimal ' + MIN_PASSWORD + ' karakter.');
    }
    if (password !== confirm) {
      return setError('Konfirmasi password tidak sama.');
    }

    setBusy(true);
    setError('');
    try {
      const account = await createAccount(username, password);
      writeSession(account);
      finishLogin();
    } catch (error) {
      setError(error && error.message ? error.message : 'Gagal membuat akun.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    const now = Date.now();
    if (now < state.lockedUntil) {
      const seconds = Math.ceil((state.lockedUntil - now) / 1000);
      return setError('Terlalu banyak percobaan. Coba lagi dalam ' + seconds + ' detik.');
    }

    const account = readAccount();
    if (!account) {
      applyMode('setup');
      return setError('Belum ada akun di perangkat ini. Buat akun terlebih dahulu.');
    }

    const username = normalizeUsername(el.username.value);
    const password = String(el.password.value || '');

    if (!username || !password) {
      return setError('Username dan password wajib diisi.');
    }

    setBusy(true);
    setError('');

    try {
      const hashed = await hashText(password + ':' + account.salt);
      // Jeda kecil menyamakan waktu respons agar kegagalan username/password
      // tidak bisa dibedakan dari lamanya proses.
      await sleep(140);

      const userOk = normalizeUsername(account.username) === username;
      const passOk = hashed.hex === account.hash;

      if (!userOk || !passOk) {
        state.fails += 1;
        if (state.fails >= MAX_FAILS) {
          state.lockedUntil = Date.now() + LOCK_MS;
          state.fails = 0;
          setError('Terlalu banyak percobaan gagal. Tunggu 30 detik.');
        } else {
          setError('Username atau password salah.');
        }
        if (el.password) el.password.value = '';
        return;
      }

      state.fails = 0;
      writeSession(account);
      finishLogin();
    } finally {
      setBusy(false);
    }
  }

  function finishLogin() {
    setError('');
    if (el.password) el.password.value = '';
    if (el.confirm) el.confirm.value = '';
    unlockApp();
    hideOverlay();
    notify('login');
  }

  function logout() {
    remove(window.sessionStorage, SESSION_KEY);
    lockApp();
    applyMode('login');
    if (el.password) el.password.value = '';
    if (el.confirm) el.confirm.value = '';
    showOverlay();
    notify('logout');
  }

  function resetAccount() {
    remove(window.localStorage, AUTH_KEY);
    remove(window.sessionStorage, SESSION_KEY);
    state.fails = 0;
    state.lockedUntil = 0;
    lockApp();
    applyMode('setup');
    showOverlay();
    notify('reset');
  }

  // ------------------------------------------------------------------ acara

  function bindEvents() {
    if (!el.form) return;

    el.form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (state.busy) return;
      if (state.mode === 'setup') {
        handleSetup();
      } else {
        handleLogin();
      }
    });

    if (el.toggle) {
      el.toggle.addEventListener('click', function () {
        const pressed = el.toggle.getAttribute('aria-pressed') === 'true';
        const next = !pressed;
        el.toggle.setAttribute('aria-pressed', next ? 'true' : 'false');
        el.toggle.setAttribute('aria-label', next ? 'Sembunyikan password' : 'Tampilkan password');
        [el.password, el.confirm].forEach(function (input) {
          if (input) input.type = next ? 'text' : 'password';
        });
      });
    }

    if (el.switchBtn) {
      el.switchBtn.addEventListener('click', function () {
        if (state.busy) return;
        const next = state.mode === 'setup' ? 'login' : 'setup';
        applyMode(next);
        if (next === 'setup' && el.username) {
          try { el.username.focus(); } catch (error) { /* noop */ }
        }
      });
    }
  }

  /**
   * Tombol keluar permanen di dalam menu Pengaturan (index.html).
   * Tidak membuat elemen baru: hanya mengikat tombol yang sudah ada.
   */
  function bindSettingsLogout() {
    const button = document.getElementById('cf-settings-logout');
    if (!button || button.dataset.cfBound === 'true') return;

    button.dataset.cfBound = 'true';
    button.addEventListener('click', function () {
      logout();
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Anda telah keluar');
      }
    });
  }

  // ------------------------------------------------------------------ mulai

  function start() {
    cacheElements();
    if (!el.screen || !el.form) {
      // Markup overlay tidak ditemukan; jangan mengunci aplikasi.
      console.warn('[CashFlow] Overlay login tidak ditemukan; gerbang login dilewati.');
      return;
    }

    bindSettingsLogout();
    bindEvents();
    showWarnIfWeak();

    const account = readAccount();
    const session = readSession();

    if (session) {
      applyMode('login');
      unlockApp();
      hideOverlay();
    } else {
      if (account) {
        applyMode('login');
        if (el.username) el.username.value = account.username;
      } else {
        applyMode('setup');
      }
      lockApp();
      showOverlay();
    }

    // Periksa kedaluwarsa sesi secara berkala.
    let lastToken = session ? session.token : null;
    window.setInterval(function () {
      const current = readSession();
      if (!current) {
        if (lastToken !== null) {
          lastToken = null;
          lockApp();
          applyMode('login');
          showOverlay();
          notify('expired');
        }
      } else if (current.token !== lastToken) {
        lastToken = current.token;
      }
    }, 30 * 1000);
  }

  // API publik untuk keperluan lain (mis. tombol keluar di halaman pengaturan).
  window.cashflowAuth = {
    isAuthenticated: function () { return readSession() !== null; },
    hasAccount: function () { return readAccount() !== null; },
    session: function () { return readSession(); },
    logout: logout,
    resetAccount: resetAccount,
    onChange: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
