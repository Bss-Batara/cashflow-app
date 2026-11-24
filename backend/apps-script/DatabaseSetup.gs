/**
 * Cashflow database foundation setup.
 *
 * Safety guarantees:
 * - Missing sheets are created with approved headers.
 * - Existing sheets are never deleted.
 * - Existing sheet values and headers are never overwritten.
 * - Existing records are never read-modify-written by setup.
 * - Schema verification reports issues instead of repairing them.
 * - No CRUD or production web endpoint is implemented here.
 */
function setupCashflowDatabase() {
  const config = getCashflowConfig_();
  const auth = requireAuthorizedUser();
  const lock = LockService.getScriptLock();
  lock.waitLock(config.setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const report = initializeMissingSheets_(spreadsheet);
    report.authorization = { email: auth.email, verified: true };
    report.verification = verifyCashflowSchema_(spreadsheet);
    return report;
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/** Creates only absent sheets; existing sheets are left untouched. */
function initializeMissingSheets_(spreadsheet) {
  const config = getCashflowConfig_();
  const created = [];
  const existing = [];
  const protection = [];

  config.requiredSheets.forEach(sheetName => {
    const expectedHeaders = getExpectedHeaders_(sheetName);
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (sheet) {
      existing.push(sheetName);
      return;
    }

    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.setFrozenRows(1);
    created.push(sheetName);
    protection.push({
      sheetName: sheetName,
      result: protectHeaderIfPossible_(sheet, expectedHeaders, true)
    });
  });

  // Populate Schema documentation only when Schema itself was newly created.
  // Existing Schema data is never replaced or appended during initialization.
  if (created.includes('Schema')) {
    const schemaSheet = spreadsheet.getSheetByName('Schema');
    const rows = getSchemaRows_();
    if (rows.length) {
      schemaSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
  }

  return {
    schemaVersion: config.schemaVersion,
    createdSheets: created,
    existingSheetsPreserved: existing,
    headerProtection: protection
  };
}

/** Verifies names and exact header order without modifying anything. */
function verifyCashflowSchema(spreadsheetId) {
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(String(spreadsheetId))
    : getConfiguredSpreadsheet_();
  return verifyCashflowSchema_(spreadsheet);
}

function verifyCashflowSchema_(spreadsheet) {
  const config = getCashflowConfig_();
  const results = [];

  config.requiredSheets.forEach(sheetName => {
    const expected = getExpectedHeaders_(sheetName);
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      results.push({
        sheetName: sheetName,
        status: 'MISSING_SHEET',
        expectedHeaders: expected,
        actualHeaders: []
      });
      return;
    }

    const width = Math.max(sheet.getLastColumn(), expected.length, 1);
    const actual = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
    const normalizedActual = actual.slice(0, expected.length);
    const exact = expected.length === sheet.getLastColumn() &&
      expected.every((header, index) => normalizedActual[index] === header);

    results.push({
      sheetName: sheetName,
      status: exact ? 'OK' : 'HEADER_MISMATCH',
      expectedHeaders: expected,
      actualHeaders: actual,
      lastRow: sheet.getLastRow(),
      lastColumn: sheet.getLastColumn()
    });
  });

  return {
    schemaVersion: config.schemaVersion,
    spreadsheetName: spreadsheet.getName(),
    valid: results.every(result => result.status === 'OK'),
    sheets: results
  };
}

/** Diagnostic helper for duplicate initialization tests. */
function verifyCashflowInitializationSafety() {
  const config = getCashflowConfig_();
  const first = setupCashflowDatabase();
  const second = setupCashflowDatabase();
  return {
    firstRun: first,
    secondRun: second,
    safe: second.createdSheets.length === 0 &&
      second.existingSheetsPreserved.length === config.requiredSheets.length
  };
}
