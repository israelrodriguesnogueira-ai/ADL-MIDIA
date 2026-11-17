# Aion Android

Primeira versão nativa para o Galaxy Note 20. Usa Kotlin e Jetpack Compose, com ícone próprio, entrada pelo Google e conversa com o Worker existente. A caixa de mensagem cresce acima do teclado e tem um botão para expandir ou recolher.

## Compilar para teste

Use JDK 17, Gradle 8.9 e Android SDK 35. No mesmo projeto do Google Cloud da credencial web do Aion, registre a credencial OAuth Android para o pacote `br.com.adl.aion` e a impressão digital do certificado usado para assinar o APK. Configure o Client ID OAuth web que o Worker já valida no arquivo pessoal `~/.gradle/gradle.properties`, na propriedade `AION_GOOGLE_CLIENT_ID`. O identificador é público, mas o projeto não contém credenciais nem chaves de assinatura.

A partir de `android-aion`, execute `gradle :app:assembleDebug :app:lintDebug`. O pacote fica em `app/build/outputs/apk/debug/app-debug.apk`. Sem o Client ID, a compilação permite testar a interface inicial, com aviso ao tentar entrar. O login real depende da configuração OAuth e do teste no Galaxy. Uma versão para Google Play exige configuração e assinatura de publicação.

## Escopo da primeira versão

O app verifica a conta proprietária em `/verificar-acesso` e envia texto para `/api/conversa`. As mensagens e o token ficam em memória durante a sessão. A aba Atividade, os avisos e a execução contínua ainda precisam da fila no servidor. O servidor deve atribuir um identificador persistente a cada tarefa e permitir consultar o estado após reabrir o app. Câmera, microfone e integração com o relógio ficam para os próximos incrementos.
