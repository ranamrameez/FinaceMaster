# FinanceRecorder

A personal finance tracker: stock trading (QSE + PSX exchanges), mutual funds, bank
accounts, cash, personal loans, EMI/loans, rental income, subscriptions, cross-entity
transfers, budgeting, and a net-worth dashboard — all in one place.

This file is a short, general pointer. Each component below keeps its own detailed
docs inside its own directory — see the linked README for anything specific to it.

## Components in this repo

| Component | What it is | Status |
| --- | --- | --- |
| [`webapp/`](webapp/README.md) | The main product — a React + TypeScript web app | Live, actively developed |
| [`chrome-extension/`](chrome-extension/README.md) | Browser extension that feeds live QSE prices into the web app's shared Firebase data | Working, optional |
| [`sample/`](sample/) | Real QSE/PSX data snapshots and a crystallized PSX broker statement, used as test fixtures and reference data | Reference data, not a running component |
| `functions/` | A Firebase Cloud Function scaffold (scheduled FX-rate fetch) shared by the project's Firebase backend | Scaffolded, not currently deployed |

There is no Android or iOS app in this repo today.

## Live app

<https://ranamrameez.github.io/FinaceMaster/>

## For AI coding sessions

Read `CLAUDE.md` (at this repo root) first — it has full project continuity notes and
is kept up to date every session. It stays at the root deliberately so it keeps
auto-loading for future sessions, even though its content is almost entirely about
`webapp/`.

## Project status

The web app (`webapp/`) is the only platform under active development. Its own
`webapp/README.md` is the real, continuously-updated Done/Pending backlog — this file
does not duplicate it.
