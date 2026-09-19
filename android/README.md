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
  with normal internet access.
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
comment on why. No signing config is set up for a release build yet; add one before
publishing (a debug build installs and runs fine as-is via `adb install`).

## Play Store notes

- **"Notification access" (the permission `SmsListenerService` uses) requires a Play Console
  declaration** under the app's Permissions Declaration Form — explain what it's used for
  (bank SMS detection) and that no notification content leaves the device except what the
  user explicitly approves into their own account's data. Google may ask for a short demo
  video of the feature during review.
- The manifest deliberately declares neither `READ_SMS` nor `RECEIVE_SMS` — see the
  "Why this architecture" section above for why, and don't add them without re-reading that
  reasoning; it's the difference between this feature being shippable on Play and not.
- No signing/release config, no Play Console listing, no privacy policy page for the app
  specifically exist yet — real pre-launch checklist items, not started here.

## What's deliberately not built yet (v1 scope)

- Only Bank transactions are SMS-detectable — Cash has no `smsSenderId`-equivalent field
  today, and wasn't in scope for this pass.
- No offline queueing beyond the local DataStore draft list — a draft created while signed
  out just sits until the user signs in and re-taps Approve (the sign-in gate itself handles
  this, no separate retry queue was built).
- No dedicated app icon artwork — `ic_launcher_foreground.xml`/`ic_launcher_background.xml`
  are a simple hand-drawn vector (the same 3-bar growth-chart motif as the webapp's own
  `LogoMark`), not real designed icon art.
- No CI workflow for this module yet (the repo's existing `.github/workflows/static.yml` only
  builds `webapp/`).
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
