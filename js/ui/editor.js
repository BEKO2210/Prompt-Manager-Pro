/**
 * Prompt Editor Component
 * Edit prompts, manage versions, view diffs
 */

import { getPrompt, updatePrompt, createPrompt, createVersion, getVersionsByPrompt, getLatestVersion, rollbackToVersion, deletePrompt } from '../db.js';
import { formatDate, formatDateTime, parseTags } from '../models.js';
import { navigate, showToast, showConfirm } from '../state.js';
import { renderDiff } from './diff.js';

let currentPrompt = null;
let currentVersions = [];
let currentTab = 'content';

/**
 * Render editor view
 * @param {string} promptId - Prompt ID (or 'new')
 * @param {HTMLElement} container - Container element
 */
export async function renderEditor(promptId, container) {
    if (!container) {
        container = document.getElementById('app-view');
    }

    if (promptId === 'new') {
        currentPrompt = null;
        currentVersions = [];
        currentTab = 'content';
    } else {
        currentPrompt = await getPrompt(promptId);
        if (!currentPrompt) {
            showToast('Prompt nicht gefunden', 'error');
            navigate('home');
            return;
        }
        currentVersions = await getVersionsByPrompt(promptId);
    }

    renderEditorUI(container);
}

/**
 * Render editor UI
 * @param {HTMLElement} container
 */
