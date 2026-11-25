/**
 * Categories CRUD foundation.
 * Categories are owner-scoped and can be deactivated without deletion.
 */
function seedDefaultCategories() {
  const auth = requireAuthorizedUser();
  return seedDefaultCategoriesFor_(auth.email);
}

/**
 * Menyiapkan kategori bawaan untuk satu pemilik. Dipanggil saat register/login
 * supaya akun baru langsung bisa menyimpan transaksi (categoryId wajib ada).
 */
function seedDefaultCategoriesFor_(ownerId) {
  const owner = String(ownerId || '').trim();
  if (!owner) throw new Error('ownerId is required.');

  const defaults = [
    ['income-salary', 'income', 'Gaji', 'Gaji', '#22c55e', 'wallet'],
    ['income-freelance', 'income', 'Freelance', 'Freelance', '#16a34a', 'briefcase'],
    ['income-other', 'income', 'Pendapatan Lainnya', 'Pendapatan lainnya', '#15803d', 'plus-circle'],
    ['expense-food', 'expense', 'Makanan & Minuman', 'Makanan & minuman', '#ef4444', 'utensils'],
    ['expense-transport', 'expense', 'Transportasi', 'Transportasi', '#f97316', 'car'],
    ['expense-needs', 'expense', 'Kebutuhan Harian', 'Kebutuhan harian', '#eab308', 'shopping-basket'],
    ['expense-bills', 'expense', 'Tagihan & Utilitas', 'Tagihan & utilitas', '#dc2626', 'receipt'],
    ['expense-entertainment', 'expense', 'Hiburan', 'Hiburan', '#a855f7', 'film'],
    ['expense-education', 'expense', 'Edukasi & Belajar', 'Edukasi & belajar', '#3b82f6', 'book-open'],
    ['expense-health', 'expense', 'Kesehatan', 'Kesehatan', '#ec4899', 'heart-pulse'],
    ['investment-general', 'investment', 'Investasi', 'Investasi', '#06b6d4', 'trending-up']
  ];

  const spreadsheet = getConfiguredSpreadsheet_();
  const sheet = getRequiredSheet_('Categories', spreadsheet);
  const values = sheet.getDataRange().getValues();
  const existing = new Set(values.slice(1)
    .filter(row => row[1] === owner)
    .map(row => row[0]));
  const now = new Date();
  const rows = defaults
    .filter(item => !existing.has(item[0]))
    .map((item, index) => [
      item[0], owner, item[1], item[2], item[3], item[4], item[5],
      index, true, now, now
    ]);

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
      .setValues(rows);
  }

  return { createdCount: rows.length, totalDefaults: defaults.length };
}

function createCategory(input) {
  const auth = requireAuthorizedUser();
  const payload = validateCategoryInput_(input);
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Categories', spreadsheet);
    const values = sheet.getDataRange().getValues();
    const duplicate = values.slice(1).some(row =>
      row[1] === auth.email &&
      row[2] === payload.categoryType &&
      String(row[4]).toLowerCase() === payload.displayName.toLowerCase() &&
      row[8] === true
    );
    if (duplicate) {
      throw new Error('An active category with the same name already exists.');
    }

    const categoryId = Utilities.getUuid();
    const now = new Date();
    const row = [
      categoryId, auth.email, payload.categoryType, payload.name,
      payload.displayName, payload.color, payload.icon, payload.sortOrder,
      true, now, now
    ];
    sheet.appendRow(row);
    return categoryToObject_(row);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function listCategories(categoryType) {
  const auth = requireAuthorizedUser();
  const spreadsheet = getConfiguredSpreadsheet_();
  const sheet = getRequiredSheet_('Categories', spreadsheet);
  const values = sheet.getDataRange().getValues();
  const type = categoryType ? String(categoryType) : '';
  const items = values.slice(1)
    .filter(row => row[1] === auth.email && row[8] === true)
    .filter(row => !type || row[2] === type)
    .map(categoryToObject_);
  return { items: items, count: items.length };
}

function updateCategory(input) {
  const auth = requireAuthorizedUser();
  const payload = validateCategoryInput_(input);
  const categoryId = String(input && input.categoryId || '').trim();
  if (!categoryId) {
    throw new Error('categoryId is required.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);
  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Categories', spreadsheet);
    const values = sheet.getDataRange().getValues();
    const rowIndex = values.findIndex(row => row[0] === categoryId && row[1] === auth.email);
    if (rowIndex < 1) {
      throw new Error('Category not found.');
    }

    const current = values[rowIndex];
    const updated = current.slice();
    updated[2] = payload.categoryType;
    updated[3] = payload.name;
    updated[4] = payload.displayName;
    updated[5] = payload.color;
    updated[6] = payload.icon;
    updated[7] = payload.sortOrder;
    updated[9] = current[9];
    updated[10] = new Date();
    sheet.getRange(rowIndex + 1, 1, 1, updated.length).setValues([updated]);
    return categoryToObject_(updated);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function deactivateCategory(categoryId) {
  const auth = requireAuthorizedUser();
  const lock = LockService.getScriptLock();
  lock.waitLock(getCashflowConfig_().setupLockTimeoutMs);
  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getRequiredSheet_('Categories', spreadsheet);
    const values = sheet.getDataRange().getValues();
    const rowIndex = values.findIndex(row =>
      row[0] === String(categoryId) && row[1] === auth.email
    );
    if (rowIndex < 1) {
      throw new Error('Category not found.');
    }
    const updated = values[rowIndex].slice();
    updated[8] = false;
    updated[10] = new Date();
    sheet.getRange(rowIndex + 1, 1, 1, updated.length).setValues([updated]);
    return categoryToObject_(updated);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function validateCategoryInput_(input) {
  const value = input || {};
  const categoryType = String(value.categoryType || '').trim();
  if (!['income', 'expense', 'investment'].includes(categoryType)) {
    throw new Error('categoryType must be income, expense, or investment.');
  }

  const name = String(value.name || '').trim();
  const displayName = String(value.displayName || name).trim();
  if (!name || name.length > 100 || !displayName || displayName.length > 100) {
    throw new Error('Category name must contain 1 to 100 characters.');
  }

  const sortOrder = value.sortOrder === undefined ? 0 : Number(value.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new Error('sortOrder must be a non-negative integer.');
  }

  return {
    categoryType: categoryType,
    name: name,
    displayName: displayName,
    color: String(value.color || '').trim(),
    icon: String(value.icon || '').trim(),
    sortOrder: sortOrder
  };
}

function categoryToObject_(row) {
  return {
    categoryId: row[0],
    ownerId: row[1],
    categoryType: row[2],
    name: row[3],
    displayName: row[4],
    color: row[5],
    icon: row[6],
    sortOrder: row[7],
    isActive: row[8],
    createdAt: row[9],
    updatedAt: row[10]
  };
}
