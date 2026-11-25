/**
 * Fail-closed authentication and explicit access allowlist.
 *
 * A blank active-user email is never accepted. The frontend cannot provide
 * or override the authenticated identity.
 */
// Apps Script evaluates project files in one global scope. Keep authentication
// configuration behind a function so Auth.gs has no cross-file global
// initialization dependency and no global authentication constant that can
// collide with manually transferred code.
function getCashflowAuthConfig_() {
  return Object.freeze({
    allowlistKey: getCashflowConfig_().allowlistProperty
  });
}

/**
 * Configure the explicit Google account allowlist.
 * Run manually by an administrator from the Apps Script editor.
 *
 * @param {string[]} emails Google account email addresses.
 */
function configureAllowedUsers(emails) {
  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error('At least one allowlisted email address is required.');
  }

  const normalized = emails
    .map(email => String(email || '').trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length !== emails.length || normalized.some(email => !isEmail_(email))) {
    throw new Error('The allowlist contains an invalid email address.');
  }

  const unique = [...new Set(normalized)];
  const authConfig = getCashflowAuthConfig_();
  PropertiesService.getScriptProperties()
    .setProperty(authConfig.allowlistKey, JSON.stringify(unique));

  return { configured: true, count: unique.length };
}

/**
 * Configures the approved test account for manual Apps Script verification.
 * This is an administrator-only setup helper, not a production endpoint.
 */
function setupCashflowTestAllowlist() {
  return configureAllowedUsers(['bssbatara@gmail.com']);
}

function readCashflowAllowlist_() {
  const authConfig = getCashflowAuthConfig_();
  const raw = PropertiesService.getScriptProperties()
    .getProperty(authConfig.allowlistKey);

  if (!raw) {
    return {
      propertyKey: authConfig.allowlistKey,
      propertyExists: false,
      parsesCorrectly: false,
      users: new Set()
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      propertyKey: authConfig.allowlistKey,
      propertyExists: true,
      parsesCorrectly: false,
      users: new Set()
    };
  }

  const valid = Array.isArray(parsed) && parsed.length > 0 &&
    parsed.every(email => isEmail_(String(email || '').trim().toLowerCase()));

  return {
    propertyKey: authConfig.allowlistKey,
    propertyExists: true,
    parsesCorrectly: valid,
    users: valid
      ? new Set(parsed.map(email => String(email).trim().toLowerCase()))
      : new Set()
  };
}

function getAllowedUsers_() {
  const state = readCashflowAllowlist_();

  if (!state.propertyExists) {
    throw new Error('Access allowlist is not configured. Access denied.');
  }

  if (!state.parsesCorrectly) {
    throw new Error('Access allowlist is malformed or empty. Access denied.');
  }

  return state.users;
}

/**
 * Reports allowlist configuration health without exposing the stored emails.
 */
function diagnoseCashflowAllowlist() {
  const state = readCashflowAllowlist_();
  const activeEmail = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const effectiveEmail = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();

  return {
    propertyKey: state.propertyKey,
    propertyExists: state.propertyExists,
    parsesCorrectly: state.parsesCorrectly,
    storedEntryCount: state.users.size,
    activeEmail: activeEmail,
    activeIdentityPresent: Boolean(activeEmail),
    effectiveIdentityPresent: Boolean(effectiveEmail),
    activeIdentityAllowlisted: Boolean(
      activeEmail && state.parsesCorrectly && state.users.has(activeEmail)
    ),
    failClosed: true
  };
}

/**
 * Returns the authenticated active user or throws.
 * This is intentionally not used by initialization until the allowlist exists.
 */
function requireAuthorizedUser() {
  // Identitas dari token login (username/password) diutamakan bila ada.
  if (CASHFLOW_REQUEST_IDENTITY) {
    return CASHFLOW_REQUEST_IDENTITY;
  }

  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();

  if (!email) {
    throw new Error('Authenticated Google account could not be verified. Access denied.');
  }

  if (!getAllowedUsers_().has(email)) {
    throw new Error('Google account is not allowlisted. Access denied.');
  }

  return { email: email };
}

/**
 * Manual deployment diagnostic. This reports identity state without granting
 * access and without touching spreadsheet data.
 */
function verifyAuthenticationConfiguration() {
  const allowlistDiagnostic = diagnoseCashflowAllowlist();

  return {
    executeAs: 'USER_ACCESSING',
    access: 'ANYONE_LOGGED_IN',
    anonymousAccess: false,
    propertyKey: allowlistDiagnostic.propertyKey,
    propertyExists: allowlistDiagnostic.propertyExists,
    parsesCorrectly: allowlistDiagnostic.parsesCorrectly,
    activeEmail: allowlistDiagnostic.activeEmail,
    activeIdentityPresent: allowlistDiagnostic.activeIdentityPresent,
    activeIdentityAllowlisted: allowlistDiagnostic.activeIdentityAllowlisted,
    effectiveIdentityPresent: allowlistDiagnostic.effectiveIdentityPresent,
    accessWouldBeGranted: allowlistDiagnostic.activeIdentityAllowlisted,
    failClosed: true
  };
}

function isEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ============================================================
   Autentikasi username/password untuk frontend (token based).
   Password tidak pernah disimpan mentah: SHA-256 + salt acak.
   Token disimpan di Script Properties dengan masa berlaku 8 jam.
   ============================================================ */

/** @type {{username: string, ownerId: string}|null} */
var CASHFLOW_REQUEST_IDENTITY = null;

