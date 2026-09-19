package com.financerecorder.app

/** Single place for values that might change without touching the rest of the app. */
object AppConfig {
    /** The real deployed webapp this app is a shell around — see repo root CLAUDE.md. */
    const val WEBAPP_URL = "https://ranamrameez.github.io/FinaceMaster/"

    /** Only URLs on this host are allowed to load inside the app's own WebView; anything
     *  else (an external link the user taps inside the page) opens in the system browser. */
    const val WEBAPP_HOST = "ranamrameez.github.io"

    /** Name JS on the page calls into native code through (webView.addJavascriptInterface). */
    const val JS_INTERFACE_NAME = "AndroidBridge"
}
