/**
 * Firebase Adapter
 * Optional cloud sync using Firebase (Firestore + Auth)
 * Loaded lazily when enabled
 */

import { showToast } from '../state.js';

class FirebaseAdapter {
    constructor() {
        this.name = 'firebase';
        this.displayName = 'Firebase Cloud Sync';
        this.app = null;
        this.auth = null;
        this.db = null;
        this.user = null;
        this.ready = false;
        this.listeners = [];
    }

    /**
     * Initialize Firebase
     * @param {Object} config - Firebase config
     * @returns {Promise<void>}
     */
    async init(config) {
        if (!config || !config.apiKey || !config.projectId) {
            throw new Error('Invalid Firebase configuration');
        }

        try {
            // Dynamically import Firebase SDK
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } =
                await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, onSnapshot } =
                await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Store Firebase modules
            this.FirebaseModules = {
                getAuth,
                GoogleAuthProvider,
                signInWithPopup,
                onAuthStateChanged,
                signOut,
                getFirestore,
                collection,
                doc,
                setDoc,
                getDoc,
                getDocs,
                deleteDoc,
                query,
                where,
                onSnapshot
            };

            // Initialize app
            this.app = initializeApp(config);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);

            // Listen to auth state
            onAuthStateChanged(this.auth, (user) => {
                this.user = user;
                this.ready = !!user;

                if (user) {
                    console.log('Firebase user signed in:', user.email);
                    showToast('Mit Firebase verbunden', 'success');
                } else {
                    console.log('Firebase user signed out');
                    this.stopListening();
                }
            });

        } catch (error) {
            console.error('Firebase initialization failed:', error);
            throw new Error('Failed to initialize Firebase');
        }
    }

    /**
     * Sign in with Google
     * @returns {Promise<void>}
     */
    async signIn() {
        if (!this.auth) {
            throw new Error('Firebase not initialized');
        }

        const { GoogleAuthProvider, signInWithPopup } = this.FirebaseModules;
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(this.auth, provider);
            this.user = result.user;
            this.ready = true;
            return result.user;
        } catch (error) {
            console.error('Firebase sign-in failed:', error);
            showToast('Firebase Anmeldung fehlgeschlagen', 'error');
            throw error;
        }
    }

    /**
     * Sign out
     * @returns {Promise<void>}
     */
    async signOut() {
        if (this.auth) {
            const { signOut } = this.FirebaseModules;
            await signOut(this.auth);
            this.user = null;
            this.ready = false;
            this.stopListening();
            showToast('Von Firebase abgemeldet', 'info');
        }
    }

    /**
     * Check if authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.ready && this.user !== null;
    }

    /**
     * Get user collection path
     * @returns {string}
     */
    getUserPath() {
        if (!this.user) {
            throw new Error('Not authenticated');
        }
        return `users/${this.user.uid}`;
    }

    /**
     * Create prompt
     * @param {Object} promptData - Prompt data
     * @returns {Promise<string>}
     */
    async createPrompt(promptData) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const { collection, doc, setDoc } = this.FirebaseModules;
        const id = crypto.randomUUID();
        const now = Date.now();

        const prompt = {
            id,
            title: promptData.title || 'Untitled Prompt',
            description: promptData.description || '',
            tags: promptData.tags || [],
            createdAt: now,
            updatedAt: now,
            archived: false
        };

        await setDoc(doc(this.db, `${this.getUserPath()}/prompts/${id}`), prompt);

        // Create initial version if content provided
        if (promptData.content) {
            await this.createVersion(id, promptData.content, promptData.notes);
        }

        return id;
    }

    /**
     * Get prompt
     * @param {string} id - Prompt ID
     * @returns {Promise<Object|null>}
     */
    async getPrompt(id) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const { doc, getDoc } = this.FirebaseModules;
        const docSnap = await getDoc(doc(this.db, `${this.getUserPath()}/prompts/${id}`));

        return docSnap.exists() ? docSnap.data() : null;
    }

    /**
     * Get all prompts
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async getAllPrompts(options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const { collection, getDocs } = this.FirebaseModules;
        const snapshot = await getDocs(collection(this.db, `${this.getUserPath()}/prompts`));

        let prompts = snapshot.docs.map(doc => doc.data());

        // Apply filters
        if (options.archived === false) {
            prompts = prompts.filter(p => !p.archived);
        } else if (options.archived === true) {
            prompts = prompts.filter(p => p.archived);
        }

        // Sort
        if (options.sortBy === 'title') {
            prompts.sort((a, b) => a.title.localeCompare(b.title));
        } else if (options.sortBy === 'createdAt') {
            prompts.sort((a, b) => b.createdAt - a.createdAt);
        } else {
            prompts.sort((a, b) => b.updatedAt - a.updatedAt);
        }

        return prompts;
    }

    /**
     * Update prompt
     * @param {string} id - Prompt ID
     * @param {Object} updates - Updates
     * @returns {Promise<void>}
     */
    async updatePrompt(id, updates) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const { doc, setDoc, getDoc } = this.FirebaseModules;
        const docRef = doc(this.db, `${this.getUserPath()}/prompts/${id}`);
        const existing = await getDoc(docRef);

        if (!existing.exists()) {
            throw new Error('Prompt not found');
        }

        const updated = {
            ...existing.data(),
            ...updates,
            updatedAt: Date.now()
        };

        await setDoc(docRef, updated);
    }

    /**
     * Delete prompt
     * @param {string} id - Prompt ID
     * @param {boolean} hard - Hard delete
     * @returns {Promise<void>}
     */
    async deletePrompt(id, hard = false) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const { doc, deleteDoc, collection, getDocs } = this.FirebaseModules;

        if (hard) {
            // Delete all versions
            const versionsSnapshot = await getDocs(collection(this.db, `${this.getUserPath()}/versions`));
            const deletePromises = versionsSnapshot.docs
                .filter(d => d.data().promptId === id)
                .map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);

            // Delete prompt
            await deleteDoc(doc(this.db, `${this.getUserPath()}/prompts/${id}`));
        } else {
            // Soft delete
            await this.updatePrompt(id, { archived: true });
        }
    }

    /**
     * Create version
     * @param {string} promptId - Prompt ID
     * @param {string} content - Content
     * @param {string} notes - Notes
     * @returns {Promise<string>}
     */
    async createVersion(promptId, content, notes = '') {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const { collection, doc, setDoc, getDocs } = this.FirebaseModules;
        const id = crypto.randomUUID();
        const now = Date.now();

        // Get existing versions count
        const versionsSnapshot = await getDocs(collection(this.db, `${this.getUserPath()}/versions`));
        const existingVersions = versionsSnapshot.docs
            .map(d => d.data())
            .filter(v => v.promptId === promptId);

        const versionNumber = existingVersions.length + 1;

        const version = {
            id,
            promptId,
            version: `v${versionNumber}`,
            content: content || '',
            notes: notes || '',
            createdAt: now,
            updatedAt: now
        };

        await setDoc(doc(this.db, `${this.getUserPath()}/versions/${id}`), version);

        // Update prompt's updatedAt
        await this.updatePrompt(promptId, {});

        return id;
    }

    /**
     * Get versions by prompt
     * @param {string} promptId - Prompt ID
     * @returns {Promise<Array>}
     */
    async getVersionsByPrompt(promptId) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const { collection, getDocs } = this.FirebaseModules;
        const snapshot = await getDocs(collection(this.db, `${this.getUserPath()}/versions`));

        const versions = snapshot.docs
            .map(doc => doc.data())
            .filter(v => v.promptId === promptId)
            .sort((a, b) => b.createdAt - a.createdAt);

        return versions;
    }

    /**
     * Get latest version
     * @param {string} promptId - Prompt ID
     * @returns {Promise<Object|null>}
     */
    async getLatestVersion(promptId) {
        const versions = await this.getVersionsByPrompt(promptId);
        return versions.length > 0 ? versions[0] : null;
    }

    /**
     * Rollback to version
     * @param {string} versionId - Version ID
     * @returns {Promise<string>}
     */
    async rollbackToVersion(versionId) {
        const { doc, getDoc } = this.FirebaseModules;
        const versionDoc = await getDoc(doc(this.db, `${this.getUserPath()}/versions/${versionId}`));

        if (!versionDoc.exists()) {
            throw new Error('Version not found');
        }

        const oldVersion = versionDoc.data();
        return await this.createVersion(
            oldVersion.promptId,
            oldVersion.content,
            `Rollback to ${oldVersion.version}`
        );
    }

    /**
     * Export data
     * @returns {Promise<Object>}
     */
    async exportData() {
        const prompts = await this.getAllPrompts();
        const { collection, getDocs } = this.FirebaseModules;
        const versionsSnapshot = await getDocs(collection(this.db, `${this.getUserPath()}/versions`));
        const versions = versionsSnapshot.docs.map(d => d.data());

        return {
            version: 1,
            exportedAt: Date.now(),
            prompts,
            versions
        };
    }

    /**
     * Import data
     * @param {Object} data - Import data
     * @param {boolean} merge - Merge mode
     * @returns {Promise<Object>}
     */
    async importData(data, merge = true) {
        if (!data.prompts || !data.versions) {
            throw new Error('Invalid import data');
        }

        const { doc, setDoc, getDoc } = this.FirebaseModules;
        let imported = 0;
        let skipped = 0;
        let merged = 0;

        for (const prompt of data.prompts) {
            const docRef = doc(this.db, `${this.getUserPath()}/prompts/${prompt.id}`);
            const existing = await getDoc(docRef);

            if (existing.exists() && !merge) {
                skipped++;
                continue;
            }

            if (existing.exists() && merge) {
                // Merge versions
                for (const version of data.versions.filter(v => v.promptId === prompt.id)) {
                    const versionRef = doc(this.db, `${this.getUserPath()}/versions/${version.id}`);
                    await setDoc(versionRef, version);
                    merged++;
                }

                await setDoc(docRef, { ...prompt, updatedAt: Date.now() });
            } else {
                // New prompt
                await setDoc(docRef, prompt);

                for (const version of data.versions.filter(v => v.promptId === prompt.id)) {
                    const versionRef = doc(this.db, `${this.getUserPath()}/versions/${version.id}`);
                    await setDoc(versionRef, version);
                }

                imported++;
            }
        }

        return { imported, skipped, merged };
    }

    /**
     * Listen to remote changes
     * @param {Function} callback - Callback for changes
     */
    observeRemoteChanges(callback) {
        if (!this.isAuthenticated()) {
            return;
        }

        const { collection, onSnapshot } = this.FirebaseModules;

        const unsubscribePrompts = onSnapshot(
            collection(this.db, `${this.getUserPath()}/prompts`),
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    callback({
                        type: 'prompt',
                        changeType: change.type,
                        data: change.doc.data()
                    });
                });
            }
        );

        const unsubscribeVersions = onSnapshot(
            collection(this.db, `${this.getUserPath()}/versions`),
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    callback({
                        type: 'version',
                        changeType: change.type,
                        data: change.doc.data()
                    });
                });
            }
        );

        this.listeners.push(unsubscribePrompts, unsubscribeVersions);
    }

    /**
     * Stop listening to changes
     */
    stopListening() {
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners = [];
    }

    /**
     * Get sync status
     * @returns {Object}
     */
    getSyncStatus() {
        return {
            enabled: this.isAuthenticated(),
            lastSync: null,
            inProgress: false
        };
    }
}

export default new FirebaseAdapter();
