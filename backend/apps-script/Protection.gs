/**
 * Non-destructive header protection helpers.
 * Existing protections and sharing are never removed or rewritten.
 */
function protectHeaderIfPossible_(sheet, headers, createdBySetup) {
  if (!createdBySetup || !headers.length) {
    return { attempted: false, protected: false, reason: 'Existing sheet was not changed.' };
  }

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  const alreadyProtected = protections.some(protection => {
    try {
      return protection.getRange().getA1Notation() === headerRange.getA1Notation();
    } catch (error) {
      return false;
    }
  });

  if (alreadyProtected) {
    return { attempted: true, protected: true, reason: 'Header protection already exists.' };
  }

  try {
    const protection = headerRange.protect()
      .setDescription(`Cashflow protected header: ${sheet.getName()}`)
      .setWarningOnly(false);

    // Keep existing spreadsheet sharing untouched. The effective user is added
    // explicitly so the setup administrator is not locked out of the range.
    const effectiveEmail = Session.getEffectiveUser().getEmail();
    if (effectiveEmail) {
      protection.addEditor(effectiveEmail);
    }

    return { attempted: true, protected: true, reason: 'Header row protected.' };
  } catch (error) {
    return { attempted: true, protected: false, reason: error.message };
  }
}
