/**
 * Google Drive Adapter
 * Backup/Restore to Google Drive AppData folder using Google Identity Services
 * Client-side only, no server required
 */

import localAdapter from './local.js';
import { appState, showToast } from '../state.js';

class DriveAdapter {
    constructor() {
        this.name = 'drive';
        this.displayName = 'Google Drive';
        this.accessToken = null;
        this.tokenClient = null;
        this.ready = false;
        this.fileId = null;
        this.fileName = 'prompt-master-pro.backup.json';
    }

    /**
     * Initialize Google Identity Services
     * @param {string} clientId - Google OAuth Client ID
     * @returns {Promise<void>}
     */
    async init(clientId) {
        if (!clientId) {
            throw new Error('Google Client ID is required');
        }

        return new Promise((resolve, reject) => {
            // Load Google Identity Services
            if (!window.google) {
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    this.initializeTokenClient(clientId);
                    resolve();
                };
                script.onerror = () => {
                    reject(new Error('Failed to load Google Identity Services'));
                };
                document.head.appendChild(script);
            } else {
                this.initializeTokenClient(clientId);
                resolve();
            }
        });
    }

    /**
     * Initialize token client
     * @param {string} clientId - Google OAuth Client ID
     */
    initializeTokenClient(clientId) {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.appdata',
            callback: (response) => {
                if (response.error) {
                    console.error('Auth error:', response);
                    showToast('Google Drive Authentifizierung fehlgeschlagen', 'error');
                    return;
                }
                this.accessToken = response.access_token;
                this.ready = true;
                showToast('Mit Google Drive verbunden', 'success');
            }
        });
    }

    /**
     * Sign in with Google
     * @returns {Promise<void>}
     */
    async signIn() {
        if (!this.tokenClient) {
            throw new Error('Token client not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            const originalCallback = this.tokenClient.callback;

            this.tokenClient.callback = (response) => {
                originalCallback(response);
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve();
                }
            };

            this.tokenClient.requestAccessToken();
        });
    }

    /**
     * Sign out
     */
    signOut() {
        if (this.accessToken) {
            window.google.accounts.oauth2.revoke(this.accessToken, () => {
                console.log('Access token revoked');
            });
        }
        this.accessToken = null;
        this.ready = false;
        this.fileId = null;
        showToast('Von Google Drive getrennt', 'info');
    }

    /**
     * Check if authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.ready && this.accessToken !== null;
    }

    /**
     * Find backup file in AppData
     * @returns {Promise<string|null>} - File ID or null
     */
    async findBackupFile() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${this.fileName}'&fields=files(id,name,modifiedTime)`,
            {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Drive API error: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.files && data.files.length > 0) {
            this.fileId = data.files[0].id;
            return this.fileId;
        }

        return null;
    }

    /**
     * Backup to Google Drive
     * @param {boolean} encrypted - Whether to encrypt backup
     * @returns {Promise<void>}
     */
    async backup(encrypted = false) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please sign in first.');
        }

        // Get data from local adapter
        const data = await localAdapter.exportData();
        let backupData = JSON.stringify(data, null, 2);

        // Encrypt if requested
        if (encrypted) {
            const crypto = await import('../crypto.js');
            if (!appState.get('settings').encryption.enabled) {
                throw new Error('Encryption not configured');
            }
            backupData = await crypto.encryptData(backupData);
        }

        // Check if file exists
        const existingFileId = await this.findBackupFile();

        const metadata = {
            name: this.fileName,
            mimeType: 'application/json',
            parents: existingFileId ? undefined : ['appDataFolder']
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([backupData], { type: 'application/json' }));

        const url = existingFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const method = existingFileId ? 'PATCH' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${this.accessToken}`
            },
            body: form
        });

        if (!response.ok) {
            throw new Error(`Backup failed: ${response.statusText}`);
        }

        const result = await response.json();
        this.fileId = result.id;

        showToast('Backup erfolgreich in Google Drive gespeichert', 'success');
    }

    /**
     * Restore from Google Drive
     * @returns {Promise<Object>}
     */
    async restore() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please sign in first.');
        }

        const fileId = await this.findBackupFile();
        if (!fileId) {
            throw new Error('No backup file found in Google Drive');
        }

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Restore failed: ${response.statusText}`);
        }

        let backupData = await response.text();

        // Check if encrypted
        if (backupData.startsWith('{') && backupData.includes('"iv"')) {
            const crypto = await import('../crypto.js');
            backupData = await crypto.decryptData(backupData);
        }

        const data = JSON.parse(backupData);

        // Import to local storage
        const result = await localAdapter.importData(data, true);

        showToast(`Wiederherstellung erfolgreich: ${result.imported} neu, ${result.merged} aktualisiert`, 'success');

        return result;
    }

    /**
     * List all backups
     * @returns {Promise<Array>}
     */
    async listBackups() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(
            'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc',
            {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to list backups: ${response.statusText}`);
        }

        const data = await response.json();
        return data.files || [];
    }

    /**
     * Auto-sync (if enabled)
     * @returns {Promise<void>}
     */
    async autoSync() {
        const settings = appState.get('settings');

        if (!settings.drive.autoSync) {
            return;
        }

        if (!this.isAuthenticated()) {
            console.log('Auto-sync skipped: not authenticated');
            return;
        }

        try {
            await this.backup(settings.encryption.enabled);
            appState.setState({ lastSyncAt: Date.now() });
        } catch (error) {
            console.error('Auto-sync failed:', error);
        }
    }

    /**
     * Get sync status
     * @returns {Object}
     */
    getSyncStatus() {
        const settings = appState.get('settings');
        return {
            enabled: settings.drive.enabled && this.isAuthenticated(),
            lastSync: appState.get('lastSyncAt'),
            inProgress: false,
            autoSync: settings.drive.autoSync
        };
    }

    /**
     * Delegate other methods to local adapter
     * (Drive adapter only handles backup/restore, local storage is primary)
     */
    async createPrompt(data) { return await localAdapter.createPrompt(data); }
    async getPrompt(id) { return await localAdapter.getPrompt(id); }
    async getAllPrompts(options) { return await localAdapter.getAllPrompts(options); }
    async updatePrompt(id, updates) { return await localAdapter.updatePrompt(id, updates); }
    async deletePrompt(id, hard) { return await localAdapter.deletePrompt(id, hard); }
    async createVersion(promptId, content, notes) { return await localAdapter.createVersion(promptId, content, notes); }
    async getVersionsByPrompt(promptId) { return await localAdapter.getVersionsByPrompt(promptId); }
    async getLatestVersion(promptId) { return await localAdapter.getLatestVersion(promptId); }
    async rollbackToVersion(versionId) { return await localAdapter.rollbackToVersion(versionId); }
    async exportData() { return await localAdapter.exportData(); }
    async importData(data, merge) { return await localAdapter.importData(data, merge); }
}

export default new DriveAdapter();
