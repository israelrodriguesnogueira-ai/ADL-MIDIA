package br.com.adl.aion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val model: AionViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                AionScreen(model) { model.signIn(this) }
            }
        }
    }
}

internal class AionViewModel : ViewModel() {
    private val api = AionApi()
    private var token: String? = null
    var authenticated by mutableStateOf(false)
        private set
    var busy by mutableStateOf(false)
        private set
    var feedback by mutableStateOf<String?>(null)
        private set
    var messages by mutableStateOf(emptyList<Message>())
        private set
    var draft by mutableStateOf("")

    fun signIn(activity: ComponentActivity) {
        if (busy) return
        val clientId = BuildConfig.GOOGLE_CLIENT_ID
        if (clientId.isEmpty()) {
            feedback = "Esta compilação ainda precisa da configuração de login do Aion."
            return
        }
        busy = true
        feedback = "Confirmando acesso do proprietário…"
        viewModelScope.launch {
            try {
                val option = GetSignInWithGoogleOption.Builder(clientId).build()
                val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                val result = CredentialManager.create(activity).getCredential(activity, request).credential
                if (result !is CustomCredential ||
                    result.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    feedback = "Escolha a conta Google principal."
                    return@launch
                }
                val identity = GoogleIdTokenCredential.createFrom(result.data)
                api.verifyOwner(identity.idToken)
                token = identity.idToken
                authenticated = true
                feedback = null
            } catch (error: CancellationException) {
                throw error
            } catch (_: GetCredentialCancellationException) {
                feedback = null
            } catch (_: OwnerAccessDenied) {
                feedback = "Entre com a conta Google principal autorizada."
            } catch (_: Exception) {
                feedback = "Não foi possível confirmar seu acesso. Confira a conexão e tente novamente."
            } finally {
                busy = false
            }
        }
    }

    fun send() {
        val identity = token ?: return
        val text = draft.trim()
        if (busy || text.isEmpty()) return
        val pending = messages + Message("user", text)
        busy = true
        feedback = "Aguardando resposta do Aion…"
        viewModelScope.launch {
            try {
                val response = api.reply(identity, pending)
                messages = pending + Message("assistant", response)
                if (draft.trim() == text) draft = ""
                feedback = null
            } catch (error: CancellationException) {
                throw error
            } catch (_: OwnerAccessDenied) {
                token = null
                authenticated = false
                feedback = "Sessão encerrada. Entre de novo com a conta principal."
            } catch (_: Exception) {
                feedback = "A resposta não chegou. Sua mensagem continua na caixa para tentar de novo."
            } finally {
                busy = false
            }
        }
    }

    fun signOut() {
        if (busy) return
        token = null
        authenticated = false
        messages = emptyList()
        draft = ""
        feedback = null
    }
}

@Composable
private fun AionScreen(model: AionViewModel, signIn: () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val conversation = rememberLazyListState()
    LaunchedEffect(model.messages.size) {
        if (model.messages.isNotEmpty()) conversation.scrollToItem(model.messages.lastIndex)
    }
    Scaffold(modifier = Modifier.imePadding()) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Aion", style = MaterialTheme.typography.headlineMedium)
                if (model.authenticated) {
                    TextButton(onClick = model::signOut, enabled = !model.busy) { Text("Sair") }
                }
            }
            if (model.authenticated) {
                LazyColumn(
                    state = conversation,
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(model.messages) { message ->
                        Column {
                            Text(if (message.role == "user") "Você" else "Aion",
                                style = MaterialTheme.typography.labelLarge)
                            Text(message.text, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
                model.feedback?.let { Text(it) }
                OutlinedTextField(
                    value = model.draft,
                    onValueChange = { if (it.length <= 2000) model.draft = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Mensagem para o Aion") },
                    minLines = if (expanded) 4 else 1,
                    maxLines = if (expanded) 9 else 4,
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(onClick = { expanded = !expanded }) {
                        Text(if (expanded) "Recolher" else "Expandir")
                    }
                    Button(onClick = model::send, enabled = !model.busy && model.draft.isNotBlank()) {
                        Text("Enviar")
                    }
                }
            } else {
                Button(onClick = signIn, enabled = !model.busy) { Text("Entrar com Google") }
                model.feedback?.let { Text(it) }
            }
        }
    }
}
