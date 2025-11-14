# 📱 Mobile Configuration Files

Questa cartella contiene i file di configurazione per le app mobile (Android e iOS).

## ⚠️ IMPORTANTE

**Questa cartella NON è tracciata da Git** (è nel `.gitignore`).

I file qui contenuti contengono chiavi API sensibili e non devono essere committati.

## 📁 File Contenuti

- `google-services.json` - Configurazione Android (Firebase)
- `GoogleService-Info.plist` - Configurazione iOS (Firebase) - Da aggiungere quando disponibile

## 🔒 Sicurezza

- ✅ Cartella esclusa da Git
- ✅ File non committati
- ✅ Chiavi API protette

## 📝 Quando Serviranno

Questi file saranno necessari quando svilupperai l'app Flutter:

- **Android**: Copia `google-services.json` in `android/app/`
- **iOS**: Copia `GoogleService-Info.plist` in `ios/Runner/`

## 🚀 Setup Flutter (Futuro)

Quando creerai l'app Flutter:

```bash
# Android
cp mobile-config/google-services.json android/app/

# iOS
cp mobile-config/GoogleService-Info.plist ios/Runner/
```

---

**Nota**: Questi file sono già configurati per il progetto Firebase `gfv-platform`.



