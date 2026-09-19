package com.financerecorder.app.sms

import java.util.Locale

/**
 * Pure, Android-framework-free parsing of a bank SMS/notification body into a best-effort
 * amount + direction + description guess. Deliberately never trusted outright — every field
 * this produces lands on the review screen for the user to confirm or correct before
 * anything is saved (see ParsedTransaction's own doc comment). A wrong guess here costs one
 * extra tap on the review screen, never a bad write.
 *
 * No JVM/Android dependency on purpose, so this can be exercised by plain JUnit tests
 * (app/src/test/...) without an emulator or Robolectric.
 */
object SmsParser {

    // Currency tokens this user's real banks actually use (Rs/PKR for Pakistani banks, QR/QAR
    // for Qatari ones — see repo root CLAUDE.md's "Current status" history) plus a few common
    // others. Extending this list needs no other code change.
    private val CURRENCY_TOKENS = listOf(
        "PKR", "Rs\\.?", "QAR", "QR", "USD", "AED", "SAR", "GBP", "EUR", "\\$"
    )

    private val AMOUNT_REGEX = Regex(
        "(?:${CURRENCY_TOKENS.joinToString("|")})\\s?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)",
        RegexOption.IGNORE_CASE
    )

    // Ordered so a more specific phrase is checked before a shorter one it contains
    // (e.g. "payment of" before a bare "paid").
    private val WITHDRAWAL_KEYWORDS = listOf(
        "debited", "debit of", "withdrawn", "withdrawal", "spent", "purchase of", "purchased",
        "payment of", "paid to", "deducted", "sent to", "transferred to", "dr.", "debit"
    )
    private val DEPOSIT_KEYWORDS = listOf(
        "credited", "credit of", "received", "deposited", "deposit of", "cr.", "credit",
        "refund of", "refunded"
    )

    // Grabs a trailing "at <merchant>" / "to <name>" fragment as a description hint, when
    // present — a nice-to-have, not load-bearing (falls back to the raw text otherwise).
    private val MERCHANT_HINT_REGEX = Regex(
        "\\b(?:at|to)\\s+([A-Za-z0-9 .,'&-]{3,40}?)(?:[.,]|\\s+on\\s|\\s+Avl|\\s+bal|$)",
        RegexOption.IGNORE_CASE
    )

    data class ParsedFields(
        val amount: Double?,
        val isDeposit: Boolean?,
        val descriptionHint: String?,
    )

    fun parse(rawText: String): ParsedFields {
        val amount = extractAmount(rawText)
        val isDeposit = extractDirection(rawText)
        val descriptionHint = extractMerchantHint(rawText)
        return ParsedFields(amount, isDeposit, descriptionHint)
    }

    private fun extractAmount(text: String): Double? {
        // If several amounts appear (e.g. transaction amount + "Avl Bal"), the FIRST one is
        // the transaction itself for every real sample this was checked against — a running/
        // available balance is reported after it, not before.
        val match = AMOUNT_REGEX.find(text) ?: return null
        val digits = match.groupValues[1].replace(",", "")
        return digits.toDoubleOrNull()
    }

    private fun extractDirection(text: String): Boolean? {
        val lower = text.lowercase(Locale.ROOT)
        val withdrawalHit = WITHDRAWAL_KEYWORDS.firstOrNull { lower.contains(it) }
        val depositHit = DEPOSIT_KEYWORDS.firstOrNull { lower.contains(it) }
        return when {
            withdrawalHit != null && depositHit == null -> false
            depositHit != null && withdrawalHit == null -> true
            // Both or neither matched — genuinely ambiguous, leave it to the user rather
            // than guess at a 50/50.
            else -> null
        }
    }

    private fun extractMerchantHint(text: String): String? =
        MERCHANT_HINT_REGEX.find(text)?.groupValues?.get(1)?.trim()?.takeIf { it.isNotBlank() }

    /**
     * Matches a notification's sender label / body against the accounts the webapp has told
     * native code about (via the JS bridge — see bridge/WebAppBridge.kt). A message that
     * doesn't match any known sender ID/number still becomes a draft (so nothing is silently
     * dropped) — it's just left unmatched for the user to pick an account on the review
     * screen, same as an amount/direction the parser couldn't confidently extract.
     */
    fun matchAccount(senderLabel: String, rawText: String, knownAccounts: List<KnownSmsAccount>): KnownSmsAccount? {
        val haystack = "$senderLabel $rawText".lowercase(Locale.ROOT)
        val haystackDigits = normalizeDigits("$senderLabel $rawText")
        return knownAccounts.firstOrNull { account ->
            val bySenderId = account.smsSenderId?.takeIf { it.isNotBlank() }
                ?.let { haystack.contains(it.lowercase(Locale.ROOT)) } ?: false
            val bySenderNumber = account.smsSenderNumber?.takeIf { it.isNotBlank() }
                ?.let { number -> normalizeDigits(number).let { it.isNotEmpty() && haystackDigits.contains(it) } }
                ?: false
            bySenderId || bySenderNumber
        }
    }

    private fun normalizeDigits(s: String): String = s.filter { it.isDigit() }
}
