# ⏰ Quando Serviranno i File Mobile

## 🎯 Situazione Attuale

**Sviluppo principale**: Web App (HTML/JS)  
**File mobile**: Salvati ma **NON necessari ora**

## ✅ Cosa Fare Ora

**NON fare nulla** con i file mobile. Sono salvati e pronti per quando serviranno.

## 🚀 Quando Serviranno

### Scenario 1: Sviluppo App Flutter

Quando creerai l'app Flutter:

1. **Crea progetto Flutter**
   ```bash
   flutter create gfv_mobile
   cd gfv_mobile
   ```

2. **Copia file Android**
   ```bash
   cp ../mobile-config/google-services.json android/app/
   ```

3. **Copia file iOS** (quando disponibile)
   ```bash
   cp ../mobile-config/GoogleService-Info.plist ios/Runner/
   ```

4. **Configura Gradle** (vedi `ISTRUZIONI_ANDROID.md`)

5. **Configura FlutterFire**
   ```bash
   flutterfire configure
   ```

### Scenario 2: Solo App Android Nativa

Se creerai un'app Android nativa (Java/Kotlin):

1. Crea progetto Android Studio
2. Copia `google-services.json` in `app/`
3. Segui istruzioni Gradle in `ISTRUZIONI_ANDROID.md`

## 📋 Checklist "Da Fare Dopo"

Quando inizierai lo sviluppo mobile:

- [ ] Crea progetto Flutter/Android
- [ ] Copia `google-services.json` nella cartella corretta
- [ ] Copia `GoogleService-Info.plist` (iOS) nella cartella corretta
- [ ] Configura Gradle seguendo `ISTRUZIONI_ANDROID.md`
- [ ] Testa connessione Firebase

## ⚠️ Per Ora

- ✅ File salvati e protetti
- ✅ Configurazione Firebase pronta
- ❌ **NON** serve fare nulla ora
- ❌ **NON** creare progetto mobile ancora
- ❌ **NON** configurare Gradle ancora

---

**Conclusione**: I file sono pronti. Li userai quando svilupperai l'app mobile. Per ora, concentrati sulla web app! 🚀



