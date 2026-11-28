/**
 * Investments CRUD foundation.
 * Investments are persisted in the Investments sheet and scoped to the
 * authenticated allowlisted owner.
 */
function createInvestment(input) {
  const auth = requireAuthorizedUser();
  const payload = validateInvestmentInput_(input, false);
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Investments', spreadsheet);
    const now = new Date();

    // Idempotency lintas perangkat: client_ref opsional (helper bersama di Transactions.gs).
    const clientRef = normalizeClientRef_(input);
    if (clientRef) {
      const values = sheet.getDataRange().getValues();
      const found = findRowByClientRef_(values, auth.email, clientRef, 12, 1, 18);
      if (found) {
        return investmentToObject_(found);
      }
      ensureClientRefHeader_(sheet, getExpectedHeaders_('Investments'));
    }

    const investmentId = Utilities.getUuid();
    const row = [
      investmentId, auth.email, payload.name, payload.code, payload.categoryId,
      payload.buyPriceMinor, payload.currentPriceMinor, payload.units,
      payload.unitName, payload.unitMultiplier, payload.dateBought, payload.notes,
      'active', now, auth.email, now, auth.email, 1, clientRef
    ];

    sheet.appendRow(row);
    appendTransactionAudit_(spreadsheet, {
      ownerId: auth.email, actorId: auth.email, actorEmail: auth.email,
      action: 'CREATE_INVESTMENT', entityType: 'Investment',
      entityId: investmentId, result: 'success'
    });
    return investmentToObject_(row);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function listInvestments(options) {
  const auth = requireAuthorizedUser();
  const spreadsheet = getConfiguredSpreadsheet_();
  const sheet = getRequiredSheet_('Investments', spreadsheet);
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1)
    .filter(row => String(row[1]).toLowerCase() === auth.email)
    .filter(row => !options || options.includeVoided || row[12] === 'active')
    .map(investmentToObject_);
  return { items: rows, count: rows.length };
}

function updateInvestment(input) {
  const auth = requireAuthorizedUser();
  const payload = validateInvestmentInput_(input, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Investments', spreadsheet);
    const values = sheet.getDataRange().getValues();
    const rowIndex = values.findIndex(row => row[0] === payload.investmentId && row[1] === auth.email);
    if (rowIndex < 1) throw new Error('Investment not found.');

    const current = values[rowIndex];
    if (current[12] === 'voided') throw new Error('Voided investments cannot be updated.');
    if (payload.expectedVersion !== undefined && Number(current[17]) !== payload.expectedVersion) {
      throw new Error('Investment version conflict. Reload the record first.');
    }

    const before = current.slice();
    const updated = current.slice();
    updated[2] = payload.name;
    updated[3] = payload.code;
    updated[4] = payload.categoryId;
    updated[5] = payload.buyPriceMinor;
    updated[6] = payload.currentPriceMinor;
    updated[7] = payload.units;
    updated[8] = payload.unitName;
    updated[9] = payload.unitMultiplier;
    updated[10] = payload.dateBought;
    updated[11] = payload.notes;
    updated[15] = new Date();
    updated[16] = auth.email;
    updated[17] = Number(current[17]) + 1;
    sheet.getRange(rowIndex + 1, 1, 1, updated.length).setValues([updated]);

    appendTransactionAudit_(spreadsheet, {
      ownerId: auth.email, actorId: auth.email, actorEmail: auth.email,
      action: 'UPDATE_INVESTMENT', entityType: 'Investment',
      entityId: payload.investmentId, beforeHash: hashRow_(before),
      afterHash: hashRow_(updated), result: 'success'
    });
    return investmentToObject_(updated);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function voidInvestment(investmentId, expectedVersion) {
  const auth = requireAuthorizedUser();
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Investments', spreadsheet);
    const values = sheet.getDataRange().getValues();
    const rowIndex = values.findIndex(row => row[0] === String(investmentId) && row[1] === auth.email);
    if (rowIndex < 1) throw new Error('Investment not found.');

    const current = values[rowIndex];
    if (current[12] === 'voided') return investmentToObject_(current);
    if (expectedVersion !== undefined && Number(current[17]) !== Number(expectedVersion)) {
      throw new Error('Investment version conflict. Reload the record first.');
    }

    const before = current.slice();
    const updated = current.slice();
    updated[12] = 'voided';
    updated[15] = new Date();
    updated[16] = auth.email;
    updated[17] = Number(current[17]) + 1;
    sheet.getRange(rowIndex + 1, 1, 1, updated.length).setValues([updated]);

    appendTransactionAudit_(spreadsheet, {
      ownerId: auth.email, actorId: auth.email, actorEmail: auth.email,
      action: 'VOID_INVESTMENT', entityType: 'Investment', entityId: String(investmentId),
      beforeHash: hashRow_(before), afterHash: hashRow_(updated), result: 'success'
    });
    return investmentToObject_(updated);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function validateInvestmentInput_(input, isUpdate) {
  const value = input || {};
  const investmentId = String(value.investmentId || '').trim();
  if (isUpdate && !investmentId) throw new Error('investmentId is required.');

  const name = String(value.name || '').trim();
  if (!name || name.length > 200) throw new Error('name must contain 1 to 200 characters.');
  const code = String(value.code || '').trim().toUpperCase();
  if (!code || code.length > 50) throw new Error('code is required and must be at most 50 characters.');
  const categoryId = String(value.categoryId || '').trim();
  if (!categoryId) throw new Error('categoryId is required.');
  const buyPriceMinor = Number(value.buyPriceMinor);
  const currentPriceMinor = Number(value.currentPriceMinor === undefined ? buyPriceMinor : value.currentPriceMinor);
  const units = Number(value.units);
  const unitMultiplier = Number(value.unitMultiplier === undefined ? 1 : value.unitMultiplier);
  if (!Number.isSafeInteger(buyPriceMinor) || buyPriceMinor <= 0) throw new Error('buyPriceMinor must be a positive integer.');
  if (!Number.isSafeInteger(currentPriceMinor) || currentPriceMinor < 0) throw new Error('currentPriceMinor must be a non-negative integer.');
  if (!Number.isFinite(units) || units <= 0) throw new Error('units must be positive.');
  if (!Number.isSafeInteger(unitMultiplier) || unitMultiplier <= 0) throw new Error('unitMultiplier must be positive.');
  const dateBought = String(value.dateBought || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateBought)) throw new Error('dateBought must use YYYY-MM-DD format.');

  return {
    investmentId, name, code, categoryId, buyPriceMinor, currentPriceMinor,
    units, unitName: String(value.unitName || 'unit').trim(), unitMultiplier,
    dateBought, notes: String(value.notes || '').trim(),
    expectedVersion: value.expectedVersion === undefined ? undefined : Number(value.expectedVersion)
  };
}

function investmentToObject_(row) {
  return {
    investmentId: row[0], ownerId: row[1], name: row[2], code: row[3],
    categoryId: row[4], buyPriceMinor: row[5], currentPriceMinor: row[6],
    units: row[7], unitName: row[8], unitMultiplier: row[9], dateBought: row[10],
    notes: row[11], status: row[12], createdAt: row[13], createdBy: row[14],
    updatedAt: row[15], updatedBy: row[16], version: row[17],
    // Dikembalikan agar klien dapat mencocokkan item antrean (idempotensi lintas perangkat).
    clientRef: row[18] || ''
  };
}
