/**
 * Authoritative Cashflow sheet definitions.
 * Header text is part of the database contract and must not be changed by
 * initialization when a sheet already exists.
 */
/**
 * Returns the canonical Cashflow sheet schema.
 *
 * This is intentionally a function rather than a global const so transferred
 * Apps Script files cannot redeclare a schema global or depend on file order.
 */
function getCashflowSchema_() {
  return Object.freeze({
    Transactions: [
      'transactionId', 'ownerId', 'type', 'title', 'amountMinor', 'currency',
      'categoryId', 'transactionDate', 'wallet', 'note', 'status', 'createdAt',
      'createdBy', 'updatedAt', 'updatedBy', 'version'
    ],
    Investments: [
      'investmentId', 'ownerId', 'name', 'code', 'categoryId', 'buyPriceMinor',
      'currentPriceMinor', 'units', 'unitName', 'unitMultiplier', 'dateBought',
      'notes', 'status', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
      'version'
    ],
    Categories: [
      'categoryId', 'ownerId', 'categoryType', 'name', 'displayName', 'color',
      'icon', 'sortOrder', 'isActive', 'createdAt', 'updatedAt'
    ],
    Budgets: [
      'budgetId', 'ownerId', 'categoryId', 'periodType', 'periodStart',
      'periodEnd', 'limitMinor', 'currency', 'status', 'createdAt', 'updatedAt',
      'version'
    ],
    Settings: [
      'settingId', 'ownerId', 'settingKey', 'settingValue', 'valueType',
      'updatedAt', 'updatedBy', 'version'
    ],
    AuditLog: [
      'auditId', 'ownerId', 'actorId', 'actorEmail', 'action', 'entityType',
      'entityId', 'requestId', 'beforeHash', 'afterHash', 'metadataJson',
      'createdAt', 'result', 'errorCode'
    ],
    Schema: [
      'schemaVersion', 'sheetName', 'fieldName', 'fieldType', 'isRequired',
      'validationRule', 'defaultValue', 'description', 'updatedAt'
    ]
  });
}

function getExpectedHeaders_(sheetName) {
  const headers = getCashflowSchema_()[sheetName];
  if (!headers) {
    throw new Error(`Unknown Cashflow sheet: ${sheetName}`);
  }
  return headers.slice();
}

