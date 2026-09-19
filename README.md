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
| [`android/`](android/README.md) | Native Android app — a WebView shell around the live web app, plus bank-SMS auto-logging via Android's Notification Listener | Built, CI-published (see below) |
| [`chrome-extension/`](chrome-extension/README.md) | Browser extension that feeds live QSE prices into the web app's shared Firebase data | Working, optional |
| [`sample/`](sample/) | Real QSE/PSX data snapshots and a crystallized PSX broker statement, used as test fixtures and reference data | Reference data, not a running component |
| `functions/` | A Firebase Cloud Function scaffold (scheduled FX-rate fetch) shared by the project's Firebase backend | Scaffolded, not currently deployed |

There is no iOS app in this repo today.

## Live app

<https://ranamrameez.github.io/FinaceMaster/>

Scan the QR code below to open the live web app:

![Live FinanceMaster](adobe-express-qr-code.png)

## Android app

Native Kotlin + Jetpack Compose — see [`android/README.md`](android/README.md) for the full
architecture. Built and published automatically by GitHub Actions (see below); no manual
release step is needed for a debug build.

### GitHub Actions build and published APK

The workflow is located at:

```
.github/workflows/android-build.yml
```

It builds the Android project from `/android` and runs only on a push to `master` or `main`
when the pushed changes include `android/**`. A merged pull request produces such a push, so a
merge containing Android changes triggers the build; opening or updating a PR does not.

After a successful build, CI does two things with the APK:

1. Uploads `financerecorder-debug-apk` as the normal GitHub Actions artifact.
2. Copies/replaces the latest APK in the repository at:

```
builds/android/financerecorder-debug.apk
```

It also writes:

```
builds/android/build-info.txt
```

with the CI run number, source commit, and branch.

### Download on your phone

The repository also contains a QR code that points to the latest Android APK download:

![Download the FinanceRecorder Android APK](builds/android/download-qr.png)

Scan it with your phone to open and download the current APK without navigating through
GitHub Actions. Or download it directly:
[`builds/android/financerecorder-debug.apk`](builds/android/financerecorder-debug.apk)

*(Both links populate the first time `android-build.yml` runs — i.e. the first merge to
`main`/`master` that touches `android/**` after this workflow was added. Until then they point
at a file that doesn't exist yet.)*

The repository copy under `/builds/android` is the canonical latest-build download. This
README links directly to that APK rather than to the list of GitHub Actions runs.

The generated `/builds/android` commit does not start another Android build because the
workflow path filter only watches `android/**`.

## For AI coding sessions

Read `CLAUDE.md` (at this repo root) first — it has full project continuity notes and
is kept up to date every session. It stays at the root deliberately so it keeps
auto-loading for future sessions, even though its content is almost entirely about
`webapp/`.

## Project status

The web app (`webapp/`) is the primary platform under active development. Its own
`webapp/README.md` is the real, continuously-updated Done/Pending backlog — this file
does not duplicate it. The Android app (`android/`) is a thin WebView shell around that same
web app plus one native-only feature (bank-SMS auto-logging), so it tracks the web app's
functionality automatically rather than needing its own parallel backlog.
