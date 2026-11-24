# Cashflow backup foundation

Automated backups are intentionally not implemented in this foundation phase.

## Required backup architecture

- Keep the production spreadsheet private in Google Drive.
- Store future timestamped copies in a separate restricted Drive folder.
- Create a pre-change backup before migration, schema changes, restore, or bulk import.
- Restore into a staging spreadsheet first.
- Compare sheet names, headers, row counts, IDs, and financial totals before promotion.
- Record backup and restore actions in `AuditLog` when write operations are introduced.

The setup code does not copy, clear, export, or restore spreadsheet data.
