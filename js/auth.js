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
  // Pendaftaran publik aktif kembali (action register tersedia di Api.gs).
  const REGISTRATION_OPEN = true;

  const state = { mode: 'login', busy: false, resetToken: '' };
  const listeners = new Set();
  const el = {};

  function sessionStore() {
    // localStorage agar sesi bertahan setelah refresh / aplikasi ditutup.
    try {
      window.localStorage.setItem('__cf_probe', '1');
      window.localStorage.removeItem('__cf_probe');
      return window.localStorage;
    } catch (error) {
      return window.sessionStorage;
    }
  }

  function readSession() {
    try {
      const store = sessionStore();
      let raw = store.getItem(SESSION_KEY);

      // Migrasi dari versi lama yang menyimpan sesi di sessionStorage.
      if (!raw) {
        const legacy = window.sessionStorage.getItem(SESSION_KEY);
        if (legacy) {
          store.setItem(SESSION_KEY, legacy);
          window.sessionStorage.removeItem(SESSION_KEY);
          raw = legacy;
        }
      }

      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.token) return null;
      if (Number(session.expiresAt) <= Date.now()) {
        store.removeItem(SESSION_KEY);
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
      sessionStore().setItem(SESSION_KEY, JSON.stringify(session));
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* storage bisa diblokir */
    }
    return session;
  }

  function clearSession() {
    try {
      sessionStore().removeItem(SESSION_KEY);
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

    el.forgotPanel = document.getElementById('cf-forgot-panel');
    el.forgotEmail = document.getElementById('cf-forgot-email');
    el.forgotMessage = document.getElementById('cf-forgot-message');
    el.forgotSubmit = document.getElementById('cf-forgot-submit');
    el.resetPanel = document.getElementById('cf-reset-panel');
    el.resetPass = document.getElementById('cf-reset-pass');
    el.resetPass2 = document.getElementById('cf-reset-pass2');
    el.resetMessage = document.getElementById('cf-reset-message');
    el.resetSubmit = document.getElementById('cf-reset-submit');
  }

  function passwordProblem(value) {
    const pw = String(value || '');
    if (pw.length < MIN_PASSWORD) return 'Password minimal 8 karakter.';
    if (!/[A-Za-z]/.test(pw)) return 'Password harus mengandung huruf.';
    if (!/[0-9]/.test(pw)) return 'Password harus mengandung angka.';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'Password harus mengandung simbol, misalnya ! @ # \$ %.';
    return '';
  }
  function setError(message) {
    if (!el.error) return;
    el.error.style.color = '';
    el.error.textContent = message || '';
  }

  function setBusy(busy) {
    state.busy = busy;
    if (!el.submit) return;
    el.submit.disabled = busy;
    el.submit.dataset.busy = busy ? 'true' : 'false';
    const label = el.submit.querySelector('.cf-login-btn-label');
    if (label) label.textContent = busy ? 'Memproses…' : (state.mode === 'register' ? 'Daftar' : 'Masuk');
  }

  function applyMode(mode) {
    const next = ['register', 'forgot', 'reset'].indexOf(mode) !== -1 ? mode : 'login';
    state.mode = (next === 'register' && !REGISTRATION_OPEN) ? 'login' : next;
    const authMode = state.mode === 'login' || state.mode === 'register';

    if (el.form) el.form.hidden = !authMode;
    if (el.forgotPanel) el.forgotPanel.hidden = state.mode !== 'forgot';
    if (el.resetPanel) el.resetPanel.hidden = state.mode !== 'reset';

    if (!authMode) {
      setError('');
      return;
    }

    if (el.subtitle) {
      el.subtitle.textContent = state.mode === 'register'
        ? 'Buat akun CashFlow untuk menyimpan data di Spreadsheet.'
        : 'Masuk untuk membuka dasbor keuangan Anda.';
    }
    if (el.confirmField) el.confirmField.hidden = state.mode !== 'register';
    if (el.emailField) el.emailField.hidden = state.mode !== 'register';
    if (el.confirm) el.confirm.required = state.mode === 'register';
    if (el.email) el.email.required = state.mode === 'register';
    if (el.password) {
      el.password.placeholder = state.mode === 'register'
        ? 'Min. 8 karakter: huruf, angka, simbol'
        : 'Password';
    }
    if (el.switchWrap) el.switchWrap.hidden = !REGISTRATION_OPEN;
    if (el.switchBtn) {
      el.switchBtn.innerHTML = state.mode === 'register'
        ? 'Sudah punya akun?<br>Masuk di sini'
        : 'Belum punya akun?<br>Daftar sekarang';
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
    if (isRegister) {
      const problem = passwordProblem(password);
      if (problem) return setError(problem);
    }
    if (isRegister && el.confirm && el.confirm.value !== password) {
      return setError('Konfirmasi password tidak sama.');
    }

    const email = String((el.email && el.email.value) || '').trim();
    if (isRegister && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return setError('Email Google wajib diisi dengan benar.');
    }

    setBusy(true);
    setError('');

    try {
      const params = { username: username, password: password };
      if (isRegister) params.email = email;
      const data = await window.CashflowApi.get(isRegister ? 'register' : 'login', params);
      finishLogin(data);
    } catch (error) {
      const message = String((error && error.message) || '');
      if (/Unsupported action/i.test(message)) {
        setError('Server menolak aksi ' + (isRegister ? 'register' : 'login') + ' (' + message + ').');
      } else {
        setError(message || 'Gagal menghubungi server.');
      }
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

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    button.dataset.busy = busy ? 'true' : 'false';
    const text = button.querySelector('.cf-login-btn-label');
    if (text && label) text.textContent = label;
  }

  async function sendForgotPassword() {
    const email = String((el.forgotEmail && el.forgotEmail.value) || '').trim();
    const showMessage = (message, ok) => {
      if (!el.forgotMessage) return;
      el.forgotMessage.style.color = ok ? '#059669' : '';
      el.forgotMessage.textContent = message || '';
    };

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showMessage('Masukkan alamat email yang valid.');
      return;
    }

    showMessage('');
    setButtonBusy(el.forgotSubmit, true, 'Mengirim…');
    try {
      await window.CashflowApi.get('forgotPassword', { email: email });
      showMessage('Jika email tersebut terdaftar, tautan reset sudah dikirim. Periksa kotak masuk dan folder spam.', true);
      if (el.forgotEmail) el.forgotEmail.value = '';
    } catch (error) {
      showMessage(error && error.message ? error.message : 'Gagal mengirim tautan reset.');
    } finally {
      setButtonBusy(el.forgotSubmit, false, 'Kirim Tautan Reset');
    }
  }

  async function sendResetPassword() {
    const password = String((el.resetPass && el.resetPass.value) || '');
    const confirm = String((el.resetPass2 && el.resetPass2.value) || '');
    const showMessage = (message, ok) => {
      if (!el.resetMessage) return;
      el.resetMessage.style.color = ok ? '#059669' : '';
      el.resetMessage.textContent = message || '';
    };

    if (!state.resetToken) {
      showMessage('Tautan reset tidak valid. Silakan minta tautan baru.');
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      showMessage(problem);
      return;
    }
    if (password !== confirm) {
      showMessage('Konfirmasi password tidak sama.');
      return;
    }

    showMessage('');
    setButtonBusy(el.resetSubmit, true, 'Menyimpan…');
    try {
      await window.CashflowApi.get('resetPassword', {
        token: state.resetToken,
        newPassword: password
      });

      state.resetToken = '';
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch (error) {
        /* abaikan */
      }

      applyMode('login');
      if (el.error) {
        el.error.style.color = '#059669';
        el.error.textContent = 'Password berhasil diperbarui. Silakan masuk dengan password baru.';
      }
    } catch (error) {
      showMessage(error && error.message ? error.message : 'Gagal menyimpan password baru.');
    } finally {
      setButtonBusy(el.resetSubmit, false, 'Simpan Password Baru');
    }
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
      el.switchBtn.addEventListener('click', function (event) {
        if (event) event.preventDefault();
        if (state.busy || !REGISTRATION_OPEN) return;
        applyMode(state.mode === 'register' ? 'login' : 'register');
      });
    }

    const forgotLink = document.getElementById('cf-forgot-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', function () { applyMode('forgot'); });
    }

    const forgotBack = document.getElementById('cf-forgot-back');
    if (forgotBack) {
      forgotBack.addEventListener('click', function () { applyMode('login'); });
    }

    if (el.forgotSubmit) {
      el.forgotSubmit.addEventListener('click', sendForgotPassword);
    }
    if (el.forgotEmail) {
      el.forgotEmail.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); sendForgotPassword(); }
      });
    }
    if (el.resetSubmit) {
      el.resetSubmit.addEventListener('click', sendResetPassword);
    }
    [el.resetPass, el.resetPass2].forEach(function (input) {
      if (!input) return;
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); sendResetPassword(); }
      });
    });

    const settingsLogout = document.getElementById('cf-settings-logout');
    if (settingsLogout) {
      settingsLogout.addEventListener('click', function () {
        logout();
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Anda telah keluar');
        }
      });
    }

    const testButton = document.getElementById('cf-test-conn');
    if (testButton) {
      testButton.addEventListener('click', async function () {
        setError('Menghubungi server�');
        try {
          const info = await window.CashflowApi.get('health');
          setError('');
          const scope = document.getElementById('cf-login-error');
          if (scope) {
            scope.style.color = '#059669';
            scope.textContent = 'Server terhubung (schema ' + (info && info.schemaVersion ? info.schemaVersion : '?') + ').';
          }
        } catch (error) {
          setError('Koneksi gagal: ' + (error && error.message ? error.message : 'tidak diketahui'));
        }
      });
    }
    const passwordForm = document.getElementById('cf-change-password');
    if (passwordForm) {
      passwordForm.addEventListener('submit', function (event) {
        event.preventDefault();
        changePassword();
      });
    }
  }

  async function changePassword() {
    const current = document.getElementById('cf-pw-current');
    const next = document.getElementById('cf-pw-new');
    const confirm = document.getElementById('cf-pw-confirm');
    const errorNode = document.getElementById('cf-pw-error');
    const session = readSession();

    const showError = (message) => {
      if (errorNode) errorNode.textContent = message || '';
      if (window.app && typeof window.app.showToast === 'function' && message) {
        window.app.showToast(message);
      }
    };

    if (!session || !session.token) return showError('Sesi tidak ditemukan. Silakan masuk lagi.');
    if (!current.value) return showError('Isi password saat ini.');
    const problem = passwordProblem(next.value);
    if (problem) return showError(problem);
    if (next.value !== confirm.value) return showError('Konfirmasi password baru tidak sama.');

    try {
      await window.CashflowApi.get('changePassword', {
        currentPassword: current.value,
        newPassword: next.value
      });
      showError('');
      current.value = '';
      next.value = '';
      confirm.value = '';
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Password berhasil diganti');
      }
    } catch (error) {
      showError(error && error.message ? error.message : 'Gagal mengganti password.');
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

    const urlResetToken = (function () {
      try {
        return new URLSearchParams(window.location.search).get('reset_token') || '';
      } catch (error) {
        return '';
      }
    })();

    if (urlResetToken) {
      state.resetToken = urlResetToken;
      lockApp();
      applyMode('reset');
      showOverlay();
      startWatch();
      return;
    }

    const session = readSession();
    if (!session) {
      lockApp();
      applyMode('login');
      showOverlay();
      startWatch();
      return;
    }

    // Sesi tersimpan: buka aplikasi langsung supaya refresh tidak melempar
    // pengguna ke halaman login. Validasi token tetap berjalan di latar.
    window.CashflowApi.setToken(session.token);
    setSessionLabel(session.username || '');
    unlockApp();
    hideOverlay();
    notify('login');

    window.CashflowApi.get('me')
      .then(function (user) {
        if (user && user.username) {
          writeSession({ token: session.token, username: user.username, expiresAt: user.expiresAt });
          setSessionLabel(user.username);
        }
      })
      .catch(function (error) {
        const message = String((error && error.message) || '');
        const offline = /timed out|could not be reached|Failed to fetch|NetworkError|Tidak dapat menghubungi/i.test(message);
        if (offline) return;

        clearSession();
        window.CashflowApi.setToken('');
        lockApp();
        applyMode('login');
        setError('Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.');
        showOverlay();
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