var CASHFLOW_USERS_PROPERTY = 'CASHFLOW_USERS_V1';
var CASHFLOW_TOKENS_PROPERTY = 'CASHFLOW_TOKENS_V1';
var CASHFLOW_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
var CASHFLOW_MAX_LOGIN_FAILS = 5;
var CASHFLOW_LOGIN_LOCK_SECONDS = 600;

function cashflowHex_(bytes) {
  return bytes.map(function (byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function cashflowHashPassword_(password, salt) {
  return cashflowHex_(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password) + ':' + salt,
    Utilities.Charset.UTF_8
  ));
}

function readCashflowUsers_() {
  var raw = PropertiesService.getScriptProperties().getProperty(CASHFLOW_USERS_PROPERTY);
  if (!raw) return {};
  try {
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeCashflowUsers_(users) {
  PropertiesService.getScriptProperties()
    .setProperty(CASHFLOW_USERS_PROPERTY, JSON.stringify(users));
}

function readCashflowTokens_() {
  var raw = PropertiesService.getScriptProperties().getProperty(CASHFLOW_TOKENS_PROPERTY);
  if (!raw) return {};
  try {
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeCashflowTokens_(tokens) {
  var now = Date.now();
  var active = {};
  Object.keys(tokens).forEach(function (token) {
    if (tokens[token] && tokens[token].expiresAt > now) active[token] = tokens[token];
  });
  PropertiesService.getScriptProperties()
    .setProperty(CASHFLOW_TOKENS_PROPERTY, JSON.stringify(active));
}

function cashflowNormalizeUsername_(value) {
  return String(value || '').trim().toLowerCase();
}

function cashflowValidateCredentials_(input) {
  var username = cashflowNormalizeUsername_(input && input.username);
  var password = String((input && input.password) || '');

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('Username must be 3-32 characters: a-z, 0-9, dot, underscore or dash.');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  if (password.length > 200) {
    throw new Error('Password is too long.');
  }

  return { username: username, password: password };
}

/**
 * Mendaftarkan akun baru. `email` opsional; bila diisi, email dipakai
 * sebagai ownerId agar data lama (dimiliki email Google) tetap terlihat.
 */
function registerUser(input) {
  var credentials = cashflowValidateCredentials_(input);
  var users = readCashflowUsers_();

  if (users[credentials.username]) {
    throw new Error('Username sudah terdaftar.');
  }

  var email = String((input && input.email) || '').trim().toLowerCase();
  if (email && !isEmail_(email)) {
    throw new Error('Email tidak valid.');
  }

  var salt = Utilities.getUuid().replace(/-/g, '');
  users[credentials.username] = {
    username: credentials.username,
    ownerId: email || credentials.username,
    email: email,
    salt: salt,
    hash: cashflowHashPassword_(credentials.password, salt),
    createdAt: new Date().toISOString()
  };
  writeCashflowUsers_(users);

  return cashflowIssueToken_(users[credentials.username]);
}

function loginUser(input) {
  var credentials = cashflowValidateCredentials_(input);
  var cacheKey = 'cashflow-login-fail:' + credentials.username;
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get(cacheKey) || 0);

  if (fails >= CASHFLOW_MAX_LOGIN_FAILS) {
    throw new Error('Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.');
  }

  var users = readCashflowUsers_();
  var user = users[credentials.username];

  if (!user || user.hash !== cashflowHashPassword_(credentials.password, user.salt)) {
    cache.put(cacheKey, String(fails + 1), CASHFLOW_LOGIN_LOCK_SECONDS);
    throw new Error('Username atau password salah.');
  }

  cache.remove(cacheKey);
  return cashflowIssueToken_(user);
}

function cashflowIssueToken_(user) {
  // Pastikan pemilik punya kategori bawaan agar bisa menyimpan transaksi.
  try {
    seedDefaultCategoriesFor_(user.ownerId || user.username);
  } catch (error) {
    Logger.log('Category seed skipped: ' + error.message);
  }

  var tokens = readCashflowTokens_();
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var expiresAt = Date.now() + CASHFLOW_TOKEN_TTL_MS;

  tokens[token] = {
    username: user.username,
    ownerId: user.ownerId || user.username,
    expiresAt: expiresAt
  };
  writeCashflowTokens_(tokens);

  return {
    token: token,
    username: user.username,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

function logoutUser(token) {
  var tokens = readCashflowTokens_();
  var key = String(token || '').trim();
  if (key && tokens[key]) {
    delete tokens[key];
    writeCashflowTokens_(tokens);
  }
  return { loggedOut: true };
}

function currentUser(token) {
  var tokens = readCashflowTokens_();
  var session = tokens[String(token || '').trim()];
  if (!session || session.expiresAt <= Date.now()) {
    throw new Error('Sesi tidak valid atau sudah berakhir.');
  }
  return {
    username: session.username,
    ownerId: session.ownerId,
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

/**
 * Menentukan identitas request: token lebih dulu, lalu akun Google.
 * Dipakai Api.gs sebelum dispatch aksi apa pun.
 */
function resolveApiIdentity_(request) {
  var source = request.method === 'GET' ? request.parameters : (request.body || {});
  var payload = source.payload || source;
  var token = String(payload.token || source.token || '').trim();

  if (token) {
    var session = currentUser(token);
    return { email: session.ownerId, username: session.username, token: token };
  }

  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email && getAllowedUsers_().has(email)) {
    return { email: email, username: email, token: '' };
  }

  throw new Error('Access denied. Silakan login terlebih dahulu.');
}
