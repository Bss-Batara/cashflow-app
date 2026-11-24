# Cashflow Apps Script database foundation

This folder contains the database foundation only. It does not contain CRUD,
localStorage migration, frontend integration, or `doGet`/`doPost` handlers.

## Deployment and authentication

The intended Apps Script deployment is:

- Execute as: **user accessing the web app**
- Access: **logged-in Google users only**
- Anonymous access: disabled
- Application access: explicit email allowlist in Script Properties

`Auth.gs` rejects blank active-user identity values and rejects accounts not in
the allowlist. This is fail-closed because Apps Script can return a blank active
user email in deployment contexts where the identity cannot be disclosed.

The `webapp` section in `appsscript.json` documents the intended deployment
configuration. In Apps Script, `access: "ANYONE"` means any signed-in Google
user can reach a deployed web app; it does not mean anonymous access. The
application allowlist remains a separate backend authorization check. No web
handler is included, so this foundation does not expose a production endpoint.

## Global-scope design

Configuration and schema are exposed through function accessors:

- `getCashflowConfig_()` in `Config.gs`
- `getCashflowSchema_()` in `Schema.gs`
- `getCashflowAuthConfig_()` in `Auth.gs`

There are no global `CASHFLOW_CONFIG`, `CASHFLOW_SCHEMA`, or `CASHFLOW_AUTH`
constants. This avoids duplicate declarations and cross-file top-level
initialization failures when files are copied into Apps Script.

## Administrator setup order

1. Create or open the private Google Spreadsheet.
2. Add this Apps Script project as a bound or standalone script.
3. If this is a bound script, run `configureCurrentSpreadsheet()` manually.
   For a standalone script, call `configureSpreadsheetId('YOUR_SPREADSHEET_ID')`
   from a temporary admin wrapper or another authorized execution context.
4. Run `setupCashflowTestAllowlist()` manually to allowlist `bssbatara@gmail.com`.
5. Run `setupCashflowDatabase()`.
6. Run `verifyCashflowSchema()` and review the report.

Before any future web handler is introduced, run
`verifyAuthenticationConfiguration()` from the deployed Apps Script context.
The approved account must report `activeIdentityPresent: true`,
`activeIdentityAllowlisted: true`, and `accessWouldBeGranted: true`. A blank
active identity must be treated as a failed deployment test.

To inspect allowlist configuration without exposing the stored email list, run
`diagnoseCashflowAllowlist()`. It reports the property key, property existence,
parse status, entry count, active identity, and active-user membership.

The setup function creates only missing sheets. It never deletes sheets, clears
rows, replaces headers, or overwrites existing records. Existing sheets with
unexpected headers are reported as `HEADER_MISMATCH` for manual review.

## Verification tests

## Manual Google Apps Script tests still required

### Deployment identity test

1. Deploy a test web app with `executeAs: USER_ACCESSING` and `access: ANYONE`.
2. Sign in as `bssbatara@gmail.com`.
3. Run `verifyAuthenticationConfiguration()` from that deployed Apps Script context.
4. Confirm `activeIdentityPresent: true`, `activeIdentityAllowlisted: true`, and `accessWouldBeGranted: true`.
5. Repeat with a non-allowlisted signed-in account and confirm `accessWouldBeGranted: false`.
6. Test a context where the active email is blank and confirm `requireAuthorizedUser()` throws.

This identity test has not been run in Google Apps Script from this repository.

### Spreadsheet initialization test

1. Use a disposable test spreadsheet, never the production spreadsheet.
2. Configure its ID and the approved test account with `configureSpreadsheetId()` and `configureAllowedUsers()`.
3. Leave at least one required sheet absent and place a unique marker row in an existing sheet.
4. Run `setupCashflowDatabase()` and confirm only absent sheets are created.
5. Confirm the marker row and all existing values remain unchanged.
6. Run `verifyCashflowSchema()` and review exact header comparisons.
7. Run `verifyCashflowInitializationSafety()` and confirm the second run creates zero sheets.

This initialization test has not been run against a real Google Spreadsheet.

## Important protection limitation

The setup attempts to protect header rows on newly created sheets. It does not
remove existing editors or alter spreadsheet sharing. An administrator must
review the resulting Google Sheets protection rules and sharing configuration.
