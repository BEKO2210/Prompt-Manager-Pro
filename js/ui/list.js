/**
 * Prompt List Component
 * Displays prompts in card/grid layout
 */

import { formatDate, truncate } from '../models.js';
import { navigate } from '../state.js';

/**
 * Render prompt list
 * @param {Array} prompts - Prompts to render
 * @param {HTMLElement} container - Container element
 */
export function renderPromptList(prompts, container) {
    if (!container) {
        container = document.getElementById('app-view');
    }

    if (!prompts || prompts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 1rem; color: var(--fg-tertiary);">
                <p style="font-size: 1.125rem; margin-bottom: 0.5rem;">Keine Prompts gefunden</p>
                <p>Erstelle deinen ersten Prompt mit dem "+ Neuer Prompt" Button.</p>
            </div>
        `;
        return;
    }

    const listHTML = `
        <div class="prompt-list">
            ${prompts.map(prompt => renderPromptCard(prompt)).join('')}
        </div>
    `;

    container.innerHTML = listHTML;

    // Attach click handlers
    prompts.forEach(prompt => {
        const card = container.querySelector(`[data-prompt-id="${prompt.id}"]`);
        if (card) {
            card.addEventListener('click', () => {
                navigate('editor', { id: prompt.id });
            });
        }
    });
}

/**
 * Render single prompt card
 * @param {Object} prompt - Prompt to render
 * @returns {string} - HTML string
 */
function renderPromptCard(prompt) {
    const tagsHTML = prompt.tags.length > 0
        ? prompt.tags.map(tag => {
            const isCollection = tag.startsWith('collection:');
            return `<span class="tag ${isCollection ? 'collection' : ''}">${tag}</span>`;
        }).join('')
        : '<span class="tag" style="opacity: 0.5;">Keine Tags</span>';

    return `
        <div class="prompt-card" data-prompt-id="${prompt.id}">
            <div class="prompt-card-header">
                <div>
                    <h3 class="prompt-card-title">${escapeHtml(prompt.title)}</h3>
                    <p class="prompt-card-meta">${formatDate(prompt.updatedAt)}</p>
                </div>
            </div>
            <p class="prompt-card-description">${escapeHtml(truncate(prompt.description, 150))}</p>
            <div class="prompt-card-tags">
                ${tagsHTML}
            </div>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export default {
    renderPromptList,
    renderPromptCard
};
