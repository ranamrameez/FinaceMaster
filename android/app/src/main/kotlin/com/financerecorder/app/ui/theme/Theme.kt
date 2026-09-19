package com.financerecorder.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Roughly matches the webapp's own default "wine" accent theme (see
// webapp/src/theme.css / repo root CLAUDE.md) so the native shell chrome and the page it
// loads read as one brand, without trying to mirror every one of the webapp's dozen themes —
// this is the native window's own chrome, not the page content itself.
private val WineBrand = Color(0xFF7A2E3A)
private val WineBrandDark = Color(0xFF4A1A22)

private val LightColors = lightColorScheme(
    primary = WineBrand,
    secondary = WineBrand,
    background = Color(0xFFF5F3F1),
    surface = Color(0xFFFFFFFF),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFC98A96),
    secondary = Color(0xFFC98A96),
    background = Color(0xFF181414),
    surface = Color(0xFF241C1D),
)

@Composable
fun FinanceRecorderTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color (Android 12+ Material You) is deliberately off by default — this app's
    // brand color is meaningful (matches the webapp's own default theme), and letting it get
    // replaced by an arbitrary wallpaper-derived palette would break that association. Left
    // as an opt-in parameter rather than removed outright, in case a future session wants it.
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        darkTheme -> DarkColors
        else -> LightColors
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = (if (darkTheme) WineBrandDark else WineBrand).toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
