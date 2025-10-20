/**
 * Main Application Entry Point
 * Bootstrap, Router, Hotkeys
 */

import { initLayout } from './ui/layout.js';
import { renderPromptList } from './ui/list.js';
import { renderEditor } from './ui/editor.js';
import { renderFilters, initSmartFilters } from './ui/filters.js';
import { renderSettings } from './ui/settings.js';
import { performSearch } from './search.js';
import { appState, eventBus, navigate, showToast } from './state.js';
import { registerServiceWorker, initInstallPrompt } from './pwa.js';
import { getStats, exportData } from './db.js';
import { generateExportFilename } from './models.js';
import localAdapter from './adapters/local.js';

// ========================================
// Application Bootstrap
// ========================================

async function init() {
    console.log('🚀 Initializing Prompt Master Pro...');

    // Initialize UI
    initLayout();

    // Initialize PWA
    await registerServiceWorker();
    initInstallPrompt();

    // Initialize router
    initRouter();

    // Initialize hotkeys
    initHotkeys();

    // Initialize filters
    await renderFilters();
    initSmartFilters();

    // Initialize top bar actions
    initTopBarActions();

    // Listen to state changes
    appState.subscribe((newState, oldState) => {
        if (newState.route !== oldState.route ||
            newState.routeParams !== oldState.routeParams) {
            handleRouteChange();
        }
    });

    // Listen to filter changes
    eventBus.on('filtersChanged', async () => {
        if (appState.get('route') === 'home') {
            await renderHome();
        }
        await renderFilters();
    });

    // Check for first run and show onboarding
    const settings = appState.get('settings');
    if (!settings.onboarding.completed) {
        await showOnboarding();
    } else {
        // Seed data if DB is empty
        await checkAndSeedData();
    }

    // Initial route
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    console.log('✅ App initialized');
}

// ========================================
// Router
// ========================================

function initRouter() {
    eventBus.on('navigate', ({ route, params }) => {
        // Update URL hash
        if (route === 'home') {
            window.location.hash = '';
        } else if (route === 'editor' && params.id) {
            window.location.hash = `#/editor/${params.id}`;
        } else if (route === 'settings') {
            window.location.hash = '#/settings';
        }
    });
}

function handleHashChange() {
    const hash = window.location.hash.slice(1);

    if (!hash || hash === '/') {
        appState.setState({ route: 'home', routeParams: {} });
    } else if (hash.startsWith('/editor/')) {
        const id = hash.replace('/editor/', '');
        appState.setState({ route: 'editor', routeParams: { id } });
    } else if (hash === '/settings') {
        appState.setState({ route: 'settings', routeParams: {} });
    }

    handleRouteChange();
}

async function handleRouteChange() {
    const { route, routeParams } = appState.getState();
    const container = document.getElementById('app-view');

    switch (route) {
        case 'home':
            await renderHome();
            break;
        case 'editor':
            await renderEditor(routeParams.id || 'new', container);
            break;
        case 'settings':
            renderSettings(container);
            break;
        default:
            await renderHome();
    }
}

async function renderHome() {
    const prompts = await performSearch();
    renderPromptList(prompts);
}

// ========================================
// Hotkeys
// ========================================

function initHotkeys() {
    document.addEventListener('keydown', (e) => {
        // Focus search: /
        if (e.key === '/' && !isInputFocused()) {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.focus();
            }
        }

        // Escape: Clear search or go home
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('search-input');
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                appState.setState({ searchQuery: '' });
                eventBus.emit('filtersChanged');
            } else if (appState.get('route') !== 'home') {
                navigate('home');
            }
        }

        // Ctrl/Cmd + N: New prompt
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            navigate('editor', { id: 'new' });
        }
    });
}

function isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
    );
}

// ========================================
// Top Bar Actions
// ========================================

function initTopBarActions() {
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            appState.setState({ searchQuery: e.target.value, smartFilter: null });
            eventBus.emit('filtersChanged');
        });
    }

    // New prompt button
    const newPromptBtn = document.getElementById('new-prompt-btn');
    if (newPromptBtn) {
        newPromptBtn.addEventListener('click', () => {
            navigate('editor', { id: 'new' });
        });
    }

    // Sync button
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            showSyncMenu();
        });
    }

    // Import button
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            handleImport();
        });
    }

    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            handleExport();
        });
    }

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            navigate('settings');
        });
    }
}

// ========================================
// Sync Menu
// ========================================

function showSyncMenu() {
    // Simple sync status for now
    showToast('Lokale Daten sind immer synchronisiert', 'info');
}

// ========================================
// Import/Export
// ========================================

async function handleExport() {
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
}