async function renderEditorUI(container) {
    const isNew = !currentPrompt;
    const latestVersion = !isNew ? await getLatestVersion(currentPrompt.id) : null;

    const html = `
        <div class="editor-container">
            <div class="editor-header">
                <input
                    type="text"
                    id="editor-title"
                    placeholder="Prompt Titel"
                    value="${isNew ? '' : escapeHtml(currentPrompt.title)}"
                    style="font-size: 1.5rem; font-weight: 600;"
                >
                <textarea
                    id="editor-description"
                    placeholder="Kurzbeschreibung (optional)"
                    rows="2"
                >${isNew ? '' : escapeHtml(currentPrompt.description)}</textarea>
                <input
                    type="text"
                    id="editor-tags"
                    placeholder="Tags (kommagetrennt, z.B. ai, copy, collection:website)"
                    value="${isNew ? '' : currentPrompt.tags.join(', ')}"
                >
            </div>

            ${!isNew ? `
                <div class="editor-tabs">
                    <button class="editor-tab ${currentTab === 'content' ? 'active' : ''}" data-tab="content">
                        Inhalt
                    </button>
                    <button class="editor-tab ${currentTab === 'versions' ? 'active' : ''}" data-tab="versions">
                        Versionen (${currentVersions.length})
                    </button>
                    <button class="editor-tab ${currentTab === 'notes' ? 'active' : ''}" data-tab="notes">
                        Notizen
                    </button>
                </div>
            ` : ''}

            <div class="editor-content" id="editor-tab-content">
                ${renderTabContent()}
            </div>

            <div class="editor-actions">
                <button class="secondary-button" id="editor-cancel">
                    Abbrechen
                </button>
                ${!isNew ? `
                    <button class="secondary-button" id="editor-new-version">
                        Neue Version
                    </button>
                    <button class="danger-button" id="editor-delete">
                        Löschen
                    </button>
                ` : ''}
                <button class="primary-button" id="editor-save">
                    ${isNew ? 'Erstellen' : 'Speichern'}
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
    attachEditorHandlers(container);
}

/**
 * Render tab content
 * @returns {string}
 */
function renderTabContent() {
    if (!currentPrompt) {
        // New prompt
        return `
            <textarea
                id="editor-content"
                placeholder="Prompt-Inhalt..."
                style="width: 100%; min-height: 400px;"
            ></textarea>
        `;
    }

    switch (currentTab) {
        case 'content': {
            const latestVersion = currentVersions.length > 0 ? currentVersions[0] : null;
            return `
                <textarea
                    id="editor-content"
                    placeholder="Prompt-Inhalt..."
                >${latestVersion ? escapeHtml(latestVersion.content) : ''}</textarea>
            `;
        }

        case 'versions':
            return renderVersionsList();

        case 'notes': {
            const latest = currentVersions.length > 0 ? currentVersions[0] : null;
            return `
                <textarea
                    id="editor-notes"
                    placeholder="Notizen zur aktuellen Version..."
                    style="width: 100%; min-height: 400px;"
                >${latest && latest.notes ? escapeHtml(latest.notes) : ''}</textarea>
            `;
        }

        default:
            return '';
    }
}

/**
 * Render versions list
 * @returns {string}
 */
function renderVersionsList() {
    if (currentVersions.length === 0) {
        return '<p style="color: var(--fg-tertiary); text-align: center; padding: 2rem;">Keine Versionen vorhanden</p>';
    }

    return `
        <div class="version-list">
            ${currentVersions.map((version, index) => `
                <div class="version-item ${index === 0 ? 'current' : ''}" data-version-id="${version.id}">
                    <div class="version-info">
                        <h4>${version.version} ${index === 0 ? '(Aktuell)' : ''}</h4>
                        <p>${formatDateTime(version.createdAt)}</p>
                        ${version.notes ? `<p style="font-size: 0.875rem; color: var(--fg-secondary); margin-top: 0.25rem;">${escapeHtml(version.notes)}</p>` : ''}
                    </div>
                    <div class="version-actions">
                        ${index > 0 ? `
                            <button class="secondary-button" data-action="diff" data-version-id="${version.id}">
                                Diff
                            </button>
                            <button class="secondary-button" data-action="rollback" data-version-id="${version.id}">
                                Rollback
                            </button>
                        ` : ''}
                        <button class="secondary-button" data-action="view" data-version-id="${version.id}">
                            Ansehen
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Attach event handlers
 * @param {HTMLElement} container
 */
function attachEditorHandlers(container) {
    // Tab switching
    container.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.dataset.tab;
            renderEditorUI(container);
        });
    });

    // Cancel button
    const cancelBtn = container.querySelector('#editor-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            navigate('home');
        });
    }

    // Save button
    const saveBtn = container.querySelector('#editor-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => handleSave(container));
    }

    // New version button
    const newVersionBtn = container.querySelector('#editor-new-version');
    if (newVersionBtn) {
        newVersionBtn.addEventListener('click', () => handleNewVersion(container));
    }

    // Delete button
    const deleteBtn = container.querySelector('#editor-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDelete());
    }

    // Version actions
    container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.dataset.action;
            const versionId = btn.dataset.versionId;
            handleVersionAction(action, versionId, container);
        });
    });

    // Keyboard shortcut: Ctrl/Cmd+S to save
    const contentArea = container.querySelector('#editor-content, #editor-notes');
    if (contentArea) {
        contentArea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave(container);
            }
        });
    }
}

/**
 * Handle save
 * @param {HTMLElement} container
 */
async function handleSave(container) {
    const title = container.querySelector('#editor-title').value.trim();
    const description = container.querySelector('#editor-description').value.trim();
    const tagsInput = container.querySelector('#editor-tags').value;
    const tags = parseTags(tagsInput);
    const content = container.querySelector('#editor-content')?.value || '';
    const notes = container.querySelector('#editor-notes')?.value || '';

    if (!title) {
        showToast('Bitte Titel eingeben', 'warning');
        return;
    }

    try {
        if (!currentPrompt) {
            // Create new prompt
            const promptId = await createPrompt({
                title,
                description,
                tags,
                content,
                notes
            });
            showToast('Prompt erstellt', 'success');
            navigate('editor', { id: promptId });
        } else {
            // Update existing prompt
            await updatePrompt(currentPrompt.id, {
                title,
                description,
                tags
            });

            // Update content in latest version if changed
            const latestVersion = currentVersions[0];
            if (latestVersion && currentTab === 'content' && content !== latestVersion.content) {
                await createVersion(currentPrompt.id, content, `Aktualisiert am ${formatDateTime(Date.now())}`);
            }

            showToast('Prompt gespeichert', 'success');
            renderEditor(currentPrompt.id, container);
        }
    } catch (error) {
        console.error('Save failed:', error);
        showToast('Speichern fehlgeschlagen', 'error');
    }
}

/**
 * Handle new version
 * @param {HTMLElement} container
 */
async function handleNewVersion(container) {
    const content = container.querySelector('#editor-content')?.value || '';

    try {
        await createVersion(currentPrompt.id, content, `Neue Version erstellt am ${formatDateTime(Date.now())}`);
        showToast('Neue Version erstellt', 'success');
        renderEditor(currentPrompt.id, container);
    } catch (error) {
        console.error('Create version failed:', error);
        showToast('Fehler beim Erstellen der Version', 'error');
    }
}

/**
 * Handle delete
 */
async function handleDelete() {
    const confirmed = await showConfirm('Möchten Sie diesen Prompt wirklich löschen?', 'Prompt löschen');

    if (confirmed) {
        try {
            await deletePrompt(currentPrompt.id, false); // Soft delete
            showToast('Prompt gelöscht', 'success');
            navigate('home');
        } catch (error) {
            console.error('Delete failed:', error);
            showToast('Löschen fehlgeschlagen', 'error');
        }
    }
}

/**
 * Handle version actions
 * @param {string} action - Action type
 * @param {string} versionId - Version ID
 * @param {HTMLElement} container
 */
async function handleVersionAction(action, versionId, container) {
    const version = currentVersions.find(v => v.id === versionId);
    if (!version) return;

    switch (action) {
        case 'view': {
            // Show version content in modal
            const viewModal = document.createElement('div');
            viewModal.innerHTML = `
                <h4>${version.version}</h4>
                <p style="color: var(--fg-tertiary); margin-bottom: 1rem;">${formatDateTime(version.createdAt)}</p>
                <pre style="white-space: pre-wrap; font-family: monospace; background: var(--bg-secondary); padding: 1rem; border-radius: 0.375rem; max-height: 400px; overflow-y: auto;">${escapeHtml(version.content)}</pre>
            `;
            const { showModal } = await import('./layout.js');
            showModal(viewModal, { title: 'Version Ansicht' });
            break;
        }

        case 'diff': {
            // Show diff with current version
            currentTab = 'diff';
            const diffContainer = container.querySelector('#editor-tab-content');
            if (diffContainer && currentVersions[0]) {
                diffContainer.innerHTML = renderDiff(currentVersions[0].content, version.content);
            }
            break;
        }

        case 'rollback': {
            const confirmed = await showConfirm(`Rollback zu ${version.version}?`, 'Version wiederherstellen');
            if (confirmed) {
                try {
                    await rollbackToVersion(versionId);
                    showToast('Rollback erfolgreich', 'success');
                    renderEditor(currentPrompt.id, container);
                } catch (error) {
                    console.error('Rollback failed:', error);
                    showToast('Rollback fehlgeschlagen', 'error');
                }
            }
            break;
        }
    }
}

/**
 * Escape HTML
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export default {
    renderEditor
};
