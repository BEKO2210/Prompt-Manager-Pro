/**
 * Local Adapter
 * Default storage adapter using IndexedDB (via Dexie)
 */

import * as db from '../db.js';

class LocalAdapter {
    constructor() {
        this.name = 'local';
        this.displayName = 'Lokal (IndexedDB)';
        this.ready = true;
    }

    /**
     * Initialize adapter
     * @returns {Promise<void>}
     */
    async init() {
        // Nothing to initialize for local storage
        this.ready = true;
    }

    /**
     * Check if adapter is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return true; // Local storage doesn't require auth
    }

    /**
     * Create a prompt
     * @param {Object} promptData - Prompt data
     * @returns {Promise<string>} - Prompt ID
     */
    async createPrompt(promptData) {
        return await db.createPrompt(promptData);
    }

    /**
     * Get a prompt by ID
     * @param {string} id - Prompt ID
     * @returns {Promise<Object|null>}
     */
    async getPrompt(id) {
        return await db.getPrompt(id);
    }

    /**
     * Get all prompts
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async getAllPrompts(options) {
        return await db.getAllPrompts(options);
    }

    /**
     * Update a prompt
     * @param {string} id - Prompt ID
     * @param {Object} updates - Updates
     * @returns {Promise<void>}
     */
    async updatePrompt(id, updates) {
        return await db.updatePrompt(id, updates);
    }

    /**
     * Delete a prompt
     * @param {string} id - Prompt ID
     * @param {boolean} hard - Hard delete
     * @returns {Promise<void>}
     */
    async deletePrompt(id, hard) {
        return await db.deletePrompt(id, hard);
    }

    /**
     * Create a version
     * @param {string} promptId - Prompt ID
     * @param {string} content - Content
     * @param {string} notes - Notes
     * @returns {Promise<string>} - Version ID
     */
    async createVersion(promptId, content, notes) {
        return await db.createVersion(promptId, content, notes);
    }

    /**
     * Get versions by prompt
     * @param {string} promptId - Prompt ID
     * @returns {Promise<Array>}
     */
    async getVersionsByPrompt(promptId) {
        return await db.getVersionsByPrompt(promptId);
    }

    /**
     * Get latest version
     * @param {string} promptId - Prompt ID
     * @returns {Promise<Object|null>}
     */
    async getLatestVersion(promptId) {
        return await db.getLatestVersion(promptId);
    }

    /**
     * Rollback to version
     * @param {string} versionId - Version ID
     * @returns {Promise<string>} - New version ID
     */
    async rollbackToVersion(versionId) {
        return await db.rollbackToVersion(versionId);
    }

    /**
     * Export data
     * @returns {Promise<Object>}
     */
    async exportData() {
        return await db.exportData();
    }

    /**
     * Import data
     * @param {Object} data - Import data
     * @param {boolean} merge - Merge mode
     * @returns {Promise<Object>}
     */
    async importData(data, merge) {
        return await db.importData(data, merge);
    }

    /**
     * Backup (for local adapter, this just exports)
     * @returns {Promise<Object>}
     */
    async backup() {
        return await this.exportData();
    }

    /**
     * Restore (for local adapter, this just imports)
     * @param {Object} data - Backup data
     * @returns {Promise<Object>}
     */
    async restore(data) {
        return await this.importData(data, true);
    }

    /**
     * Sync (no-op for local adapter)
     * @returns {Promise<void>}
     */
    async sync() {
        // Local adapter doesn't sync
        return;
    }

    /**
     * Get sync status
     * @returns {Object}
     */
    getSyncStatus() {
        return {
            enabled: false,
            lastSync: null,
            inProgress: false
        };
    }
}

export default new LocalAdapter();