function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const { importData } = await import('./db.js');
            const result = await importData(data, true);
            showToast(`Import erfolgreich: ${result.imported} neu, ${result.merged} aktualisiert`, 'success');

            // Refresh view
            await renderHome();
            await renderFilters();
        } catch (error) {
            console.error('Import failed:', error);
            showToast('Import fehlgeschlagen', 'error');
        }
    };
    input.click();
}

// ========================================
// Seed Data
// ========================================

async function checkAndSeedData() {
    const stats = await getStats();

    if (stats.prompts === 0) {
        console.log('Seeding initial data...');
        await seedInitialData();
    }
}

async function seedInitialData() {
    const { createPrompt } = await import('./db.js');

    // Seed 3 example prompts
    await createPrompt({
        title: 'Website-Copywriting',
        description: 'Prompt für überzeugende Website-Texte',
        tags: ['copy', 'website', 'collection:marketing'],
        content: 'Schreibe einen überzeugenden Website-Text für [PRODUKT/SERVICE]. Zielgruppe: [ZIELGRUPPE]. Ton: professionell, aber freundlich. Länge: ca. 200 Wörter.\n\nFokus auf:\n- Klare Nutzen-Kommunikation\n- Call-to-Action\n- SEO-Optimierung',
        notes: 'Erste Version - Basis-Template'
    });

    await createPrompt({
        title: 'Code Review Assistant',
        description: 'Detaillierte Code-Reviews mit Best Practices',
        tags: ['code', 'review', 'ai', 'collection:development'],
        content: 'Analysiere folgenden Code und gib ein detailliertes Review:\n\n[CODE]\n\nPrüfe auf:\n- Code-Qualität und Lesbarkeit\n- Performance-Probleme\n- Security-Aspekte\n- Best Practices\n- Verbesserungsvorschläge',
        notes: 'Verwendbar für verschiedene Programmiersprachen'
    });

    await createPrompt({
        title: 'Social Media Post Generator',
        description: 'Engagement-optimierte Social Media Posts',
        tags: ['social-media', 'marketing', 'collection:marketing'],
        content: 'Erstelle einen ansprechenden Social Media Post für [PLATTFORM] zu folgendem Thema:\n\n[THEMA]\n\nZielgruppe: [ZIELGRUPPE]\nTon: [TON]\n\nInkludiere:\n- Hook im ersten Satz\n- Relevante Hashtags\n- Call-to-Action\n- Emoji wo passend',
        notes: 'Funktioniert gut für LinkedIn, Twitter, Instagram'
    });

    console.log('✅ Seed data created');
}

// ========================================
// Onboarding
// ========================================

async function showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    const title = document.getElementById('onboarding-title');
    const text = document.getElementById('onboarding-text');
    const nextBtn = document.getElementById('onboarding-next');
    const skipBtn = document.getElementById('onboarding-skip');

    const steps = [
        {
            title: 'Willkommen zu Prompt Master Pro!',
            text: 'Verwalte deine AI-Prompts mit Versionierung, Tags und Cloud-Sync. Lass uns die wichtigsten Features zeigen.'
        },
        {
            title: 'Prompts erstellen & organisieren',
            text: 'Klicke auf "+ Neuer Prompt", um einen Prompt zu erstellen. Nutze Tags zur Organisation und erstelle Sammlungen mit "collection:name".'
        },
        {
            title: 'Versionen & Backups',
            text: 'Jede Änderung kann als neue Version gespeichert werden. Nutze Google Drive Backup in den Einstellungen für automatische Sicherung.'
        }
    ];

    let currentStep = 0;

    function showStep(step) {
        title.textContent = steps[step].title;
        text.textContent = steps[step].text;

        if (step === steps.length - 1) {
            nextBtn.textContent = 'Los geht\'s!';
        }
    }

    showStep(0);
    overlay.style.display = 'flex';

    nextBtn.onclick = async () => {
        currentStep++;

        if (currentStep < steps.length) {
            showStep(currentStep);
        } else {
            // Complete onboarding
            overlay.style.display = 'none';
            appState.updateSettings({
                onboarding: { completed: true, step: currentStep }
            });

            // Seed data
            await seedInitialData();
            await renderHome();
            await renderFilters();

            showToast('Willkommen! 3 Beispiel-Prompts wurden erstellt.', 'success');
        }
    };

    skipBtn.onclick = async () => {
        overlay.style.display = 'none';
        appState.updateSettings({
            onboarding: { completed: true, step: 0 }
        });

        // Still seed data
        await seedInitialData();
        await renderHome();
        await renderFilters();
    };
}

// ========================================
// Initialize on DOM ready
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
