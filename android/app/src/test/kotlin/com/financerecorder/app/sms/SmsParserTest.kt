package com.financerecorder.app.sms

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Realistic samples matching this app's own real user base (Pakistani banks — UBL/QIB/
 * JazzCash-style — and Qatari QAR banks), per repo root CLAUDE.md's own documented real bank
 * SMS formats. SmsParser is a best-effort heuristic, not a guarantee — every field it can't
 * confidently extract is asserted null here, matching what the review screen does with it
 * (leaves it for the user to fill in, never guesses).
 */
class SmsParserTest {

    @Test
    fun `extracts a withdrawal amount from a typical debited alert`() {
        val text = "Rs.5,000.00 debited from A/C XXXX1234 on 19-SEP-26. Avl Bal Rs.12,345.67"
        val fields = SmsParser.parse(text)
        assertEquals(5000.00, fields.amount!!, 0.001)
        assertEquals(false, fields.isDeposit)
    }

    @Test
    fun `takes the first amount, not a later available-balance figure`() {
        // The "Avl Bal" figure (30,000) must never be mistaken for the transaction amount.
        val text = "PKR 1,500 debited from your account. Avl Bal: PKR 30,000."
        val fields = SmsParser.parse(text)
        assertEquals(1500.0, fields.amount!!, 0.001)
    }

    @Test
    fun `extracts a deposit amount from a received-style alert`() {
        val text = "You have received PKR 1,000.00 in your account ending 5678. New balance: PKR 15,000.00"
        val fields = SmsParser.parse(text)
        assertEquals(1000.0, fields.amount!!, 0.001)
        assertEquals(true, fields.isDeposit)
    }

    @Test
    fun `handles a QAR-currency credit alert`() {
        val text = "QAR 250.500 credited to your account. Available balance QAR 4,200.75"
        val fields = SmsParser.parse(text)
        assertEquals(250.50, fields.amount!!, 0.01)
        assertEquals(true, fields.isDeposit)
    }

    @Test
    fun `leaves direction null when the message is ambiguous`() {
        val text = "A transaction of Rs.500 occurred on your account."
        val fields = SmsParser.parse(text)
        assertEquals(500.0, fields.amount!!, 0.001)
        assertNull(fields.isDeposit)
    }

    @Test
    fun `leaves amount null when no currency token is present`() {
        val text = "Your OTP is 123456. Do not share it with anyone."
        val fields = SmsParser.parse(text)
        assertNull(fields.amount)
    }

    @Test
    fun `extracts a merchant hint after a purchase alert`() {
        val text = "Rs.850.00 spent at KFC Karachi on your debit card."
        val fields = SmsParser.parse(text)
        assertEquals(false, fields.isDeposit)
        assertEquals("KFC Karachi", fields.descriptionHint)
    }

    @Test
    fun `matches a known account by sms sender id, case-insensitively`() {
        val accounts = listOf(
            KnownSmsAccount(accountId = "acc1", accountName = "UBL Current", currencyCode = "PKR", smsSenderId = "UBLPK"),
        )
        val match = SmsParser.matchAccount("UBLPK", "Rs.500 debited...", accounts)
        assertEquals("acc1", match?.accountId)
    }

    @Test
    fun `matches a known account by sender phone number ignoring formatting`() {
        val accounts = listOf(
            KnownSmsAccount(accountId = "acc2", accountName = "Zindigi", currencyCode = "PKR", smsSenderNumber = "+92 300 1234567"),
        )
        val match = SmsParser.matchAccount("+923001234567", "PKR 250 credited", accounts)
        assertEquals("acc2", match?.accountId)
    }

    @Test
    fun `returns null when no configured account matches`() {
        val accounts = listOf(
            KnownSmsAccount(accountId = "acc1", accountName = "UBL Current", currencyCode = "PKR", smsSenderId = "UBLPK"),
        )
        val match = SmsParser.matchAccount("RANDOM", "Rs.500 debited...", accounts)
        assertNull(match)
    }

    @Test
    fun `a blank sender number on a known account never matches everything`() {
        // Regression: an empty smsSenderNumber must not normalize to an empty digit string
        // that could trivially "match" via a naive contains() check.
        val accounts = listOf(
            KnownSmsAccount(accountId = "acc1", accountName = "No SMS configured", currencyCode = "PKR"),
        )
        val match = SmsParser.matchAccount("Anything", "Rs.500 debited from your account", accounts)
        assertNull(match)
    }
}
