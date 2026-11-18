package br.com.adl.aion

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URL
import javax.net.ssl.HttpsURLConnection

internal data class Message(val role: String, val text: String)

internal class AionApi {
    suspend fun verifyOwner(token: String) {
        val response = request("/verificar-acesso", token)
        if (response.optString("acesso") != "proprietario") {
            throw IOException("O Aion não confirmou o acesso de proprietário.")
        }
    }

    suspend fun reply(token: String, messages: List<Message>): String {
        val history = JSONArray()
        messages.takeLast(17).forEach { message ->
            history.put(JSONObject().put("role", message.role).put("content", message.text.take(2000)))
        }
        val response = request("/api/conversa", token, JSONObject().put("mensagens", history))
        return response.optString("texto").takeIf { it.isNotBlank() }
            ?: throw IOException("O Aion não retornou uma resposta de texto.")
    }

    private suspend fun request(path: String, token: String, body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val connection =
                URL("https://ion-validacao.israelrodriguesnogueira.workers.dev$path")
                    .openConnection() as HttpsURLConnection
            try {
                connection.instanceFollowRedirects = false
                connection.connectTimeout = 12_000
                connection.readTimeout = 45_000
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("Authorization", "Bearer $token")
                if (body != null) {
                    connection.requestMethod = "POST"
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                }
                val status = connection.responseCode
                if (status == 401 || status == 403) throw OwnerAccessDenied()
                if (status !in 200..299) throw IOException("O Aion está indisponível no momento ($status).")
                val payload = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                JSONObject(payload)
            } finally {
                connection.disconnect()
            }
        }
}

internal class OwnerAccessDenied : IOException("Entre com a conta Google principal autorizada.")
