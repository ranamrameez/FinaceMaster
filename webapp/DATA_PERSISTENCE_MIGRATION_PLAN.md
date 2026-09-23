# Data Persistence Migration Plan

## Decision

`localStorage` remains appropriate for small UI preferences only. It is no longer the correct primary datastore for growing financial workbooks.

The current React application rewrites entire workbook JSON blobs on mutations, while Firebase also synchronizes whole module documents. That design originated in the single-HTML prototype and now creates avoidable main-thread work, storage-size pressure, weak queryability and coarse cloud updates.

## Target architecture

```
React UI
  ↓
Zustand/application state
  ↓
shared repository interface
  ↓
IndexedDB (local durable store/cache)
  ↕
Firebase (cloud sync)
```

### localStorage after migration

Keep only lightweight preferences such as appearance/theme/density, sidebar/UI preferences and harmless dismissal flags. Do not keep growing transaction/trade/history datasets there.

### IndexedDB responsibilities

Use IndexedDB behind a shared repository abstraction. Dexie is the preferred candidate unless implementation testing reveals a reason not to use it.

Store major records individually and index fields used by filters/queries, including accounts, banks, credit cards, transactions, QSE/PSX trades, plans, categories, loans/repayments, rentals, funds, subscriptions and appropriate market/dividend history.

Representative indexes:
- entity/account/ticker id
- date/timestamp
- category id
- direction/type
- source
- currency

The UI should request the records it needs instead of loading lifetime workbooks and repeatedly filtering giant arrays.

## Repository contract

Introduce a module-neutral persistence boundary first:

```ts
repository.get(...)
repository.query(...)
repository.add(...)
repository.update(...)
repository.delete(...)
repository.bulkPut(...)
repository.transaction(...)
```

React pages and calculation layers must not depend directly on IndexedDB APIs.

## Safe migration phases

### Phase 0 — inventory and invariants
- enumerate every localStorage key and Firebase path
- record workbook schemas and normalization/backfill behavior
- define record-count/checksum validation
- add backup/export recovery tests

### Phase 1 — shared IndexedDB/repository layer
- add database schema/versioning
- implement repository primitives
- add migration journal/version marker
- test upgrades, rollback-safe failures and duplicate prevention

### Phase 2 — Banking reference migration
- accounts/banks become individual records
- transactions become individually queryable rows
- page filters query by account/date/category/source/direction
- pagination reads only requested rows
- summaries/charts consume the same query/filter contract
- imports use bulk transactions
- verify exact totals against the user's real backup before removing the old local path

### Phase 3 — localStorage one-time migration
On first run of a migrated module:
1. detect the legacy workbook key
2. parse and normalize it with existing normalization logic
3. write records into IndexedDB in one transaction
4. verify counts/checksum/invariants
5. mark migration complete
6. retain the legacy blob temporarily as recovery data
7. only remove/archive that recovery blob after a later verified release

A failed migration must leave original localStorage data untouched.

### Phase 4 — migrate all existing modules
Move Cash, Personal Loans, EMI/Loans, Funds, Rentals, Subscriptions, QSE, PSX, Credit Cards, plans and shared datasets incrementally. Do not run a big-bang migration.

### Phase 5 — cloud schema migration
Only after local IndexedDB persistence is stable, migrate Firebase from whole-workbook writes toward record-oriented paths such as:

```
users/{uid}/bank/accounts/{accountId}
users/{uid}/bank/transactions/{transactionId}
users/{uid}/bank/banks/{bankId}
```

Use explicit schema versions and compatibility reads during transition.

### Phase 6 — remove legacy persistence
Remove workbook writes to localStorage only after migration verification, recovery testing, backup compatibility checks and at least one release retaining recovery blobs.

## Safety rules

- Never silently overwrite cloud data because a local store appears empty.
- Never delete legacy financial data before verification succeeds.
- Migration must be idempotent.
- Bulk imports/migrations use database transactions.
- Preserve IDs, sequence/serial fields and timestamps.
- Existing JSON backup/import remains a recovery path throughout migration.
- Validate real user backups before declaring a module migrated.

## Performance goals

Adding/editing one transaction should not require serializing an entire module workbook. Pagination/filtering should be query-driven, and large historical datasets should not be loaded/rendered solely to show the current page.
