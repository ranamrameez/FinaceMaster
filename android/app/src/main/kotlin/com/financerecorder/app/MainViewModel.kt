package com.financerecorder.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.financerecorder.app.bridge.WebAppBridge
import com.financerecorder.app.sms.KnownSmsAccount
import com.financerecorder.app.sms.ParsedTransaction
import com.financerecorder.app.sms.PendingTransactionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface ApproveOutcome {
    data object Success : ApproveOutcome
    data class Failure(val message: String) : ApproveOutcome
}

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = PendingTransactionRepository.getInstance(application)

    val webAppBridge = WebAppBridge(repository, viewModelScope)

    /** Shared by the bottom-bar badge and the review list so both always agree — one
     *  collected copy of the repository flow, not two independent ones. */
    val pendingTransactions = repository.pendingTransactions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val knownAccounts = repository.knownAccounts
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList<KnownSmsAccount>())

    private val _lastApproveOutcome = MutableStateFlow<ApproveOutcome?>(null)
    val lastApproveOutcome = _lastApproveOutcome.asStateFlow()

    fun discard(id: String) {
        viewModelScope.launch { repository.remove(id) }
    }

    fun updateDraft(draft: ParsedTransaction) {
        viewModelScope.launch { repository.update(draft) }
    }

    fun approve(draft: ParsedTransaction) {
        viewModelScope.launch {
            val result = webAppBridge.createBankTransactionFromSms(draft)
            if (result.success) {
                repository.remove(draft.id)
                _lastApproveOutcome.value = ApproveOutcome.Success
            } else {
                _lastApproveOutcome.value = ApproveOutcome.Failure(result.message)
            }
        }
    }

    fun consumeApproveOutcome() {
        _lastApproveOutcome.value = null
    }
}
