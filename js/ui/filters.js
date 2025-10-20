/**
 * Filters Component
 * Tag filters and smart filters in sidebar
 */

import { getAllTags } from '../db.js';
import { appState, eventBus } from '../state.js';

/**
 * Render tag filters in sidebar
 */
export async function renderFilters() {
    const container = document.getElementById('tag-filters');
    if (!container) return;

    const tags = await getAllTags();
    const selectedTags = appState.get('selectedTags');

    if (tags.length === 0) {
        container.innerHTML = '<p style="color: var(--fg-tertiary); font-size: 0.875rem;">Keine Tags vorhanden</p>';
        return;
    }

    container.innerHTML = tags.map(({ tag, count }) => `
        <div class="tag-filter-item">
            <input
                type="checkbox"
                id="tag-${slugify(tag)}"
                value="${tag}"
                ${selectedTags.includes(tag) ? 'checked' : ''}
            >
            <label for="tag-${slugify(tag)}">${tag}</label>
            <span class="tag-count">${count}</span>
        </div>
    `).join('');

    // Attach handlers
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            handleTagFilterChange();
        });
    });
}

/**
 * Handle tag filter change
 */
function handleTagFilterChange() {
    const container = document.getElementById('tag-filters');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const selectedTags = Array.from(checkboxes).map(cb => cb.value);

    appState.setState({ selectedTags, smartFilter: null });
    eventBus.emit('filtersChanged');
}

/**
 * Initialize smart filters
 */
export function initSmartFilters() {
    const smartFilters = document.querySelectorAll('.smart-filters button');

    smartFilters.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;

            // Update active state
            smartFilters.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Clear tag filters
            const tagCheckboxes = document.querySelectorAll('#tag-filters input[type="checkbox"]');
            tagCheckboxes.forEach(cb => cb.checked = false);

            appState.setState({ smartFilter: filter, selectedTags: [] });
            eventBus.emit('filtersChanged');
        });
    });
}

/**
 * Slugify tag name for ID
 * @param {string} tag
 * @returns {string}
 */
function slugify(tag) {
    return tag.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

export default {
    renderFilters,
    initSmartFilters
};
