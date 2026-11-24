/**
 * Cashflow database foundation configuration.
 *
 * Deployment requirement:
 * - Execute as: user accessing the web app
 * - Access: logged-in Google users only
 * - Anonymous access: disabled
 *
 * The manifest's webapp block documents the intended deployment configuration.
 * No doGet/doPost handler is included in this foundation release.
 */
/**
 * Returns the canonical Cashflow configuration.
 *
 * This is intentionally a function rather than a global const. Apps Script
 * projects share one global scope, and top-level cross-file initialization can
 * fail when files are transferred or reordered.
 */
function getCashflowConfig_() {
  return Object.freeze({
    schemaVersion: '1.0.0',
    allowlistProperty: 'CASHFLOW_ALLOWED_USERS_V1',
    spreadsheetIdProperty: 'CASHFLOW_SPREADSHEET_ID_V1',
    setupLockTimeoutMs: 30000,
    requiredSheets: [
      'Transactions',
      'Investments',
      'Categories',
      'Budgets',
      'Settings',
      'AuditLog',
      'Schema'
    ]
  });
}

/**
 * Stores the target spreadsheet ID in Script Properties.
 * This is intended for manual administrator setup only.
 * It does not expose the ID to the frontend.
 */
function configureSpreadsheetId(spreadsheetId) {
  const config = getCashflowConfig_();
  const normalized = String(spreadsheetId || '').trim();
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(normalized)) {
    throw new Error('A valid Google Spreadsheet ID is required.');
  }

  const currentUser = Session.getEffectiveUser().getEmail();
  if (!currentUser) {
    throw new Error('Cannot identify the administrator. Configuration aborted.');
  }

  PropertiesService.getScriptProperties()
    .setProperty(config.spreadsheetIdProperty, normalized);

  return { configured: true, configuredBy: currentUser.toLowerCase() };
}

/**
 * Stores the ID of the spreadsheet bound to this Apps Script project.
 * Run this no-argument helper from the Apps Script editor when the project
 * is attached to the target Spreadsheet.
 */
function configureCurrentSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      'No active Spreadsheet is available. Use configureSpreadsheetId with the target ID.'
    );
  }

  return configureSpreadsheetId(spreadsheet.getId());
}

function getConfiguredSpreadsheet_() {
  const config = getCashflowConfig_();
  const id = PropertiesService.getScriptProperties()
    .getProperty(config.spreadsheetIdProperty);

  if (!id) {
    throw new Error('Spreadsheet ID is not configured. Run configureSpreadsheetId first.');
  }

  return SpreadsheetApp.openById(id);
}
