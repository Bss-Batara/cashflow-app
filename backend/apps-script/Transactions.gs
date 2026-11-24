/**
 * Transactions CRUD foundation.
 *
 * These functions are callable manually from Apps Script for verification.
 * They do not expose a web endpoint. Every operation is scoped to the
 * authenticated allowlisted user and writes an audit record.
 */
function createTransaction(input) {
  const auth = requireAuthorizedUser();
  const payload = validateTransactionInput_(input, false);
  assertActiveCategory_(payload.categoryId, auth.email, payload.type);
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Transactions', spreadsheet);
    const now = new Date();
    const transactionId = Utilities.getUuid();
    const row = [
      transactionId,
      auth.email,
      payload.type,
      payload.title,
      payload.amountMinor,
      payload.currency,
      payload.categoryId,
      payload.transactionDate,
      payload.wallet,
      payload.note,
      'active',
      now,
      auth.email,
      now,
      auth.email,
      1
    ];

    sheet.appendRow(row);
    appendTransactionAudit_(spreadsheet, {
      ownerId: auth.email,
      actorId: auth.email,
      actorEmail: auth.email,
      action: 'CREATE_TRANSACTION',
      entityType: 'Transaction',
      entityId: transactionId,
      result: 'success'
    });

    return transactionToObject_(row);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function listTransactions(options) {
  const auth = requireAuthorizedUser();
  const spreadsheet = getConfiguredSpreadsheet_();
  const sheet = getRequiredSheet_('Transactions', spreadsheet);
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1)
    .filter(row => row[1] === auth.email)
    .filter(row => !options || options.includeVoided || row[10] === 'active')
    .map(transactionToObject_);

  return { items: rows, count: rows.length };
}

function updateTransaction(input) {
  const auth = requireAuthorizedUser();
  const payload = validateTransactionInput_(input, true);
  assertActiveCategory_(payload.categoryId, auth.email, payload.type);
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Transactions', spreadsheet);
    const values = sheet.getDataRange().getValues();
    const rowIndex = values.findIndex(row =>
      row[0] === payload.transactionId && row[1] === auth.email
    );

    if (rowIndex < 1) {
      throw new Error('Transaction not found.');
    }

    const current = values[rowIndex];
    if (current[10] === 'voided') {
      throw new Error('Voided transactions cannot be updated.');
    }
    if (payload.expectedVersion !== undefined &&
        Number(current[15]) !== payload.expectedVersion) {
      throw new Error('Transaction version conflict. Reload the record first.');
    }

    const before = current.slice();
    const now = new Date();
    const updated = current.slice();
    updated[2] = payload.type;
    updated[3] = payload.title;
    updated[4] = payload.amountMinor;
    updated[5] = payload.currency;
    updated[6] = payload.categoryId;
    updated[7] = payload.transactionDate;
    updated[8] = payload.wallet;
    updated[9] = payload.note;
    updated[13] = now;
    updated[14] = auth.email;
    updated[15] = Number(current[15]) + 1;
    sheet.getRange(rowIndex + 1, 1, 1, updated.length).setValues([updated]);

    appendTransactionAudit_(spreadsheet, {
      ownerId: auth.email,
      actorId: auth.email,
      actorEmail: auth.email,
      action: 'UPDATE_TRANSACTION',
      entityType: 'Transaction',
      entityId: payload.transactionId,
      beforeHash: hashRow_(before),
      afterHash: hashRow_(updated),
      result: 'success'
    });

    return transactionToObject_(updated);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function voidTransaction(transactionId, expectedVersion) {
  const auth = requireAuthorizedUser();
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Transactions', spreadsheet);
    const values = sheet.getDataRange().getValues();
    const rowIndex = values.findIndex(row =>
      row[0] === String(transactionId) && row[1] === auth.email
    );

    if (rowIndex < 1) {
      throw new Error('Transaction not found.');
    }

    const current = values[rowIndex];
    if (current[10] === 'voided') {
      return transactionToObject_(current);
    }
    if (expectedVersion !== undefined &&
        Number(current[15]) !== Number(expectedVersion)) {
      throw new Error('Transaction version conflict. Reload the record first.');
    }

    const before = current.slice();
    const updated = current.slice();
    updated[10] = 'voided';
    updated[13] = new Date();
    updated[14] = auth.email;
    updated[15] = Number(current[15]) + 1;
    sheet.getRange(rowIndex + 1, 1, 1, updated.length).setValues([updated]);

    appendTransactionAudit_(spreadsheet, {
      ownerId: auth.email,
      actorId: auth.email,
      actorEmail: auth.email,
      action: 'VOID_TRANSACTION',
      entityType: 'Transaction',
      entityId: String(transactionId),
      beforeHash: hashRow_(before),
      afterHash: hashRow_(updated),
      result: 'success'
    });

    return transactionToObject_(updated);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function validateTransactionInput_(input, isUpdate) {
  const value = input || {};
  if (isUpdate && !String(value.transactionId || '').trim()) {
    throw new Error('transactionId is required.');
  }

  const amountMinor = Number(value.amountMinor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('amountMinor must be a positive integer.');
  }
  if (!['income', 'expense'].includes(String(value.type || ''))) {
    throw new Error('type must be income or expense.');
  }

  const title = String(value.title || '').trim();
  if (!title || title.length > 200) {
    throw new Error('title must contain 1 to 200 characters.');
  }

  const transactionDate = String(value.transactionDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    throw new Error('transactionDate must use YYYY-MM-DD format.');
  }

  const categoryId = String(value.categoryId || '').trim();
  if (!categoryId) {
    throw new Error('categoryId is required.');
  }

  return {
    transactionId: String(value.transactionId || '').trim(),
    type: String(value.type),
    title: title,
    amountMinor: amountMinor,
    currency: String(value.currency || 'IDR').trim().toUpperCase(),
    categoryId: categoryId,
    transactionDate: transactionDate,
    wallet: String(value.wallet || '').trim(),
    note: String(value.note || '').trim(),
    expectedVersion: value.expectedVersion === undefined
      ? undefined
      : Number(value.expectedVersion)
  };
}

function getRequiredSheet_(sheetName, spreadsheet) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`${sheetName} sheet is missing. Run setupCashflowDatabase first.`);
  }
  return sheet;
}

