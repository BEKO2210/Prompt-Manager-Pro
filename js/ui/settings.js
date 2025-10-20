/**
 * Settings Component
 * Encryption, Drive, Firebase settings
 */

import { appState, showToast } from '../state.js';
import * as crypto from '../crypto.js';
import driveAdapter from '../adapters/drive.js';
import { exportData } from '../db.js';
import { generateExportFilename } from '../models.js';

/**
 * Render settings view
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
    if (!container) {
        container = document.getElementById('app-view');
    }

    const settings = appState.get('settings');

    const html = `
        <div class="settings-container">
            <h2 style="margin-bottom: 2rem;">Einstellungen</h2>

            <!-- Encryption Section -->
            <div class="settings-section">
                <h3>🔒 Lokale Verschlüsselung</h3>
                <p style="color: var(--fg-secondary); font-size: 0.875rem; margin-bottom: 1rem;">
                    Verschlüssele deine Prompts lokal mit einem Passwort. Der Schlüssel wird nie gespeichert.
                </p>

                <div class="settings-toggle">
                    <input
                        type="checkbox"
                        id="encryption-enabled"
                        ${settings.encryption.enabled ? 'checked' : ''}
                    >
                    <label for="encryption-enabled">Verschlüsselung aktivieren</label>
                </div>

                <div id="encryption-config" style="display: ${settings.encryption.enabled ? 'block' : 'none'}; margin-top: 1rem;">
                    <div class="settings-field">
                        <label>Passwort</label>
                        <input type="password" id="encryption-passphrase" placeholder="Mindestens 8 Zeichen">
                    </div>
                    <button class="primary-button" id="set-passphrase">Passwort setzen</button>
                </div>
            </div>

            <!-- Google Drive Section -->
            <div class="settings-section">
                <h3>☁️ Google Drive Backup</h3>
                <p style="color: var(--fg-secondary); font-size: 0.875rem; margin-bottom: 1rem;">
                    Sichere deine Prompts automatisch in Google Drive AppData.
                </p>

                <div class="settings-field">
                    <label>Google Client ID</label>
                    <input
                        type="text"
                        id="drive-client-id"
                        placeholder="123456789-abc.apps.googleusercontent.com"
                        value="${settings.drive.clientId || ''}"
                    >
                    <small style="color: var(--fg-tertiary);">
                        Erstelle eine OAuth Client ID in der Google Cloud Console
                    </small>
                </div>

                <div style="margin-top: 1rem; display: flex; gap: 0.75rem;">
                    <button class="primary-button" id="drive-signin">Mit Google anmelden</button>
                    <button class="secondary-button" id="drive-signout">Abmelden</button>
                </div>

                <div style="margin-top: 1rem; display: flex; gap: 0.75rem;">
                    <button class="secondary-button" id="drive-backup">Jetzt sichern</button>
                    <button class="secondary-button" id="drive-restore">Wiederherstellen</button>
                </div>

                <div class="settings-toggle" style="margin-top: 1rem;">
                    <input
                        type="checkbox"
                        id="drive-autosync"
                        ${settings.drive.autoSync ? 'checked' : ''}
                    >
                    <label for="drive-autosync">Auto-Sync aktivieren</label>
                </div>

                ${settings.drive.autoSync ? `
                    <div class="settings-field" style="margin-top: 0.75rem;">
                        <label>Sync-Intervall (Minuten)</label>
                        <input
                            type="number"
                            id="drive-interval"
                            min="5"
                            max="1440"
                            value="${settings.drive.syncInterval || 30}"
                        >
                    </div>
                ` : ''}
            </div>

            <!-- Firebase Section -->
            <div class="settings-section">
                <h3>🔥 Firebase Cloud Sync (Optional)</h3>
                <p style="color: var(--fg-secondary); font-size: 0.875rem; margin-bottom: 1rem;">
                    Synchronisiere deine Prompts in Echtzeit über Firebase.
                </p>

                <div class="settings-toggle">
                    <input
                        type="checkbox"
                        id="firebase-enabled"
                        ${settings.firebase.enabled ? 'checked' : ''}
                    >
                    <label for="firebase-enabled">Firebase Sync aktivieren</label>
                </div>

                <div id="firebase-config" style="display: ${settings.firebase.enabled ? 'block' : 'none'}; margin-top: 1rem;">
                    <div class="settings-field">
                        <label>API Key</label>
                        <input type="text" id="firebase-apiKey" value="${settings.firebase.apiKey || ''}" placeholder="AIzaSy...">
                    </div>
                    <div class="settings-field">
                        <label>Auth Domain</label>
                        <input type="text" id="firebase-authDomain" value="${settings.firebase.authDomain || ''}" placeholder="your-app.firebaseapp.com">
                    </div>
                    <div class="settings-field">
                        <label>Project ID</label>
                        <input type="text" id="firebase-projectId" value="${settings.firebase.projectId || ''}" placeholder="your-project-id">
                    </div>
                    <div class="settings-field">
                        <label>App ID</label>
                        <input type="text" id="firebase-appId" value="${settings.firebase.appId || ''}" placeholder="1:123:web:abc">
                    </div>
                    <button class="primary-button" id="firebase-save">Firebase Config speichern</button>
                </div>
            </div>

            <!-- Export/Import Section -->
            <div class="settings-section">
                <h3>📦 Export & Import</h3>
                <p style="color: var(--fg-secondary); font-size: 0.875rem; margin-bottom: 1rem;">
                    Exportiere oder importiere deine Prompts als JSON-Datei.
                </p>

                <div style="display: flex; gap: 0.75rem;">
                    <button class="secondary-button" id="export-json">Als JSON exportieren</button>
                    <button class="secondary-button" id="import-json">JSON importieren</button>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    attachSettingsHandlers(container);
}

/**
 * Attach event handlers
 * @param {HTMLElement} container
 */
