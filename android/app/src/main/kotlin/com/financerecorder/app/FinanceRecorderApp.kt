package com.financerecorder.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class FinanceRecorderApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createReviewNotificationChannel()
    }

    private fun createReviewNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            REVIEW_CHANNEL_ID,
            getString(R.string.review_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = getString(R.string.review_channel_description)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val REVIEW_CHANNEL_ID = "transactions_to_review"
    }
}
