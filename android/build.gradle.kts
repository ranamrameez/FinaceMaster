// Top-level build file. Individual module build logic lives in app/build.gradle.kts.
//
// Deliberately no Firebase Android SDK / google-services plugin here: this app has no
// native Firebase dependency at all. Auth and every data write happen inside the WebView,
// through the real webapp's own already-signed-in Firebase session — native code only ever
// reaches the data layer via the JS bridge (see bridge/WebAppBridge.kt), never directly.
// See android/README.md for the reasoning.
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
}
