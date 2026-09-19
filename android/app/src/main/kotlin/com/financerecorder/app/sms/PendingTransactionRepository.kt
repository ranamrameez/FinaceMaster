package com.financerecorder.app.sms

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val Context.pendingTxDataStore by preferencesDataStore(name = "pending_transactions")

/**
 * Local-only holding area for parsed-but-not-yet-approved SMS drafts. Nothing here ever
 * reaches the real ledger on its own — see ReviewViewModel/WebAppBridge for the approve flow,
 * which is the only path that writes into the webapp's own data.
 *
 * A single JSON-encoded list in a Preferences DataStore, not Room — the draft list is small
 * (review is meant to happen promptly) and never needs a real query, just "read it all,
 * replace it all."
 */
class PendingTransactionRepository(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }
    private val listKey = stringPreferencesKey("pending_list_json")
    private val knownAccountsKey = stringPreferencesKey("known_accounts_json")

    val pendingTransactions: Flow<List<ParsedTransaction>> =
        context.pendingTxDataStore.data.map { prefs -> decodeList(prefs[listKey]) }

    val knownAccounts: Flow<List<KnownSmsAccount>> =
        context.pendingTxDataStore.data.map { prefs -> decodeAccounts(prefs[knownAccountsKey]) }

    suspend fun currentKnownAccounts(): List<KnownSmsAccount> =
        decodeAccounts(context.pendingTxDataStore.data.first()[knownAccountsKey])

    suspend fun add(transaction: ParsedTransaction) {
        context.pendingTxDataStore.edit { prefs ->
            val current = decodeList(prefs[listKey])
            prefs[listKey] = json.encodeToString(current + transaction)
        }
    }

    suspend fun update(transaction: ParsedTransaction) {
        context.pendingTxDataStore.edit { prefs ->
            val current = decodeList(prefs[listKey])
            val updated = current.map { if (it.id == transaction.id) transaction else it }
            prefs[listKey] = json.encodeToString(updated)
        }
    }

    suspend fun remove(id: String) {
        context.pendingTxDataStore.edit { prefs ->
            val current = decodeList(prefs[listKey])
            prefs[listKey] = json.encodeToString(current.filterNot { it.id == id })
        }
    }

    suspend fun replaceKnownAccounts(accounts: List<KnownSmsAccount>) {
        context.pendingTxDataStore.edit { prefs ->
            prefs[knownAccountsKey] = json.encodeToString(accounts)
        }
    }

    private fun decodeList(raw: String?): List<ParsedTransaction> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching { json.decodeFromString<List<ParsedTransaction>>(raw) }.getOrDefault(emptyList())
    }

    private fun decodeAccounts(raw: String?): List<KnownSmsAccount> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching { json.decodeFromString<List<KnownSmsAccount>>(raw) }.getOrDefault(emptyList())
    }

    companion object {
        @Volatile private var instance: PendingTransactionRepository? = null

        fun getInstance(context: Context): PendingTransactionRepository =
            instance ?: synchronized(this) {
                instance ?: PendingTransactionRepository(context.applicationContext).also { instance = it }
            }
    }
}
