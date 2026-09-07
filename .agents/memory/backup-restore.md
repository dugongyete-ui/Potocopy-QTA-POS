---
name: PostgreSQL backup and restore
description: Portable JSON backup behavior for the Potocopy QTA shop data.
---

PostgreSQL remains the active source of truth; JSON backups are portable snapshots for download and full replacement restore.

**Why:** The shop needs a file that can be saved on a phone after a reset, while PostgreSQL preserves relational integrity, transaction history, and multi-user consistency during normal operation.

**How to apply:** Treat restore as destructive, keep an explicit confirmation in the UI, validate the snapshot before changing data, restore related tables in foreign-key order, and reset serial sequences afterward.