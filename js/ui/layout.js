/**
 * Layout & UI Utilities
 * Toast notifications, modals, loading indicators
 */

import { eventBus } from '../state.js';

// ========================================
// Toast Notifications
// ========================================

let toastContainer = null;

export function initToasts() {
    toastContainer = document.getElementById('toast-container');

    eventBus.on('showToast', ({ message, type, duration }) => {
        showToast(message, type, duration);
    });
}

export function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========================================
// Modal Dialogs
// ========================================

let modalContainer = null;

export function initModals() {
    modalContainer = document.getElementById('modal-container');

    eventBus.on('showConfirm', (options) => {
        showConfirmDialog(options);
    });
}

export function showModal(content, options = {}) {
    if (!modalContainer) {
        modalContainer = document.getElementById('modal-container');
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';

    if (options.title) {
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `<h2>${options.title}</h2>`;
        modal.appendChild(header);
    }

    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
        body.innerHTML = content;
    } else {
        body.appendChild(content);
    }
    modal.appendChild(body);

    if (options.footer) {
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        footer.appendChild(options.footer);
        modal.appendChild(footer);
    }

    overlay.appendChild(modal);
    modalContainer.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal(overlay);
        }
    });

    return overlay;
}

export function closeModal(overlay) {
    if (overlay && overlay.parentNode) {
        overlay.remove();
    }
}

export function showConfirmDialog({ title, message, onConfirm, onCancel }) {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '0.75rem';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'secondary-button';
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.onclick = () => {
        if (onCancel) onCancel();
        closeModal(overlay);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'primary-button';
    confirmBtn.textContent = 'Bestätigen';
    confirmBtn.onclick = () => {
        if (onConfirm) onConfirm();
        closeModal(overlay);
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    const overlay = showModal(`<p>${message}</p>`, {
        title,
        footer
    });
}

// ========================================
// Loading Indicator
// ========================================

let loadingOverlay = null;

export function initLoading() {
    eventBus.on('showLoading', ({ message }) => {
        showLoading(message);
    });

    eventBus.on('hideLoading', () => {
        hideLoading();
    });
}

export function showLoading(message = 'Laden...') {
    hideLoading(); // Remove existing

    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'modal-overlay';
    loadingOverlay.innerHTML = `
        <div class="modal" style="padding: 2rem; text-align: center;">
            <div style="margin-bottom: 1rem;">
                <div class="spinner"></div>
            </div>
            <p>${message}</p>
        </div>
    `;

    document.body.appendChild(loadingOverlay);
}

export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.remove();
        loadingOverlay = null;
    }
}

// ========================================
// Sidebar Toggle
// ========================================

export function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('closed');
        });
    }

    // Close sidebar on mobile when clicking outside
    if (window.innerWidth < 768) {
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.add('closed');
            }
        });
    }
}

// ========================================
// Theme Toggle
// ========================================

export function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';

    document.documentElement.setAttribute('data-theme', currentTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }
}

// ========================================
// Privacy Banner
// ========================================

export function initPrivacyBanner() {
    const banner = document.getElementById('privacy-banner');
    const closeBtn = document.getElementById('close-privacy-banner');
    const dismissed = localStorage.getItem('privacyBannerDismissed');

    if (!dismissed && banner) {
        banner.style.display = 'flex';
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            banner.style.display = 'none';
            localStorage.setItem('privacyBannerDismissed', 'true');
        });
    }
}

// ========================================
// Initialize All
// ========================================

export function initLayout() {
    initToasts();
    initModals();
    initLoading();
    initSidebar();
    initTheme();
    initPrivacyBanner();
}

export default {
    initLayout,
    showToast,
    showModal,
    closeModal,
    showConfirmDialog,
    showLoading,
    hideLoading
};