function assertActiveCategory_(categoryId, ownerId, transactionType) {
  const spreadsheet = getConfiguredSpreadsheet_();
  const sheet = getRequiredSheet_('Categories', spreadsheet);
  const values = sheet.getDataRange().getValues();
  const category = values.slice(1).find(row =>
    row[0] === categoryId && row[1] === ownerId && row[8] === true
  );

  if (!category) {
    throw new Error('categoryId does not refer to an active category owned by the user.');
  }
  if (category[2] !== transactionType) {
    throw new Error(`Category type must match transaction type: ${transactionType}.`);
  }
}

function transactionToObject_(row) {
  return {
    transactionId: row[0],
    ownerId: row[1],
    type: row[2],
    title: row[3],
    amountMinor: row[4],
    currency: row[5],
    categoryId: row[6],
    transactionDate: row[7],
    wallet: row[8],
    note: row[9],
    status: row[10],
    createdAt: row[11],
    createdBy: row[12],
    updatedAt: row[13],
    updatedBy: row[14],
    version: row[15]
  };
}

function appendTransactionAudit_(spreadsheet, data) {
  const sheet = getRequiredSheet_('AuditLog', spreadsheet);
  sheet.appendRow([
    Utilities.getUuid(),
    data.ownerId,
    data.actorId,
    data.actorEmail,
    data.action,
    data.entityType,
    data.entityId,
    Utilities.getUuid(),
    data.beforeHash || '',
    data.afterHash || '',
    '',
    new Date(),
    data.result,
    data.errorCode || ''
  ]);
}

function hashRow_(row) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(row)
  );
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return (`0${value.toString(16)}`).slice(-2);
  }).join('');
}

/** Manual smoke test for the transaction CRUD flow. */
function verifyTransactionsCrud() {
  const created = createTransaction({
    type: 'expense',
    title: '[TEST] Transaction CRUD',
    amountMinor: 1000,
    currency: 'IDR',
    categoryId: 'expense-food',
    transactionDate: '2026-11-24',
    wallet: 'Test Wallet',
    note: 'Temporary CRUD test'
  });

  const listed = listTransactions();
  const updated = updateTransaction({
    transactionId: created.transactionId,
    type: 'expense',
    title: '[TEST] Transaction CRUD Updated',
    amountMinor: 2000,
    currency: 'IDR',
    categoryId: 'expense-food',
    transactionDate: '2026-11-24',
    wallet: 'Test Wallet',
    note: 'Updated CRUD test',
    expectedVersion: created.version
  });

  const voided = voidTransaction(updated.transactionId, updated.version);
  const result = {
    created: created,
    listedCount: listed.count,
    updated: updated,
    voided: voided,
    success: voided.status === 'voided'
  };

  Logger.log(JSON.stringify(result));
  return result;
}
