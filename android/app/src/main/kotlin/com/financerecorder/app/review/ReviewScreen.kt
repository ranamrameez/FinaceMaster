package com.financerecorder.app.review

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.financerecorder.app.ApproveOutcome
import com.financerecorder.app.R
import com.financerecorder.app.sms.KnownSmsAccount
import com.financerecorder.app.sms.ParsedTransaction
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ReviewScreen(
    pendingTransactions: List<ParsedTransaction>,
    knownAccounts: List<KnownSmsAccount>,
    approveOutcome: ApproveOutcome?,
    onConsumeOutcome: () -> Unit,
    onApprove: (ParsedTransaction) -> Unit,
    onDiscard: (String) -> Unit,
    onUpdate: (ParsedTransaction) -> Unit,
    modifier: Modifier = Modifier,
) {
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(approveOutcome) {
        val outcome = approveOutcome ?: return@LaunchedEffect
        val message = when (outcome) {
            is ApproveOutcome.Success -> "Transaction saved"
            is ApproveOutcome.Failure -> outcome.message
        }
        snackbarHostState.showSnackbar(message)
        onConsumeOutcome()
    }

    Box(modifier = modifier.fillMaxSize()) {
        if (pendingTransactions.isEmpty()) {
            EmptyState(Modifier.fillMaxSize())
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(pendingTransactions, key = { it.id }) { draft ->
                    DraftCard(
                        draft = draft,
                        knownAccounts = knownAccounts,
                        onApprove = onApprove,
                        onDiscard = onDiscard,
                        onUpdate = onUpdate,
                    )
                }
            }
        }
        SnackbarHost(hostState = snackbarHostState, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Box(modifier = modifier.padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                stringResource(R.string.review_empty_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.review_empty_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private val timeFormat = SimpleDateFormat("d MMM, HH:mm", Locale.getDefault())

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DraftCard(
    draft: ParsedTransaction,
    knownAccounts: List<KnownSmsAccount>,
    onApprove: (ParsedTransaction) -> Unit,
    onDiscard: (String) -> Unit,
    onUpdate: (ParsedTransaction) -> Unit,
) {
    var editing by rememberSaveable(draft.id) { mutableStateOf(!isComplete(draft)) }
    val currentDraft by rememberUpdatedState(draft)

    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(16.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    draft.senderLabel.ifBlank { "Unknown sender" },
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    timeFormat.format(Date(draft.detectedAtEpochMillis)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                draft.rawText,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = if (editing) Int.MAX_VALUE else 2,
            )
            Spacer(Modifier.height(12.dp))

            if (editing) {
                EditFields(
                    draft = draft,
                    knownAccounts = knownAccounts,
                    onSave = { updated ->
                        onUpdate(updated)
                        editing = false
                    },
                    onCancel = { editing = false },
                )
            } else {
                SummaryFields(draft)
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = { onDiscard(draft.id) }) {
                        Icon(Icons.Filled.Close, contentDescription = null, modifier = Modifier.height(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.review_discard))
                    }
                    TextButton(onClick = { editing = true }) {
                        Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.height(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.review_edit))
                    }
                    TextButton(
                        onClick = { onApprove(currentDraft) },
                        enabled = isComplete(draft),
                    ) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.height(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.review_approve))
                    }
                }
            }
        }
    }
}

private fun isComplete(draft: ParsedTransaction): Boolean =
    draft.amount != null && draft.isDeposit != null && draft.matchedAccountId != null

@Composable
private fun SummaryFields(draft: ParsedTransaction) {
    val amountText = draft.amount?.let {
        val symbol = draft.matchedCurrencyCode.orEmpty()
        "$symbol %.2f".format(it).trim()
    } ?: "Amount not detected"
    val directionText = when (draft.isDeposit) {
        true -> stringResource(R.string.review_direction_deposit)
        false -> stringResource(R.string.review_direction_withdrawal)
        null -> "Direction not detected"
    }
    Text("$amountText · $directionText", style = MaterialTheme.typography.titleMedium)
    Text(draft.description, style = MaterialTheme.typography.bodyMedium)
    Text(
        draft.matchedAccountName ?: stringResource(R.string.review_account_unmatched),
        style = MaterialTheme.typography.bodySmall,
        color = if (draft.matchedAccountId == null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditFields(
    draft: ParsedTransaction,
    knownAccounts: List<KnownSmsAccount>,
    onSave: (ParsedTransaction) -> Unit,
    onCancel: () -> Unit,
) {
    var amountText by remember(draft.id) { mutableStateOf(draft.amount?.toString() ?: "") }
    var description by remember(draft.id) { mutableStateOf(draft.description) }
    var isDeposit by remember(draft.id) { mutableStateOf(draft.isDeposit) }
    var accountId by remember(draft.id) { mutableStateOf(draft.matchedAccountId) }
    var accountMenuExpanded by remember { mutableStateOf(false) }

    val selectedAccount = knownAccounts.firstOrNull { it.accountId == accountId }

    OutlinedTextField(
        value = amountText,
        onValueChange = { amountText = it },
        label = { Text(stringResource(R.string.review_amount_label)) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
    )
    Spacer(Modifier.height(8.dp))

    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
        SegmentedButton(
            selected = isDeposit == true,
            onClick = { isDeposit = true },
            shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
        ) { Text(stringResource(R.string.review_direction_deposit)) }
        SegmentedButton(
            selected = isDeposit == false,
            onClick = { isDeposit = false },
            shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
        ) { Text(stringResource(R.string.review_direction_withdrawal)) }
    }
    Spacer(Modifier.height(8.dp))

    OutlinedTextField(
        value = description,
        onValueChange = { description = it },
        label = { Text(stringResource(R.string.review_description_label)) },
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(8.dp))

    ExposedDropdownMenuBox(
        expanded = accountMenuExpanded,
        onExpandedChange = { accountMenuExpanded = it },
    ) {
        OutlinedTextField(
            value = selectedAccount?.accountName ?: "",
            onValueChange = {},
            readOnly = true,
            label = { Text(stringResource(R.string.review_account_label)) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = accountMenuExpanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = accountMenuExpanded, onDismissRequest = { accountMenuExpanded = false }) {
            knownAccounts.forEach { account ->
                DropdownMenuItem(
                    text = { Text("${account.accountName} (${account.currencyCode})") },
                    onClick = {
                        accountId = account.accountId
                        accountMenuExpanded = false
                    },
                )
            }
        }
    }
    Spacer(Modifier.height(12.dp))

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        TextButton(onClick = onCancel) { Text(stringResource(R.string.review_cancel)) }
        TextButton(
            onClick = {
                onSave(
                    draft.copy(
                        amount = amountText.toDoubleOrNull(),
                        isDeposit = isDeposit,
                        description = description,
                        matchedAccountId = accountId,
                        matchedAccountName = selectedAccount?.accountName,
                        matchedCurrencyCode = selectedAccount?.currencyCode,
                    )
                )
            },
        ) { Text(stringResource(R.string.review_save)) }
    }
}
