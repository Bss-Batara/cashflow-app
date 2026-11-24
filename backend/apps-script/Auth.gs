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
