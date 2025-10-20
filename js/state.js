/**
 * Application State Management & Event Bus
 * Simple reactive state management without external dependencies
 */

// ========================================
// Event Bus
// ========================================

class EventBus {
    constructor() {
        this.events = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.events.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (data) => {
            callback(data);
            unsubscribe();
        });
    }

    /**
     * Clear all listeners for an event
     * @param {string} event - Event name
     */
    off(event) {
        this.events.delete(event);
    }
}

export const eventBus = new EventBus();

// ========================================
// Application State
// ========================================

class AppState {
    constructor() {
        this.state = {
            // Current route
            route: 'home',
            routeParams: {},

            // UI state
            sidebarOpen: window.innerWidth >= 768,
            theme: localStorage.getItem('theme') || 'light',

            // Prompts
            prompts: [],
            currentPrompt: null,
            currentVersion: null,

            // Filters
            searchQuery: '',
            selectedTags: [],
            smartFilter: null,
            sortBy: 'updatedAt',

            // Sync state
            syncAdapter: localStorage.getItem('syncAdapter') || 'local',
            syncInProgress: false,
            lastSyncAt: null,

            // Settings
            settings: this.loadSettings()
        };

        this.subscribers = new Set();
    }

    /**
     * Load settings from localStorage
     * @returns {Object}
     */
    loadSettings() {
        const defaults = {
            encryption: {
                enabled: false,
                hasPassphrase: false
            },
            drive: {
                enabled: false,
                autoSync: false,
                syncInterval: 30 // minutes
            },
            firebase: {
                enabled: false,
                apiKey: '',
                authDomain: '',
                projectId: '',
                appId: ''
            },
            privacy: {
                bannerDismissed: false
            },
            onboarding: {
                completed: false,
                step: 0
            }
        };

        try {
            const saved = localStorage.getItem('settings');
            if (saved) {
                return { ...defaults, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }

        return defaults;
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('settings', JSON.stringify(this.state.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    /**
     * Get current state
     * @returns {Object}
     */
    getState() {
        return this.state;
    }

    /**
     * Get a specific state value
     * @param {string} key - State key
     * @returns {*}
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Update state
     * @param {Object} updates - State updates
     */
    setState(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        // Save settings if they changed
        if (updates.settings) {
            this.saveSettings();
        }

        // Save theme preference
        if (updates.theme) {
            localStorage.setItem('theme', updates.theme);
            document.documentElement.setAttribute('data-theme', updates.theme);
        }

        // Save sync adapter preference
        if (updates.syncAdapter) {
            localStorage.setItem('syncAdapter', updates.syncAdapter);
        }

        // Notify subscribers
        this.notifySubscribers(oldState, this.state);

        // Emit state change event
        eventBus.emit('stateChanged', { oldState, newState: this.state });
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.add(callback);

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Notify all subscribers
     * @param {Object} oldState - Previous state
     * @param {Object} newState - New state
     */
    notifySubscribers(oldState, newState) {
        this.subscribers.forEach(callback => {
            try {
                callback(newState, oldState);
            } catch (error) {
                console.error('Error in state subscriber:', error);
            }
        });
    }

    /**
     * Update settings
     * @param {Object} updates - Settings updates (deep merge)
     */
    updateSettings(updates) {
        const newSettings = this.deepMerge(this.state.settings, updates);
        this.setState({ settings: newSettings });
    }

    /**
     * Deep merge objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object}
     */
    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * Reset state to defaults
     */
    reset() {
        this.state = {
            route: 'home',
            routeParams: {},
            sidebarOpen: window.innerWidth >= 768,
            theme: 'light',
            prompts: [],
            currentPrompt: null,
            currentVersion: null,
            searchQuery: '',
            selectedTags: [],
            smartFilter: null,
            sortBy: 'updatedAt',
            syncAdapter: 'local',
            syncInProgress: false,
            lastSyncAt: null,
            settings: this.loadSettings()
        };

        this.notifySubscribers({}, this.state);
    }
}

export const appState = new AppState();

// ========================================
// Utility Functions
// ========================================

/**
 * Show toast notification
 * @param {string} message - Notification message
 * @param {string} type - Type (success, error, warning, info)
 * @param {number} duration - Duration in ms
 */
export function showToast(message, type = 'info', duration = 3000) {
    eventBus.emit('showToast', { message, type, duration });
}

/**
 * Show confirm dialog
 * @param {string} message - Confirmation message
 * @param {string} title - Dialog title
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, title = 'Bestätigen') {
    return new Promise((resolve) => {
        eventBus.emit('showConfirm', {
            title,
            message,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        });
    });
}

/**
 * Show loading indicator
 * @param {string} message - Loading message
 */
export function showLoading(message = 'Laden...') {
    eventBus.emit('showLoading', { message });
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
    eventBus.emit('hideLoading');
}

/**
 * Navigate to route
 * @param {string} route - Route name
 * @param {Object} params - Route parameters
 */
export function navigate(route, params = {}) {
    appState.setState({ route, routeParams: params });
    eventBus.emit('navigate', { route, params });
}

export default {
    eventBus,
    appState,
    showToast,
    showConfirm,
    showLoading,
    hideLoading,
    navigate
};
