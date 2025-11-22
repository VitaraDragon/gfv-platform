# 📱 Istruzioni Configurazione Android - Firebase

Queste istruzioni serviranno quando svilupperai l'app Android/Flutter.

## ⚠️ IMPORTANTE

**Non serve fare nulla ora!** Queste istruzioni sono per quando creerai il progetto Flutter/Android.

---

## 🔧 Configurazione Gradle (Kotlin DSL)

### 1. File a livello di progetto (`build.gradle.kts`)

Aggiungi il plugin Google services:

```kotlin
plugins {
    // ...
    // Add the dependency for the Google services Gradle plugin
    id("com.google.gms.google-services") version "4.4.4" apply false
}
```

### 2. File a livello di app (`<app-module>/build.gradle.kts`)

Aggiungi il plugin e le dipendenze Firebase:

```kotlin
plugins {
    id("com.android.application")
    // Add the Google services Gradle plugin
    id("com.google.gms.google-services")
}

dependencies {
    // Import the Firebase BoM
    implementation(platform("com.google.firebase:firebase-bom:34.5.0"))

    // TODO: Add the dependencies for Firebase products you want to use
    // When using the BoM, don't specify versions in Firebase dependencies
    // https://firebase.google.com/docs/android/setup#available-libraries
}
```

### 3. Copia file di configurazione

Copia `mobile-config/google-services.json` in:
```
android/app/google-services.json
```

---

## 📝 Quando Servirà

Queste istruzioni serviranno quando:
- Creerai il progetto Flutter
- Configurerai la parte Android dell'app
- Aggiungerai Firebase all'app mobile

---

## 🔗 Riferimenti

- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)
- [FlutterFire Documentation](https://firebase.flutter.dev/)

---

**Nota**: Per ora, concentrati sulla web app. Queste istruzioni le userai in futuro quando svilupperai l'app mobile.





