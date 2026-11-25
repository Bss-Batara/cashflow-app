/**
 * CashFlow - js/auth.js
 * Login/registrasi lewat Google Apps Script (token based).
 *
 * - Kredensial dikirim ke backend (action: login / register).
 * - Token sesi disimpan di sessionStorage dan dipakai js/api.js pada
 *   setiap permintaan data.
 * - Password tidak pernah disimpan di browser.
 */
(function () {
  'use strict';

  const SESSION_KEY = 'cashflow_session_v1';
  const MIN_USERNAME = 3;
  const MIN_PASSWORD = 8;

  const state = { mode: 'login', busy: false };
  const listeners = new Set();
  const el = {};

  function readSession() {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.token) return null;
      if (Number(session.expiresAt) <= Date.now()) {
        window.sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch (error) {
      return null;
    }
  }

  function writeSession(data) {
    const session = {
      token: String(data.token || ''),
      username: String(data.username || ''),
      expiresAt: data.expiresAt ? Date.parse(data.expiresAt) : Date.now() + 8 * 60 * 60 * 1000
    };
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      /* storage bisa diblokir */
    }
    return session;
  }

  function clearSession() {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* noop */
    }
  }

  function cacheElements() {
    el.screen = document.getElementById('cf-login');
    el.form = document.getElementById('cf-login-form');
    el.username = document.getElementById('cf-login-user');
    el.password = document.getElementById('cf-login-pass');
    el.confirm = document.getElementById('cf-login-pass2');
    el.confirmField = document.getElementById('cf-login-pass2-field');
    el.email = document.getElementById('cf-login-email');
    el.emailField = document.getElementById('cf-login-email-field');
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
  }

  function setBusy(busy) {
    state.busy = busy;
    if (!el.submit) return;
    el.submit.disabled = busy;
    el.submit.dataset.busy = busy ? 'true' : 'false';
    const label = el.submit.querySelector('.cf-login-btn-label');
    if (label) label.textContent = busy ? 'Memproses…' : state.mode === 'setup' ? 'Daftar' : 'Masuk';
  }

  function applyMode(mode) {
    state.mode = mode === 'register' ? 'register' : 'login';
    if (el.subtitle) {
      el.subtitle.textContent = state.mode === 'register'
        ? 'Buat akun CashFlow untuk menyimpan data di Spreadsheet.'
        : 'Masuk untuk membuka dasbor keuangan Anda.';
    }
    if (el.confirmField) el.confirmField.hidden = state.mode !== 'register';
    if (el.emailField) el.emailField.hidden = state.mode !== 'register';
    if (el.confirm) el.confirm.required = state.mode === 'register';
    if (el.switchBtn) {
      el.switchBtn.textContent = state.mode === 'register'
        ? 'Sudah punya akun? Masuk'
        : 'Belum punya akun? Daftar sekarang';
    }
    setError('');
    setBusy(false);
  }

  function lockApp() {
    document.body.classList.add('cf-locked');
    document.body.classList.remove('cf-authed');
    if (el.app) el.app.setAttribute('inert', '');
  }

  function unlockApp() {
    document.body.classList.remove('cf-locked');
    document.body.classList.add('cf-authed');
    if (el.app) el.app.removeAttribute('inert');
  }

  function showOverlay() {
    if (el.screen) el.screen.hidden = false;
  }

  function hideOverlay() {
    if (el.screen) el.screen.hidden = true;
  }

  function notify(type) {
    listeners.forEach(function (fn) {
      try { fn(type); } catch (error) { /* noop */ }
    });
    try {
      window.dispatchEvent(new CustomEvent('cashflow:auth', { detail: { type: type } }));
    } catch (error) {
      /* noop */
    }
  }

  function setSessionLabel(username) {
    const node = document.getElementById('cf-session-user');
    if (node) node.textContent = username || '—';
  }

  function finishLogin(data) {
    const session = writeSession(data);
    window.CashflowApi.setToken(session.token);
    setSessionLabel(session.username);
    setError('');
    if (el.password) el.password.value = '';
    if (el.confirm) el.confirm.value = '';
    unlockApp();
    hideOverlay();
    notify('login');
  }

  async function submitCredentials() {
    const username = String(el.username.value || '').trim();
    const password = String(el.password.value || '');
    const isRegister = state.mode === 'register';

    if (username.length < MIN_USERNAME) {
      return setError('Username minimal ' + MIN_USERNAME + ' karakter.');
    }
    if (password.length < MIN_PASSWORD) {
      return setError('Password minimal ' + MIN_PASSWORD + ' karakter.');
    }
    if (isRegister && el.confirm && el.confirm.value !== password) {
      return setError('Konfirmasi password tidak sama.');
    }

    setBusy(true);
    setError('');

    try {
      const params = { username: username, password: password };
      if (isRegister) {
        const email = String((el.email && el.email.value) || '').trim();
        if (email) params.email = email;
      }
      const data = await window.CashflowApi.get(isRegister ? 'register' : 'login', params);
      finishLogin(data);
    } catch (error) {
      const message = String((error && error.message) || '');
      const notDeployed = /Unsupported action|not found|tidak dikenal/i.test(message);
      setError(notDeployed
        ? 'Backend GAS belum memuat login. Deploy ulang Apps Script (versi baru) lalu coba lagi.'
        : (error && error.message ? error.message : 'Gagal menghubungi server.'));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    const session = readSession();
    if (session && session.token && window.CashflowApi) {
      window.CashflowApi.post('logout', { token: session.token }).catch(function () {
        /* logout tetap dianggap berhasil di sisi klien */
      });
    }
    clearSession();
    if (window.CashflowApi) window.CashflowApi.setToken('');
    lockApp();
    applyMode('login');
    if (el.password) el.password.value = '';
    showOverlay();
    notify('logout');
  }

  function bindEvents() {
    if (!el.form) return;

    el.form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!state.busy) submitCredentials();
    });

    if (el.toggle) {
      el.toggle.addEventListener('click', function () {
        const next = el.toggle.getAttribute('aria-pressed') !== 'true';
        el.toggle.setAttribute('aria-pressed', next ? 'true' : 'false');
        [el.password, el.confirm].forEach(function (input) {
          if (input) input.type = next ? 'text' : 'password';
        });
      });
    }

    if (el.switchBtn) {
      el.switchBtn.addEventListener('click', function () {
        if (state.busy) return;
        applyMode(state.mode === 'register' ? 'login' : 'register');
      });
    }

    const settingsLogout = document.getElementById('cf-settings-logout');
    if (settingsLogout) {
      settingsLogout.addEventListener('click', function () {
        logout();
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Anda telah keluar');
        }
      });
    }
  }

  function start() {
    cacheElements();
    if (!el.screen || !el.form) {
      console.warn('[CashFlow] Overlay login tidak ditemukan; gerbang login dilewati.');
      return;
    }

    bindEvents();
    if (el.warn) el.warn.hidden = true;

    const session = readSession();
    if (!session) {
      lockApp();
      applyMode('login');
      showOverlay();
      startWatch();
      return;
    }

    // Token dari sessionStorage TIDAK dipercaya begitu saja: verifikasi ke
    // server agar sesi lama/basi tidak membuka aplikasi dengan data lokal.
    lockApp();
    applyMode('login');
    showOverlay();
    window.CashflowApi.setToken(session.token);

    window.CashflowApi.get('me')
      .then(function (user) {
        if (user && user.username) {
          writeSession({ token: session.token, username: user.username, expiresAt: user.expiresAt });
          setSessionLabel(user.username);
        }
        unlockApp();
        hideOverlay();
        notify('login');
      })
      .catch(function (error) {
        const message = String((error && error.message) || '');
        const offline = /timed out|could not be reached|Failed to fetch|NetworkError/i.test(message);

        if (offline) {
          // Backend tidak terjangkau: data lokal tetap boleh dibuka.
          unlockApp();
          hideOverlay();
          notify('login');
          return;
        }

        clearSession();
        window.CashflowApi.setToken('');
        setError('Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.');
      });

    startWatch();
  }

  function startWatch() {
    window.addEventListener('cashflow:auth', function (event) {
      if (event.detail && event.detail.type === 'login' && window.app) {
        if (typeof window.app.syncFromSpreadsheet === 'function') {
          window.app.syncFromSpreadsheet();
        }
      }
    });

    window.setInterval(function () {
      if (!readSession() && document.body.classList.contains('cf-authed')) {
        lockApp();
        applyMode('login');
        showOverlay();
        notify('expired');
      }
    }, 30000);
  }

  window.cashflowAuth = {
    isAuthenticated: function () { return readSession() !== null; },
    session: function () { return readSession(); },
    logout: logout,
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