function getSchemaRows_() {
  const schema = getCashflowSchema_();
  const config = getCashflowConfig_();
  const descriptions = {
    transactionId: ['string', true, 'immutable unique identifier', 'Transaction identifier'],
    ownerId: ['string', true, 'backend authenticated owner', 'Record owner'],
    type: ['enum', true, 'income|expense', 'Transaction type'],
    title: ['string', true, '1-200 characters', 'Transaction title'],
    amountMinor: ['integer', true, 'positive IDR minor units', 'Transaction amount'],
    currency: ['enum', true, 'IDR initially', 'Currency code'],
    categoryId: ['string', true, 'existing category for record type', 'Category identifier'],
    transactionDate: ['date', true, 'YYYY-MM-DD', 'Transaction date'],
    wallet: ['string', false, 'bounded text', 'Wallet or account'],
    note: ['string', false, 'bounded text', 'Optional note'],
    status: ['enum', true, 'active|voided', 'Record status'],
    createdAt: ['datetime', true, 'ISO-8601 timestamp', 'Creation timestamp'],
    createdBy: ['string', true, 'backend authenticated identity', 'Creator identity'],
    updatedAt: ['datetime', true, 'ISO-8601 timestamp', 'Last update timestamp'],
    updatedBy: ['string', true, 'backend authenticated identity', 'Last updater identity'],
    version: ['integer', true, 'positive optimistic-lock version', 'Record version'],
    investmentId: ['string', true, 'immutable unique identifier', 'Investment identifier'],
    name: ['string', true, '1-200 characters', 'Investment name'],
    code: ['string', true, 'uppercase normalized identifier', 'Investment code'],
    buyPriceMinor: ['integer', true, 'non-negative IDR minor units', 'Purchase price'],
    currentPriceMinor: ['integer', false, 'non-negative IDR minor units', 'Current price'],
    units: ['number', true, 'positive quantity', 'Investment units'],
    unitName: ['string', true, 'bounded text', 'Unit name'],
    unitMultiplier: ['number', true, 'positive multiplier', 'Unit multiplier'],
    dateBought: ['date', true, 'YYYY-MM-DD', 'Purchase date'],
    notes: ['string', false, 'bounded text', 'Investment notes'],
    categoryType: ['enum', true, 'income|expense|investment', 'Category type'],
    color: ['string', false, 'valid color token', 'Category color'],
    icon: ['string', false, 'bounded icon identifier', 'Category icon'],
    sortOrder: ['integer', true, 'zero or positive ordering value', 'Display order'],
    displayName: ['string', true, 'bounded text', 'Display label'],
    isActive: ['boolean', true, 'true|false', 'Active flag'],
    budgetId: ['string', true, 'immutable unique identifier', 'Budget identifier'],
    periodType: ['enum', true, 'daily|monthly', 'Budget period type'],
    periodStart: ['date', true, 'YYYY-MM-DD', 'Budget start'],
    periodEnd: ['date', true, 'YYYY-MM-DD', 'Budget end'],
    limitMinor: ['integer', true, 'zero or positive IDR minor units', 'Budget limit'],
    actorEmail: ['string', true, 'validated Google account email', 'Actor email'],
    settingId: ['string', true, 'immutable unique identifier', 'Setting identifier'],
    settingKey: ['string', true, 'approved key allowlist', 'Setting key'],
    settingValue: ['string|json', true, 'validated by setting key', 'Setting value'],
    valueType: ['enum', true, 'number|string|boolean|json', 'Setting value type'],
    auditId: ['string', true, 'immutable unique identifier', 'Audit identifier'],
    actorId: ['string', true, 'backend authenticated identity', 'Actor identifier'],
    action: ['enum', true, 'approved action name', 'Audit action'],
    entityType: ['enum', true, 'approved entity type', 'Audit entity type'],
    entityId: ['string', false, 'related record identifier', 'Related entity identifier'],
    requestId: ['string', true, 'unique request identifier', 'Request identifier'],
    beforeHash: ['string', false, 'content hash', 'Previous record hash'],
    afterHash: ['string', false, 'content hash', 'Resulting record hash'],
    metadataJson: ['json', false, 'valid JSON object', 'Additional metadata'],
    result: ['enum', true, 'success|failure', 'Operation result'],
    errorCode: ['string', false, 'bounded error code', 'Failure error code'],
    schemaVersion: ['string', true, 'semantic version', 'Schema version'],
    sheetName: ['string', true, 'approved sheet name', 'Sheet name'],
    fieldName: ['string', true, 'field in approved sheet', 'Field name'],
    fieldType: ['string', true, 'approved type', 'Field type'],
    isRequired: ['boolean', true, 'true|false', 'Required flag'],
    validationRule: ['string', true, 'named validation rule', 'Validation rule'],
    description: ['string', true, 'bounded text', 'Field description']
  };

  const rows = [];
  Object.keys(schema).forEach(sheetName => {
    schema[sheetName].forEach(fieldName => {
      const descriptor = descriptions[fieldName] || ['string', false, 'bounded text', 'Schema field'];
      rows.push([
        config.schemaVersion,
        sheetName,
        fieldName,
        descriptor[0],
        descriptor[1],
        descriptor[2],
        '',
        descriptor[3],
        new Date()
      ]);
    });
  });
  return rows;
}

/**
 * Refreshes generated Schema documentation while preserving its header.
 * This intentionally changes only the Schema documentation rows; it does not
 * modify application data in the other database sheets.
 */
function refreshCashflowSchemaDocumentation() {
  const auth = requireAuthorizedUser();
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = spreadsheet.getSheetByName('Schema');
    if (!sheet) {
      throw new Error('Schema sheet is missing. Run setupCashflowDatabase first.');
    }

    const expectedHeaders = getExpectedHeaders_('Schema');
    const actualHeaders = sheet.getRange(1, 1, 1, expectedHeaders.length)
      .getDisplayValues()[0];
    const headersMatch = expectedHeaders.every((header, index) =>
      actualHeaders[index] === header
    );
    if (!headersMatch) {
      throw new Error('Schema sheet header mismatch. Refresh was aborted.');
    }

    const rows = getSchemaRows_();
    const existingDataRows = Math.max(sheet.getLastRow() - 1, 0);
    if (existingDataRows > 0) {
      sheet.getRange(2, 1, existingDataRows, expectedHeaders.length).clearContent();
    }
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);

    return {
      refreshed: true,
      rowCount: rows.length,
      spreadsheetName: spreadsheet.getName(),
      authorization: { email: auth.email, verified: true }
    };
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}
