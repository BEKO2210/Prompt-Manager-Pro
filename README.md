# Prompt Master Pro

**Offline-first Prompt-Bibliothek mit Versionierung, Tags und Cloud-Sync**

Eine moderne Single-Page-App zur Verwaltung deiner AI-Prompts – komplett offline-fähig, mit optionalem Cloud-Backup.

## ✨ Features

- **📝 Prompt-Verwaltung**: CRUD für Prompts mit Titel, Beschreibung, Tags und mehrzeiligem Inhalt
- **🔄 Versionierung**: Erstelle, verwalte und vergleiche Prompt-Versionen – mit Rollback-Funktion
- **🏷️ Tags & Sammlungen**: Organisiere Prompts mit Tags, erstelle virtuelle Sammlungen via `collection:name`
- **🔍 Suche & Filter**: Volltextsuche über Titel, Beschreibung und Inhalt – mit Tag-Filter und Smart-Filtern
- **📤 Import/Export**: JSON-Export/Import mit Merge-Strategie
- **☁️ Cloud-Sync**:
  - **Google Drive**: Clientseitiges Backup im AppData-Ordner (keine Server!)
  - **Firebase**: Optional für Echtzeit-Sync (Firestore + Auth)
- **🔒 Verschlüsselung**: Optionale lokale AES-GCM Verschlüsselung mit Passphrase
- **📱 PWA**: Installierbar, offline-fähig, Service Worker
- **🎨 Dark Mode**: Umschaltbares Theme
- **⌨️ Hotkeys**: `/` für Suche, `Ctrl/Cmd+N` für neuen Prompt, `Ctrl/Cmd+S` zum Speichern

## 🚀 Quick Start

### Lokal testen

1. Repository klonen:
   ```bash
   git clone https://github.com/BEKO2210/Prompt-Manager-Pro.git
   cd Prompt-Manager-Pro
   ```

2. Lokalen Server starten (z.B. mit Python):
   ```bash
   python3 -m http.server 8000
   ```

3. Im Browser öffnen: `http://localhost:8000`

### GitHub Pages Deployment

1. Repository auf GitHub pushen
2. In Settings → Pages → Source: `main` Branch, `/` (root) auswählen
3. App ist verfügbar unter: `https://BEKO2210.github.io/Prompt-Manager-Pro/`

## ⚙️ Setup

### Google Drive Backup (optional)

1. **Google Cloud Console** öffnen: https://console.cloud.google.com/
2. Neues Projekt erstellen oder bestehendes auswählen
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth Client ID**
4. Application Type: **Web application**
5. **Authorized JavaScript origins** hinzufügen:
   - `http://localhost:8000` (für lokale Entwicklung)
   - `https://BEKO2210.github.io` (für GitHub Pages)
6. **Client ID** kopieren und in der App unter **Einstellungen** → **Google Drive** einfügen
7. Scope: `https://www.googleapis.com/auth/drive.appdata` (wird automatisch verwendet)

### Firebase Sync (optional)

1. **Firebase Console** öffnen: https://console.firebase.google.com/
2. Neues Projekt erstellen
3. **Web-App hinzufügen** (</> Icon)
4. Firebase SDK Config kopieren (apiKey, authDomain, projectId, appId)
5. In der App unter **Einstellungen** → **Firebase** einfügen
6. **Authentication** → **Sign-in method** → **Google** aktivieren
7. **Firestore Database** erstellen (Produktionsmodus)
8. Firestore Rules anpassen:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

## 📁 Projektstruktur

```
/
├── index.html              # Haupt-HTML
├── manifest.webmanifest    # PWA Manifest
├── sw.js                   # Service Worker
├── css/
│   └── styles.css          # Styling (Dark/Light Theme)
├── js/
│   ├── main.js             # App Bootstrap, Router, Hotkeys
│   ├── db.js               # Dexie (IndexedDB) CRUD
│   ├── models.js           # Modelle, Validierung, Formatierung
│   ├── state.js            # State Management, EventBus
│   ├── search.js           # Volltext-Suche, Filter, Sortierung
│   ├── crypto.js           # WebCrypto (AES-GCM, PBKDF2)
│   ├── pwa.js              # Service Worker Registrierung
│   ├── ui/
│   │   ├── layout.js       # Toast, Modal, Loading, Theme
│   │   ├── list.js         # Prompt-Liste (Cards)
│   │   ├── editor.js       # Prompt-Editor
│   │   ├── diff.js         # Versions-Diff
│   │   ├── filters.js      # Tag-Filter, Smart-Filter
│   │   └── settings.js     # Einstellungen
│   └── adapters/
│       ├── local.js        # LocalAdapter (IndexedDB)
│       ├── drive.js        # Google Drive Adapter
│       └── firebase.js     # Firebase Adapter (lazy loaded)
├── lib/
│   └── dexie.min.js        # Dexie (lokal, kein CDN)
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── maskable-512.png
```

## 🛠️ Technologie-Stack

- **Frontend**: Vanilla JavaScript (ESM), HTML5, CSS3
- **Storage**: IndexedDB via [Dexie](https://dexie.org/)
- **PWA**: Service Worker, Web App Manifest
- **Cloud**:
  - Google Identity Services (OAuth 2.0)
  - Firebase SDK (lazy loaded)
- **Crypto**: WebCrypto API (AES-GCM, PBKDF2)
- **Kein Build-Zwang**: Läuft direkt im Browser

## 📋 Verwendung

### Prompt erstellen

1. Klicke auf **"+ Neuer Prompt"**
2. Titel, Beschreibung und Tags eingeben
3. Prompt-Inhalt verfassen
4. **Speichern** klicken

### Versionen verwalten

1. Prompt öffnen
2. **"Neue Version"** klicken bei Änderungen
3. Im **"Versionen"**-Tab alle Versionen ansehen
4. **Diff** anzeigen oder **Rollback** durchführen

### Tags & Sammlungen

- Tags: Kommagetrennt eingeben (z.B. `ai, copy, seo`)
- Sammlungen: `collection:marketing` erstellt virtuelle Ordner

### Import/Export

- **Export**: Top-Bar → Export-Icon → JSON-Datei herunterladen
- **Import**: Top-Bar → Import-Icon → JSON-Datei auswählen
  - Bei Duplikaten: Merge-Strategie (neue Version wird erstellt)

### Cloud-Backup

- **Google Drive**: Einstellungen → Google Drive → Anmelden → "Jetzt sichern"
- **Auto-Sync**: Optional alle X Minuten
- **Wiederherstellung**: "Wiederherstellen"-Button

## 🔐 Sicherheit & Privacy

- **Lokale Verschlüsselung**: Optional AES-GCM mit PBKDF2-abgeleitetem Schlüssel
- **Passphrase**: Wird nie gespeichert, nur im RAM
- **Google Drive**: Backup nur im privaten AppData-Ordner (nicht im regulären Drive sichtbar)
- **Firebase**: User-spezifische Firestore-Regeln (nur eigene Daten lesbar)

## 📜 Lizenz

MIT License - siehe [LICENSE](LICENSE)

## 🤝 Beitragen

Pull Requests willkommen! Für größere Änderungen bitte zuerst ein Issue öffnen.

## 🐛 Bekannte Einschränkungen

- Icons sind Platzhalter (siehe `icons/README.md`)
- Diff-Algorithmus ist einfach (line-based, kein Myers)
- Firebase Import: Batching für große Datenmengen fehlt

## 📞 Support

Issues: https://github.com/BEKO2210/Prompt-Manager-Pro/issues

---

**Gebaut mit ❤️ und modernem Web-Tech**