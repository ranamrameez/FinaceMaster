package com.financerecorder.app.sms

import android.app.Notification
import android.app.PendingIntent
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.financerecorder.app.FinanceRecorderApp
import com.financerecorder.app.MainActivity
import com.financerecorder.app.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Reads notifications the phone's own default messaging app posts for an incoming SMS, and
 * turns anything that looks like a bank transaction alert into a draft the user reviews
 * before it's saved (see ParsedTransaction/PendingTransactionRepository).
 *
 * This deliberately never touches READ_SMS/RECEIVE_SMS or the SMS content provider — only
 * notifications the user has already granted this app access to via
 * Settings > Notification access. See android/README.md for why (Play Store policy).
 *
 * Not scoped to a specific messaging-app package name on purpose: which app is "the"
 * messaging app varies a lot by OEM (Google Messages, Samsung Messages, various others), and
 * hard-coding a package allowlist would silently stop working for anyone not on that list.
 * Every notification is inspected instead; [shouldTreatAsBankAlert] is the real filter that
 * keeps this from drafting a transaction out of an ordinary chat notification.
 */
class SmsListenerService : NotificationListenerService() {

    private val serviceJob = Job()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    override fun onDestroy() {
        serviceJob.cancel()
        super.onDestroy()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        // Never inspect our own notifications, and skip ongoing/foreground-service style
        // notifications (media players, downloads, etc.) which are never an SMS alert.
        if (sbn.packageName == packageName) return
        if (sbn.notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        if (text.isBlank()) return

        val repository = PendingTransactionRepository.getInstance(applicationContext)
        serviceScope.launch {
            val knownAccounts = repository.currentKnownAccounts()
            val fields = SmsParser.parse(text)
            val matchedAccount = SmsParser.matchAccount(title, text, knownAccounts)

            if (!shouldTreatAsBankAlert(matchedAccount, fields)) return@launch

            val draft = ParsedTransaction(
                id = UUID.randomUUID().toString(),
                rawText = text,
                senderLabel = title,
                detectedAtEpochMillis = sbn.postTime,
                amount = fields.amount,
                isDeposit = fields.isDeposit,
                description = fields.descriptionHint ?: text.take(80),
                matchedAccountId = matchedAccount?.accountId,
                matchedAccountName = matchedAccount?.accountName,
                matchedCurrencyCode = matchedAccount?.currencyCode,
            )
            repository.add(draft)
            showNotification(repository.pendingTransactions.first().size)
        }
    }

    /**
     * A known-sender match is trusted on its own. Without one, only proceed when the message
     * itself reads as an unambiguous transaction alert (a clear amount AND a clear debit/
     * credit direction) — an ordinary chat message essentially never contains both, so this
     * stays a low false-positive filter without needing a hardcoded messaging-app allowlist.
     */
    private fun shouldTreatAsBankAlert(
        matchedAccount: KnownSmsAccount?,
        fields: SmsParser.ParsedFields,
    ): Boolean = matchedAccount != null || (fields.amount != null && fields.isDeposit != null)

    private fun showNotification(count: Int) {
        if (count <= 0) return
        val manager = NotificationManagerCompat.from(this)
        val openIntent = Intent(this, MainActivity::class.java).apply {
            action = MainActivity.ACTION_OPEN_REVIEW
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val body = if (count == 1) {
            getString(R.string.review_notification_body_one)
        } else {
            getString(R.string.review_notification_body_many, count)
        }
        val notification = NotificationCompat.Builder(this, FinanceRecorderApp.REVIEW_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(getString(R.string.review_notification_title))
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        manager.notify(REVIEW_NOTIFICATION_ID, notification)
    }

    companion object {
        private const val REVIEW_NOTIFICATION_ID = 1001
    }
}
