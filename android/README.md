# FinanceRecorder — Android app

A native Kotlin + Jetpack Compose Android app that wraps the real deployed webapp
(`webapp/`, live at https://ranamrameez.github.io/FinaceMaster/) in a WebView, and adds one
native-only capability on top: detecting a bank SMS and turning it into a draft Bank
transaction the user reviews and approves before it's saved.

## Why this architecture

**WebView shell, not a native re-port.** The webapp already has 20+ modules and a
thoroughly-tested calc engine (see repo root `CLAUDE.md`). Re-implementing all of that
natively would fork the data model and the money math into two codebases that could drift —
exactly the failure mode this whole project has spent a long history avoiding (see
`CLAUDE.md`'s repeated "fix once at the shared layer" lesson). Instead, the Android app loads
the real site and adds native code only where a webpage genuinely can't do something:
reading Android notifications.

**Notification access, not `READ_SMS`/`RECEIVE_SMS`.** Google Play restricts those two
permissions to an app that is the user's default SMS/Assistant handler — a finance app can't
qualify, and Google has a documented history of removing exactly this kind of "read SMS for
expense tracking" feature from apps that tried it. `SmsListenerService`
(`app/src/main/kotlin/.../sms/SmsListenerService.kt`) instead reads the notification the
phone's own default messaging app already posts for an incoming SMS, via
`NotificationListenerService` — a completely separate, much less restricted permission the
user grants explicitly in system Settings (`Settings > Notification access`), not something
declared as a "dangerous permission" in the manifest. This is the same mechanism real
production expense-tracker apps on Play Store use for this exact feature.

Not scoped to one messaging-app package name — which app is "the" default SMS app varies a
lot by OEM (Google Messages, Samsung Messages, others). Every notification is inspected;
`SmsListenerService.shouldTreatAsBankAlert()` is the real filter, which only drafts a
transaction when either (a) the sender matches an account's configured
`smsSenderId`/`smsSenderNumber`, or (b) the message text itself contains both a clear amount
and a clear debit/credit direction — a bar an ordinary chat notification essentially never
clears.

**Every draft needs a confirm tap.** `SmsParser` (a pure, Android-framework-free class — see
its own doc comment) is a best-effort heuristic across many banks' own SMS formats. Nothing
it extracts is trusted outright: a parsed amount/direction/account lands on the Review screen
(`app/src/main/kotlin/.../review/ReviewScreen.kt`) for the user to confirm or correct, and
only an explicit "Approve" tap ever writes anything.

**Writes go through the real webapp store, not a second implementation.** Approving a draft
calls `WebAppBridge.createBankTransactionFromSms()`, which runs
`webView.evaluateJavascript(...)` to invoke `window.__nativeBridge.createBankTransactionFromSms`
— a small function in `webapp/src/lib/nativeBridge.ts` that calls the exact same
`useBankWorkbookStore().addTransaction()` action, `ensureSignedIn()` sign-in gate, and
category/seq/timestamp auto-fill every other Bank write in the app already goes through (see
`bankWorkbookStore.ts`'s `withDerivedFields`). A transaction created this way is
indistinguishable from a hand-typed one, except `source: 'statement-import'` and a
`statementRef: "sms:<id>"` marking where it came from — the same convention CSV statement
import already uses.

## How the two sides talk (the bridge)

```
Android                                          Webapp (inside the WebView)
--------                                         ----------------------------
SmsListenerService detects + parses a
notification, saves a draft locally
(DataStore, PendingTransactionRepository)

User reviews the draft, taps Approve
  -> MainViewModel.approve()
  -> WebAppBridge.createBankTransactionFromSms()
       webView.evaluateJavascript(
         "window.__nativeBridge
            .createBankTransactionFromSms(payload, requestId)")  ---->  createBankTransactionFromSms(payload, requestId)
                                                                          - ensureSignedInForBridge()
                                                                          - useBankWorkbookStore.getState().addTransaction(tx)
       WebAppBridge.JsInterface.onCreateTransactionResult()      <----  window.AndroidBridge.onCreateTransactionResult(requestId, success, message)
  (a CompletableDeferred keyed by requestId resolves the
   original suspend call — see WebAppBridge.kt's own doc comment)

Whenever the Bank accounts list changes (add/edit an
account's smsSenderId/smsSenderNumber)
                                                                          useNativeBridgeSync() (App.tsx)
  window.AndroidBridge.updateKnownSenders(json)                 <----    pushes the current account list
  -> WebAppBridge.JsInterface.updateKnownSenders()
     -> PendingTransactionRepository.replaceKnownAccounts()
```

Both directions are async (WebView JS bridging always is) — a request/response round-trip
uses a `requestId` and a 15s timeout (`WebAppBridge.REQUEST_TIMEOUT_MS`) so a page that hasn't
finished loading yet doesn't hang the caller forever, rather than assuming the page is always
ready.

Everything here is additive to the webapp: `window.__nativeBridge`/`window.AndroidBridge`
never exist in an ordinary browser, so `nativeBridge.ts`'s functions are cheap no-ops there —
this file has zero effect on the normal web app.

## Known limitation: Google sign-in inside the WebView

Google blocks its own "Sign in with Google" flow inside an embedded WebView (an anti-phishing
policy — it detects the WebView user agent). The webapp's Google sign-in
(`signInWithRedirect`, see repo root `CLAUDE.md`'s "Google Sign-in" history) will very likely
not complete inside this app's WebView. **Email/password sign-in works fine** — the webapp
already fully supports it (see `CLAUDE.md`'s Done item 205). If Google sign-in from inside
the app becomes a real requirement later, the fix is a native Firebase Auth SDK sign-in
bridged into the WebView's session (a real Firebase Android SDK dependency, not currently
part of this app — see `build.gradle.kts`'s own comment on why there isn't one) — not
attempted here, since it adds real scope and this app currently has zero Firebase dependency
of its own by design.

## What was verified in this sandbox, and what wasn't

This development sandbox's network policy blocks `dl.google.com` (Google's Maven repository,
which hosts the Android Gradle Plugin, Jetpack Compose, and every AndroidX library) — the
same class of restriction this whole project has hit before for Firebase/Google Fonts (see
repo root `CLAUDE.md`'s many "sandbox blocks X domain" notes). Concretely:

- **`./gradlew :app:assembleDebug` fails here**, and will fail in any environment with the
  same restriction — it can't resolve `com.android.application` at all. **This is expected
  and not a bug in the project** — it will build normally in Android Studio or any CI runner
  with normal internet access. (Confirmed by the fact that `.github/workflows/android-build.yml`
  now runs this exact command on GitHub's own runners, which have normal internet access — see
  "GitHub Actions build and published APK" below. That workflow itself has never actually run
  yet as of this writing, since it only fires on a push to `main`/`master`, not from inside
  this dev sandbox — the first real confirmation it works is the first real merge that touches
  `android/**`.)
- **`SmsParser.kt` — the actual parsing/matching logic, and the one file with no Android
  framework dependency — WAS compiled and its 11 unit tests WERE actually run**, via the raw
  Kotlin compiler jars fetched directly from Maven Central (reachable here, unlike
  `dl.google.com`) rather than through Gradle/AGP. All 11 pass. This is real verification, not
  a hand-trace.
- Every other Kotlin file (Compose UI, `MainActivity`, `SmsListenerService`,
  `WebAppBridge`, the DataStore repository) depends on Android SDK/AndroidX classes this
  sandbox can't fetch, so they were checked by careful manual review — resource references
  (`R.string.*`, `R.drawable.*`) were cross-checked against `strings.xml`/`drawable/` with a
  script, package declarations were checked against directory structure, and each file's
  logic was read through — but **not compiled**. A future session (or you, in Android
  Studio) should treat the first real `./gradlew build` as the actual first compile of those
  files, not a formality.
- The webapp side (`nativeBridge.ts`, the `App.tsx`/`useAuthState.ts` changes) **was fully
  verified**: `npx tsc -b`, `npm run test`, and `npm run build` all pass. (5 pre-existing test
  failures in `fifoPositions.test.ts`/`sortTransactions.test.ts` were confirmed via `git
  stash` to already exist on `main` before this work — unrelated to this change, not touched.)
- No real device/emulator run was possible here — the notification-listener flow, the
  WebView's actual rendering of the real site, and the end-to-end approve-a-draft round trip
  all need a real device and a real signed-in account to confirm end to end.

## Building it for real

```bash
cd android
./gradlew assembleDebug     # needs normal internet access (Google's Maven repo)
```

Or open `android/` directly in Android Studio (Koala/2024.1+ recommended for AGP 8.7.x) and
run it from there — that's the easier path for a first real build/run/debug cycle.

No `google-services.json`/Firebase Android SDK is needed — see `build.gradle.kts`'s own
comment on why. `./gradlew assembleDebug` installs and runs fine as-is via `adb install`
(AGP always self-signs a debug build with a debug keystore automatically). For a real,
release-signed build (`assembleRelease`/`bundleRelease`), see "Release signing" below —
without it, `release` still builds, just unsigned.

## Release signing

**Why this exists**: a debug-signed APK (Android's shared, reputation-less generic debug
key) reads to Google Play Protect as more suspicious than a real, permanent signing
identity — and Notification Listener access (this app's core feature) is exactly the kind
of permission Play Protect's install-time heuristics watch for on an app installed outside
Play Store. A real release key doesn't eliminate Play Protect's "not from Play Store"
warning on a sideloaded install, but it's a real, necessary step toward publishing through
Play Console (which does eliminate it for users who install from there), and toward Play
App Signing.

**A real signing keystore already exists for this app** (`financerecorder-release.jks`,
alias `financerecorder-upload`) — it was generated once and delivered directly to the app
owner, not committed to this repo (never commit a signing keystore or its passwords to
git — `android/.gitignore` blocks `*.jks`/`keystore.properties` for exactly this reason).
If you're picking this up without that file, generate your own:

```bash
keytool -genkeypair -v -keystore financerecorder-release.jks \
  -alias financerecorder-upload -keyalg RSA -keysize 2048 -validity 10950
```

(PKCS12 keystores — `keytool`'s modern default, including this one — don't support a
separate store vs. key password; whatever you're asked for as the "key password"
anywhere, use the same value as the store password.)

### Local build

Copy `android/keystore.properties.example` to `android/keystore.properties` (gitignored),
fill in `storeFile`/`storePassword`/`keyAlias`/`keyPassword`, then:

```bash
cd android
./gradlew assembleRelease   # signed release APK
./gradlew bundleRelease     # signed release AAB (what Play Console wants)
```

### CI build (GitHub Actions)

Add these as **repository secrets** (Settings → Secrets and variables → Actions →
"New repository secret") and `.github/workflows/android-build.yml` picks them up
automatically on the next push that touches `android/**` — no workflow file edit needed:

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The `.jks` file, base64-encoded as one line (see below) |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore's store password |
| `ANDROID_KEY_ALIAS` | `financerecorder-upload` (or whatever alias you used) |
| `ANDROID_KEY_PASSWORD` | Optional — omit it; it falls back to the store password (see the PKCS12 note above) |

To base64-encode the keystore file:

```bash
# macOS / Linux:
base64 -w0 financerecorder-release.jks
# Windows PowerShell:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("financerecorder-release.jks"))
```

Paste the resulting single-line output as `ANDROID_KEYSTORE_BASE64`'s value.

Once all three required secrets are set, every subsequent CI build (see "GitHub Actions
build and published APK" below) also produces:

- `builds/android/financerecorder-release.apk` — a real release-signed, installable APK,
  committed back to the repo the same way the debug APK already is.
- `builds/android/download-qr-release.png` — a QR code pointing at it.
- A GitHub Actions artifact named `financerecorder-release-aab` holding the signed `.aab`
  — this is what you manually upload to Play Console the first time (see below); CI
  doesn't publish it anywhere else, since it's only needed for that one manual step.
- `builds/android/build-info.txt` gains a `Release signing: yes` line plus the signing
  certificate's SHA-256 fingerprint (useful to cross-check against what Play Console shows
  under App integrity → App signing once you've uploaded).

Without those secrets set, CI behaves exactly as it always has — debug APK only, nothing
new published, no build step fails or even runs differently.

### Bootstrapping Play App Signing (one-time, manual)

1. Download the `financerecorder-release-aab` artifact from a CI run (or build it locally
   with `./gradlew bundleRelease`).
2. In Play Console, create the app listing (if it doesn't exist yet) under the account at
   https://play.google.com/store/apps/dev?id=4696950301960308735, package name
   `com.financerecorder.app`.
3. Upload that `.aab` as the first release (internal testing track is the lowest-friction
   place to start — it doesn't require a public listing to be reviewed first). Play
   Console will offer to enroll the app in **Play App Signing** on this first upload —
   accept it; Google then re-signs the app for distribution with its own key while your
   upload key (`financerecorder-upload`, in the keystore above) is what you keep using to
   sign every future upload.
4. Every later `bundleRelease` (whether built locally or by CI once secrets are added)
   just needs uploading through Play Console the same way — no further one-time setup.

This last step (the actual Play Console upload) has to happen from the account owner's own
Play Console session — nothing in this repo or its CI can do it automatically.

## GitHub Actions build and published APK

The workflow is located at:

```
.github/workflows/android-build.yml
```

It builds the Android project from `/android` and runs only on a push to `master` or `main`
when the pushed changes include `android/**`. A merged pull request produces such a push, so
a merge containing Android changes triggers the build; opening or updating a PR does not (this
was deliberate — a CI runner has normal internet access, unlike this project's own dev
sandbox, so `./gradlew assembleDebug` actually succeeds there, but there's no reason to spend
a build on every PR push when only a merge to `main`/`master` ships anything real).

After a successful build, CI does two things with the debug APK:

1. Uploads `financerecorder-debug-apk` as the normal GitHub Actions artifact.
2. Copies/replaces the latest APK in the repository at:

```
builds/android/financerecorder-debug.apk
```

It also writes:

```
builds/android/build-info.txt
```

with the CI run number, source commit, branch, build timestamp, and (once release signing
is configured — see "Release signing" above) whether this run also produced a
release-signed build and that key's SHA-256 fingerprint.

If the repository has the release-signing secrets configured, the same run additionally
builds and publishes a real release-signed APK — see "Release signing" above for the exact
secret names and what gets published once they're set. Nothing here changes for a repo
without those secrets; the debug-only behavior described above is unaffected.

### Download on your phone

The repository also contains a QR code that points to the latest Android APK download,
generated by the same workflow run:

```
builds/android/download-qr.png
```

Scan it with your phone to open and download the current APK without navigating through
GitHub Actions — see the root repository `README.md` for the embedded image and a direct
download link.

The repository copy under `/builds/android` is the canonical latest-build download. The root
repository README links directly to that APK rather than to the list of GitHub Actions runs.

The generated `/builds/android` commit does not start another Android build because the
workflow's path filter only watches `android/**` — `builds/android/**` isn't under that path.
It also carries `[skip ci]` in its own commit message, so it doesn't needlessly re-trigger
`static.yml`'s unfiltered webapp deploy either.

## Play Store notes

- **"Notification access" (the permission `SmsListenerService` uses) requires a Play Console
  declaration** under the app's Permissions Declaration Form — explain what it's used for
  (bank SMS detection) and that no notification content leaves the device except what the
  user explicitly approves into their own account's data. Google may ask for a short demo
  video of the feature during review.
- The manifest deliberately declares neither `READ_SMS` nor `RECEIVE_SMS` — see the
  "Why this architecture" section above for why, and don't add them without re-reading that
  reasoning; it's the difference between this feature being shippable on Play and not.
- Release signing exists (see "Release signing" above) and a real Play Console account
  with live apps is already available (https://play.google.com/store/apps/dev?id=4696950301960308735) —
  what's still needed: creating this specific app's listing there, the one-time AAB upload
  to bootstrap Play App Signing, and a privacy policy page for the app (Play Console
  requires a URL for this, and Notification Listener access needs its own declaration in
  the Permissions Declaration Form — see the bullet above this one).

## What's deliberately not built yet (v1 scope)

- Only Bank transactions are SMS-detectable — Cash has no `smsSenderId`-equivalent field
  today, and wasn't in scope for this pass.
- No offline queueing beyond the local DataStore draft list — a draft created while signed
  out just sits until the user signs in and re-taps Approve (the sign-in gate itself handles
  this, no separate retry queue was built).
- No dedicated app icon artwork — `ic_launcher_foreground.xml`/`ic_launcher_background.xml`
  are a simple hand-drawn vector (the same 3-bar growth-chart motif as the webapp's own
  `LogoMark`), not real designed icon art.
- The manual "share/paste an SMS into the app" fallback discussed but not chosen as the
  primary mechanism was not built either — Notification Listener was picked as the sole
  mechanism for v1.

## File map

```
android/
  app/src/main/kotlin/com/financerecorder/app/
    AppConfig.kt                 Webapp URL, JS interface name — the few things likely to change
    FinanceRecorderApp.kt        Application class — sets up the review-reminder notification channel
    MainActivity.kt              Bottom-nav Scaffold (WebView tab / Review tab), permission prompts
    FinanceWebView.kt            The WebView itself — settings, URL allowlist, loading/error state
    MainViewModel.kt             Owns WebAppBridge + the pending-drafts/known-accounts state
    ui/theme/Theme.kt            Compose Material3 theme (matches the webapp's own default "wine" accent)
    bridge/WebAppBridge.kt       The native<->WebView JS bridge (see "How the two sides talk" above)
    sms/
      ParsedTransaction.kt       Data classes: a draft, and a known-account SMS-matching record
      SmsParser.kt                Pure parsing/matching logic — the one fully JVM-testable file
      SmsListenerService.kt      NotificationListenerService — the real entry point for detection
      PendingTransactionRepository.kt  Local DataStore holding drafts + the known-accounts cache
    review/ReviewScreen.kt       The review/approve/edit/discard UI
  app/src/test/kotlin/.../sms/SmsParserTest.kt   11 cases against realistic bank SMS samples

webapp/src/lib/nativeBridge.ts   The one webapp file this feature adds — everything else it
                                 calls (addTransaction, ensureSignedIn, category auto-fill)
                                 already existed
```
