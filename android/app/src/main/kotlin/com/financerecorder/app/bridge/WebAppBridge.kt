package com.financerecorder.app.bridge

import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.financerecorder.app.AppConfig
import com.financerecorder.app.sms.KnownSmsAccount
import com.financerecorder.app.sms.ParsedTransaction
import com.financerecorder.app.sms.PendingTransactionRepository
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * The one bridge between native code and the webapp running inside the WebView.
 *
 * Deliberately thin: it never writes a transaction itself, never touches Firebase, and never
 * knows the shape of the app's own data model beyond this one payload — it just marshals a
 * confirmed draft over to `window.__nativeBridge.createBankTransactionFromSms(...)`
 * (webapp/src/lib/nativeBridge.ts), which reuses the real Bank store's own `addTransaction`
 * action, `ensureSignedIn()` gate, seq assignment, and cloud sync — the exact same path a
 * normal in-app "Add a transaction" would take. Nothing here can silently write around that.
 *
 * WebView JS bridging is inherently async, so a request/response round-trip is done with a
 * request id: native calls into the page, the page's own async write resolves, and the page
 * calls back into [JsInterface.onCreateTransactionResult] with the same id — matched here via
 * a map of [CompletableDeferred]s, with a timeout so a page that never responds (e.g. it
 * hasn't finished loading yet) doesn't hang the caller forever.
 */
class WebAppBridge(
    private val repository: PendingTransactionRepository,
    private val scope: CoroutineScope,
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val pendingResults = ConcurrentHashMap<String, CompletableDeferred<BridgeResult>>()
    private var webView: WebView? = null

    val jsInterface = JsInterface()

    fun attach(webView: WebView) {
        this.webView = webView
    }

    fun detach() {
        webView = null
    }

    data class BridgeResult(val success: Boolean, val message: String)

    /**
     * Sends a user-approved draft into the webapp's real Bank store. Requires
     * [ParsedTransaction.matchedAccountId] to already be set — the review screen doesn't let
     * Approve be tapped otherwise, since there's no account to file the transaction under.
     */
    suspend fun createBankTransactionFromSms(draft: ParsedTransaction): BridgeResult {
        val accountId = draft.matchedAccountId
            ?: return BridgeResult(false, "No account selected")
        val amount = draft.amount
            ?: return BridgeResult(false, "No amount entered")
        val isDeposit = draft.isDeposit
            ?: return BridgeResult(false, "Direction (money in/out) not set")
        val view = webView ?: return BridgeResult(false, "The app page hasn't finished loading yet")

        val instant = Instant.ofEpochMilli(draft.detectedAtEpochMillis)
        val zone = ZoneId.systemDefault()
        val zoned = instant.atZone(zone)
        val payload = SmsTransactionPayload(
            accountId = accountId,
            amount = amount,
            isDeposit = isDeposit,
            description = draft.description.ifBlank { "SMS transaction" },
            date = zoned.format(DateTimeFormatter.ISO_LOCAL_DATE),
            time = zoned.format(DateTimeFormatter.ofPattern("HH:mm")),
            timezone = zone.id,
            statementRef = "sms:${draft.id}",
        )

        val requestId = UUID.randomUUID().toString()
        val deferred = CompletableDeferred<BridgeResult>()
        pendingResults[requestId] = deferred

        val payloadJson = json.encodeToString(payload)
        // JSON.parse on the page side rather than inlining the object literal — sidesteps any
        // escaping subtlety in turning a Kotlin string into a JS string literal.
        val js = """
            (function() {
              if (window.__nativeBridge && window.__nativeBridge.createBankTransactionFromSms) {
                window.__nativeBridge.createBankTransactionFromSms(
                  JSON.parse(${json.encodeToString(payloadJson)}),
                  ${json.encodeToString(requestId)}
                );
              } else if (window.${AppConfig.JS_INTERFACE_NAME}) {
                window.${AppConfig.JS_INTERFACE_NAME}.onCreateTransactionResult(${json.encodeToString(requestId)}, false, 'App bridge not ready');
              }
            })();
        """.trimIndent()

        withContext(Dispatchers.Main) {
            view.evaluateJavascript(js, null)
        }

        val result = withTimeoutOrNull(REQUEST_TIMEOUT_MS) { deferred.await() }
        pendingResults.remove(requestId)
        return result ?: BridgeResult(false, "Timed out waiting for the app page to respond")
    }

    inner class JsInterface {
        /** Called by the webapp whenever its Bank accounts list changes (add/edit/remove an
         *  account, or its smsSenderId/smsSenderNumber), so the notification listener always
         *  matches against the current account list even when the WebView isn't in front. */
        @JavascriptInterface
        fun updateKnownSenders(accountsJson: String) {
            scope.launch {
                val accounts = runCatching {
                    json.decodeFromString<List<KnownSmsAccount>>(accountsJson)
                }.getOrDefault(emptyList())
                repository.replaceKnownAccounts(accounts)
            }
        }

        @JavascriptInterface
        fun onCreateTransactionResult(requestId: String, success: Boolean, message: String) {
            pendingResults.remove(requestId)?.complete(BridgeResult(success, message))
        }
    }

    companion object {
        private const val REQUEST_TIMEOUT_MS = 15_000L
    }
}

@Serializable
private data class SmsTransactionPayload(
    val accountId: String,
    val amount: Double,
    val isDeposit: Boolean,
    val description: String,
    val date: String,
    val time: String,
    val timezone: String,
    val statementRef: String,
)
