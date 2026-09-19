package com.financerecorder.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.financerecorder.app.review.ReviewScreen
import com.financerecorder.app.ui.theme.FinanceRecorderTheme

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op either way */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestPostNotificationsIfNeeded()

        val openReview = intent?.action == ACTION_OPEN_REVIEW
        setContent {
            FinanceRecorderTheme {
                AppRoot(viewModel = viewModel, startOnReview = openReview)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // A fresh Activity instance handles this via the openReview flag passed into
        // setContent above; onNewIntent only fires for an already-running instance
        // (singleTop), where recreating the whole Compose tree isn't necessary — the review
        // tab is one tap away regardless, so no extra plumbing here beyond keeping the intent.
    }

    private fun requestPostNotificationsIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    companion object {
        const val ACTION_OPEN_REVIEW = "com.financerecorder.app.action.OPEN_REVIEW"
    }
}

private enum class Tab { WEBAPP, REVIEW }

@Composable
private fun AppRoot(viewModel: MainViewModel, startOnReview: Boolean) {
    var currentTab by remember { mutableStateOf(if (startOnReview) Tab.REVIEW else Tab.WEBAPP) }
    val pendingTransactions by viewModel.pendingTransactions.collectAsState()
    val knownAccounts by viewModel.knownAccounts.collectAsState()
    val approveOutcome by viewModel.lastApproveOutcome.collectAsState()

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = currentTab == Tab.WEBAPP,
                    onClick = { currentTab = Tab.WEBAPP },
                    icon = { Icon(Icons.Filled.Public, contentDescription = null) },
                    label = { Text(stringResource(R.string.app_name)) },
                )
                NavigationBarItem(
                    selected = currentTab == Tab.REVIEW,
                    onClick = { currentTab = Tab.REVIEW },
                    icon = {
                        if (pendingTransactions.isEmpty()) {
                            Icon(Icons.Filled.NotificationsActive, contentDescription = null)
                        } else {
                            BadgedBox(badge = { Badge { Text(pendingTransactions.size.toString()) } }) {
                                Icon(Icons.Filled.NotificationsActive, contentDescription = null)
                            }
                        }
                    },
                    label = { Text(stringResource(R.string.review_screen_title)) },
                )
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding)) {
            NotificationAccessBanner()
            when (currentTab) {
                Tab.WEBAPP -> FinanceWebView(webAppBridge = viewModel.webAppBridge)
                Tab.REVIEW -> ReviewScreen(
                    pendingTransactions = pendingTransactions,
                    knownAccounts = knownAccounts,
                    approveOutcome = approveOutcome,
                    onConsumeOutcome = viewModel::consumeApproveOutcome,
                    onApprove = viewModel::approve,
                    onDiscard = viewModel::discard,
                    onUpdate = viewModel::updateDraft,
                )
            }
        }
    }
}

/**
 * A dismissible reminder shown until the user grants Notification access — without it the
 * whole SMS-detection feature is inert (see SmsListenerService's own doc comment for why this
 * is the permission model, rather than READ_SMS). Re-checked on every resume rather than
 * once, so it disappears the moment access is actually granted in Settings.
 */
@Composable
private fun NotificationAccessBanner() {
    val context = LocalContext.current
    var dismissed by remember { mutableStateOf(false) }
    var granted by remember { mutableStateOf(isNotificationAccessGranted(context)) }
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                granted = isNotificationAccessGranted(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (granted || dismissed) return

    Surface(color = MaterialTheme.colorScheme.secondaryContainer) {
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
        ) {
            Column(Modifier.padding(12.dp)) {
                Text(
                    stringResource(R.string.permission_notification_access_title),
                    style = MaterialTheme.typography.titleSmall,
                )
                Text(
                    stringResource(R.string.permission_notification_access_body),
                    style = MaterialTheme.typography.bodySmall,
                )
                Row(
                    modifier = Modifier.padding(top = 8.dp),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(onClick = { dismissed = true }) {
                        Text(stringResource(R.string.permission_notification_access_skip))
                    }
                    TextButton(onClick = {
                        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                    }) {
                        Text(stringResource(R.string.permission_notification_access_grant))
                    }
                }
            }
        }
    }
}

private fun isNotificationAccessGranted(context: Context): Boolean =
    NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