function attachSettingsHandlers(container) {
    // Encryption toggle
    const encryptionToggle = container.querySelector('#encryption-enabled');
    const encryptionConfig = container.querySelector('#encryption-config');

    encryptionToggle.addEventListener('change', () => {
        encryptionConfig.style.display = encryptionToggle.checked ? 'block' : 'none';
    });

    // Set passphrase
    const setPassphraseBtn = container.querySelector('#set-passphrase');
    setPassphraseBtn.addEventListener('click', async () => {
        const passphrase = container.querySelector('#encryption-passphrase').value;

        if (!passphrase || passphrase.length < 8) {
            showToast('Passwort muss mindestens 8 Zeichen haben', 'warning');
            return;
        }

        try {
            await crypto.initEncryption(passphrase);
            showToast('Verschlüsselung aktiviert', 'success');
        } catch (error) {
            console.error('Encryption init failed:', error);
            showToast('Fehler beim Aktivieren der Verschlüsselung', 'error');
        }
    });

    // Drive sign in
    const driveSignInBtn = container.querySelector('#drive-signin');
    driveSignInBtn.addEventListener('click', async () => {
        const clientId = container.querySelector('#drive-client-id').value;

        if (!clientId) {
            showToast('Bitte Google Client ID eingeben', 'warning');
            return;
        }

        try {
            await driveAdapter.init(clientId);
            await driveAdapter.signIn();

            // Save client ID
            appState.updateSettings({
                drive: { ...appState.get('settings').drive, clientId, enabled: true }
            });
        } catch (error) {
            console.error('Drive sign in failed:', error);
            showToast('Google Drive Anmeldung fehlgeschlagen', 'error');
        }
    });

    // Drive sign out
    const driveSignOutBtn = container.querySelector('#drive-signout');
    driveSignOutBtn.addEventListener('click', () => {
        driveAdapter.signOut();
    });

    // Drive backup
    const driveBackupBtn = container.querySelector('#drive-backup');
    driveBackupBtn.addEventListener('click', async () => {
        try {
            const encrypted = appState.get('settings').encryption.enabled;
            await driveAdapter.backup(encrypted);
        } catch (error) {
            console.error('Drive backup failed:', error);
            showToast('Backup fehlgeschlagen: ' + error.message, 'error');
        }
    });

    // Drive restore
    const driveRestoreBtn = container.querySelector('#drive-restore');
    driveRestoreBtn.addEventListener('click', async () => {
        try {
            await driveAdapter.restore();
        } catch (error) {
            console.error('Drive restore failed:', error);
            showToast('Wiederherstellung fehlgeschlagen: ' + error.message, 'error');
        }
    });

    // Drive auto-sync
    const driveAutoSyncToggle = container.querySelector('#drive-autosync');
    driveAutoSyncToggle.addEventListener('change', () => {
        appState.updateSettings({
            drive: { ...appState.get('settings').drive, autoSync: driveAutoSyncToggle.checked }
        });
        renderSettings(container);
    });

    // Firebase toggle
    const firebaseToggle = container.querySelector('#firebase-enabled');
    const firebaseConfig = container.querySelector('#firebase-config');

    firebaseToggle.addEventListener('change', () => {
        firebaseConfig.style.display = firebaseToggle.checked ? 'block' : 'none';
    });

    // Firebase save
    const firebaseSaveBtn = container.querySelector('#firebase-save');
    if (firebaseSaveBtn) {
        firebaseSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: true,
                apiKey: container.querySelector('#firebase-apiKey').value,
                authDomain: container.querySelector('#firebase-authDomain').value,
                projectId: container.querySelector('#firebase-projectId').value,
                appId: container.querySelector('#firebase-appId').value
            };

            appState.updateSettings({ firebase: config });
            showToast('Firebase Konfiguration gespeichert', 'success');
        });
    }

    // Export JSON
    const exportBtn = container.querySelector('#export-json');
    exportBtn.addEventListener('click', async () => {
        try {
            const data = await exportData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = generateExportFilename();
            a.click();
            URL.revokeObjectURL(url);
            showToast('Export erfolgreich', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showToast('Export fehlgeschlagen', 'error');
        }
    });

    // Import JSON
    const importBtn = container.querySelector('#import-json');
    importBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const { importData } = await import('../db.js');
                const result = await importData(data, true);
                showToast(`Import erfolgreich: ${result.imported} neu, ${result.merged} aktualisiert`, 'success');
            } catch (error) {
                console.error('Import failed:', error);
                showToast('Import fehlgeschlagen', 'error');
            }
        };
        input.click();
    });
}

export default {
    renderSettings
};
