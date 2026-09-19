package com.financerecorder.app

import android.annotation.SuppressLint
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.financerecorder.app.bridge.WebAppBridge

/**
 * Full-screen WebView loading the real deployed webapp (see AppConfig.WEBAPP_URL) and wiring
 * up [WebAppBridge] as the native<->page channel. This is the entire app's UI for everything
 * except SMS review — every existing module, page, and the calc engine behind it comes from
 * the page itself, not from native code.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun FinanceWebView(
    webAppBridge: WebAppBridge,
    modifier: Modifier = Modifier,
    onWebViewReady: (WebView) -> Unit = {},
) {
    val context = LocalContext.current
    var isLoading by remember { mutableStateOf(true) }
    var loadFailed by remember { mutableStateOf(false) }
    var reloadTrigger by remember { mutableStateOf(0) }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.databaseEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    // The webapp itself is responsive/mobile-aware (see webapp/CLAUDE.md's own
                    // "works at phone width" history) — no need for the legacy wide-viewport
                    // zoom-to-fit hacks some older WebView-wrapper apps rely on.
                    settings.useWideViewPort = true
                    settings.loadWithOverviewMode = true

                    addJavascriptInterface(webAppBridge.jsInterface, AppConfig.JS_INTERFACE_NAME)
                    webAppBridge.attach(this)

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView,
                            request: WebResourceRequest,
                        ): Boolean {
                            val uri = request.url
                            return if (uri.host == AppConfig.WEBAPP_HOST) {
                                false // let the WebView load it
                            } else {
                                // An external link tapped inside the page (e.g. a doc/PDF
                                // link) opens in the system browser instead of navigating
                                // this WebView away from the app.
                                runCatching {
                                    context.startActivity(
                                        android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
                                    )
                                }
                                true
                            }
                        }

                        override fun onPageFinished(view: WebView, url: String?) {
                            isLoading = false
                            loadFailed = false
                        }

                        override fun onReceivedError(
                            view: WebView,
                            request: WebResourceRequest,
                            error: android.webkit.WebResourceError,
                        ) {
                            if (request.isForMainFrame) {
                                isLoading = false
                                loadFailed = true
                            }
                        }
                    }

                    loadUrl(AppConfig.WEBAPP_URL)
                    onWebViewReady(this)
                }
            },
            update = { webView ->
                if (reloadTrigger > 0) {
                    isLoading = true
                    loadFailed = false
                    webView.loadUrl(AppConfig.WEBAPP_URL)
                }
            },
        )

        if (isLoading && !loadFailed) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        if (loadFailed) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(24.dp),
                ) {
                    Text(stringResource(R.string.webview_error_title), style = MaterialTheme.typography.titleMedium)
                    Text(stringResource(R.string.webview_error_body), style = MaterialTheme.typography.bodyMedium)
                    Button(onClick = { reloadTrigger++ }, modifier = Modifier.padding(top = 12.dp)) {
                        Text(stringResource(R.string.webview_retry))
                    }
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose { webAppBridge.detach() }
    }
}
