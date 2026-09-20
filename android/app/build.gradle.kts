import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// Release signing is optional and additive: if no keystore is configured (no local
// keystore.properties, no CI secrets), `release` simply builds unsigned, exactly as it
// always did — `assembleDebug` (what CI has built from day one) is completely unaffected
// either way. This lets the same build.gradle.kts work for a contributor with no keystore
// at all, a local dev with one on disk, and CI with one injected via secrets.
//
// Local dev: create android/keystore.properties (gitignored, see
// keystore.properties.example) with storeFile/storePassword/keyAlias/keyPassword.
// CI: ANDROID_KEYSTORE_BASE64 / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS env vars
// (see .github/workflows/android-build.yml, which decodes the base64 secret to a file
// and passes the rest straight through as env vars — no keystore.properties file exists
// in CI).
//
// Note on passwords: the real keystore this app ships with is PKCS12 (keytool's modern
// default), which does not support a separate store vs. key password — keytool itself
// ignores any distinct -keypass value for a PKCS12 store. So keyPassword below always
// falls back to the same value as storePassword when one isn't explicitly given; don't
// expect them to ever meaningfully differ for this keystore.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}

fun releaseSigningValue(propertyKey: String, envKey: String): String? =
    keystoreProperties.getProperty(propertyKey) ?: System.getenv(envKey)

val releaseStoreFilePath = releaseSigningValue("storeFile", "ANDROID_KEYSTORE_PATH")
val releaseStorePassword = releaseSigningValue("storePassword", "ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = releaseSigningValue("keyAlias", "ANDROID_KEY_ALIAS")
val releaseKeyPassword =
    releaseSigningValue("keyPassword", "ANDROID_KEY_PASSWORD") ?: releaseStorePassword

val hasReleaseSigning =
    !releaseStoreFilePath.isNullOrBlank() &&
        !releaseStorePassword.isNullOrBlank() &&
        !releaseKeyAlias.isNullOrBlank()

android {
    namespace = "com.financerecorder.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.financerecorder.app"
        // NotificationListenerService needs API 19+; WebView + Compose work comfortably from
        // here. 26 (Android 8.0, 2017+) also means every device targeted can use an adaptive
        // launcher icon with no legacy PNG fallback set needed — a reasonable floor for the
        // app's real Pakistan/Qatar userbase without chasing only the newest APIs.
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStoreFilePath!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            // With no keystore configured, this build type is left unsigned — Gradle will
            // still produce app-release-unsigned.apk/.aab, just not installable as-is. That's
            // fine for a local `./gradlew assembleRelease` sanity check; CI only ever
            // publishes a release artifact when hasReleaseSigning is true (see
            // .github/workflows/android-build.yml).
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // WebViewCompat / WebSettingsCompat — lets us safely check feature support (dark-mode
    // forcing, safe-browsing) instead of guessing at framework-version gating by hand.
    implementation("androidx.webkit:webkit:1.12.1")

    // Local, on-device storage for parsed-but-not-yet-approved SMS drafts. Deliberately a
    // Preferences DataStore holding one serialized JSON list rather than Room — v1's draft
    // list is small (a handful of pending items at most, since review is meant to happen
    // promptly) and doesn't need SQL query capability.
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}
