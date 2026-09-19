package com.financerecorder.app.sms

import kotlinx.serialization.Serializable

/**
 * A draft transaction extracted from a bank SMS notification, waiting for the user to
 * review, edit, and approve (or discard) it — never written to the real ledger until then.
 *
 * `amount`/`isDeposit` are nullable because [SmsParser] is a best-effort heuristic across
 * many banks' own message formats; a field it couldn't confidently extract is left blank on
 * the review screen for the user to fill in, rather than guessed at.
 */
@Serializable
data class ParsedTransaction(
    val id: String,
    val rawText: String,
    val senderLabel: String,
    val detectedAtEpochMillis: Long,
    val amount: Double? = null,
    val isDeposit: Boolean? = null,
    val description: String = "",
    val matchedAccountId: String? = null,
    val matchedAccountName: String? = null,
    val matchedCurrencyCode: String? = null,
)

/** One bank account's SMS-matching info, mirrored in from the webapp's own BankAccount
 *  (see webapp/src/types/bankWorkbook.ts — smsSenderId/smsSenderNumber). */
@Serializable
data class KnownSmsAccount(
    val accountId: String,
    val accountName: String,
    val currencyCode: String,
    val smsSenderId: String? = null,
    val smsSenderNumber: String? = null,
)
