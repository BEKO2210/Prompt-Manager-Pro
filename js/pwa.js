/**
 * PWA Registration & Update Handling
 */

import { showToast } from './state.js';

let registration = null;
let updateAvailable = false;

/**
 * Register service worker
 * @returns {Promise<void>}
 */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return;
    }

    try {
        registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available
                    updateAvailable = true;
                    showUpdateNotification();
                }
            });
        });

        // Check for updates every hour
        setInterval(() => {
            registration.update();
        }, 60 * 60 * 1000);

    } catch (error) {
        console.error('Service Worker registration failed:', error);
    }
}

/**
 * Show update notification
 */
function showUpdateNotification() {
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <span>Neue Version verfügbar!</span>
            <button
                id="update-app-btn"
                class="primary-button"
                style="padding: 0.25rem 0.75rem; font-size: 0.875rem;"
            >
                Aktualisieren
            </button>
        </div>
    `;

    const toastContainer = document.getElementById('toast-container');
    toastContainer.appendChild(toast);

    // Handle update button
    const updateBtn = toast.querySelector('#update-app-btn');
    updateBtn.addEventListener('click', () => {
        updateApp();
        toast.remove();
    });
}

/**
 * Update app (activate new service worker)
 */
function updateApp() {
    if (!registration || !registration.waiting) {
        window.location.reload();
        return;
    }

    // Tell waiting service worker to skip waiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}

/**
 * Check if app is installable
 * @returns {boolean}
 */
export function isInstallable() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

/**
 * Show install prompt (if available)
 */
let deferredPrompt = null;

export function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default browser install prompt
        e.preventDefault();
        deferredPrompt = e;

        // Show custom install button/banner
        showInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA installed');
        showToast('App erfolgreich installiert!', 'success');
        deferredPrompt = null;
    });
}

/**
 * Show install banner
 */
function showInstallBanner() {
    // Check if already dismissed
    if (localStorage.getItem('installBannerDismissed')) {
        return;
    }

    const banner = document.createElement('div');
    banner.className = 'privacy-banner';
    banner.style.background = 'var(--primary)';
    banner.style.color = 'white';
    banner.innerHTML = `
        <p>📱 Installiere Prompt Master Pro als App für schnelleren Zugriff!</p>
        <div style="display: flex; gap: 0.5rem;">
            <button id="install-dismiss" style="background: rgba(255,255,255,0.2); color: white;">
                Später
            </button>
            <button id="install-now" style="background: white; color: var(--primary);">
                Installieren
            </button>
        </div>
    `;

    document.body.appendChild(banner);

    // Dismiss button
    banner.querySelector('#install-dismiss').addEventListener('click', () => {
        banner.remove();
        localStorage.setItem('installBannerDismissed', 'true');
    });

    // Install button
    banner.querySelector('#install-now').addEventListener('click', async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted install prompt');
        }

        deferredPrompt = null;
        banner.remove();
    });
}

export default {
    registerServiceWorker,
    isInstallable,
    initInstallPrompt,
    updateApp
};
