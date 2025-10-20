/**
 * Search & Filter Engine
 * Fulltext search, tag filtering, and sorting
 */

import { getAllPrompts, searchPrompts, filterPromptsByTags } from './db.js';
import { appState } from './state.js';

// ========================================
// Search Functions
// ========================================

/**
 * Perform search and filtering based on current state
 * @returns {Promise<Array>} - Filtered prompts
 */
export async function performSearch() {
    const { searchQuery, selectedTags, smartFilter, sortBy } = appState.getState();

    let results = [];

    // Apply smart filter
    if (smartFilter === 'recent') {
        results = await getAllPrompts({ archived: false, sortBy: 'updatedAt' });
        results = results.slice(0, 20); // Limit to 20 most recent
    } else if (smartFilter === 'untagged') {
        const allPrompts = await getAllPrompts({ archived: false });
        results = allPrompts.filter(p => p.tags.length === 0);
    } else if (smartFilter === 'archived') {
        results = await getAllPrompts({ archived: true });
    } else {
        // Normal search/filter
        if (searchQuery && searchQuery.trim()) {
            results = await searchPrompts(searchQuery.trim());
        } else if (selectedTags.length > 0) {
            results = await filterPromptsByTags(selectedTags);
        } else {
            results = await getAllPrompts({ archived: false });
        }
    }

    // Apply tag filter if tags are selected (and not already filtered)
    if (selectedTags.length > 0 && !smartFilter) {
        results = results.filter(prompt => {
            return selectedTags.every(tag => prompt.tags.includes(tag));
        });
    }

    // Apply sorting
    results = sortPrompts(results, sortBy);

    return results;
}

/**
 * Sort prompts
 * @param {Array} prompts - Prompts to sort
 * @param {string} sortBy - Sort field (updatedAt, createdAt, title)
 * @returns {Array}
 */
export function sortPrompts(prompts, sortBy = 'updatedAt') {
    const sorted = [...prompts];

    switch (sortBy) {
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
            break;
        case 'createdAt':
            sorted.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'updatedAt':
        default:
            sorted.sort((a, b) => b.updatedAt - a.updatedAt);
            break;
    }

    return sorted;
}

/**
 * Highlight search terms in text
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} - HTML with highlighted terms
 */
export function highlightText(text, query) {
    if (!query || !text) return text;

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Escape regex special characters
 * @param {string} str - String to escape
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get search suggestions based on query
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Search suggestions
 */
export async function getSearchSuggestions(query) {
    if (!query || query.length < 2) {
        return [];
    }

    const lowerQuery = query.toLowerCase();
    const prompts = await getAllPrompts({ archived: false });
    const suggestions = new Set();

    // Add matching titles
    prompts.forEach(prompt => {
        if (prompt.title.toLowerCase().includes(lowerQuery)) {
            suggestions.add(prompt.title);
        }

        // Add matching tags
        prompt.tags.forEach(tag => {
            if (tag.toLowerCase().includes(lowerQuery)) {
                suggestions.add(tag);
            }
        });
    });

    return Array.from(suggestions).slice(0, 10);
}

/**
 * Get related prompts based on tags
 * @param {Object} prompt - Current prompt
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>}
 */
export async function getRelatedPrompts(prompt, limit = 5) {
    if (!prompt || !prompt.tags || prompt.tags.length === 0) {
        return [];
    }

    const allPrompts = await getAllPrompts({ archived: false });

    // Calculate relevance score based on shared tags
    const scored = allPrompts
        .filter(p => p.id !== prompt.id)
        .map(p => {
            const sharedTags = p.tags.filter(tag => prompt.tags.includes(tag));
            return {
                prompt: p,
                score: sharedTags.length
            };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored.map(item => item.prompt);
}

/**
 * Group prompts by collection tags
 * @param {Array} prompts - Prompts to group
 * @returns {Object} - Grouped prompts
 */
export function groupByCollections(prompts) {
    const collections = new Map();
    const uncategorized = [];

    prompts.forEach(prompt => {
        const collectionTags = prompt.tags.filter(tag => tag.startsWith('collection:'));

        if (collectionTags.length === 0) {
            uncategorized.push(prompt);
        } else {
            collectionTags.forEach(tag => {
                const collectionName = tag.replace('collection:', '');
                if (!collections.has(collectionName)) {
                    collections.set(collectionName, []);
                }
                collections.get(collectionName).push(prompt);
            });
        }
    });

    const result = {};
    collections.forEach((prompts, name) => {
        result[name] = prompts;
    });

    if (uncategorized.length > 0) {
        result['_uncategorized'] = uncategorized;
    }

    return result;
}

/**
 * Build search index for faster search (optional enhancement)
 * @param {Array} prompts - Prompts to index
 * @returns {Object} - Search index
 */
export function buildSearchIndex(prompts) {
    const index = new Map();

    prompts.forEach(prompt => {
        // Tokenize text
        const tokens = tokenize(
            `${prompt.title} ${prompt.description} ${prompt.tags.join(' ')}`
        );

        tokens.forEach(token => {
            if (!index.has(token)) {
                index.set(token, new Set());
            }
            index.get(token).add(prompt.id);
        });
    });

    return index;
}

/**
 * Tokenize text into searchable terms
 * @param {string} text - Text to tokenize
 * @returns {Array<string>}
 */
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2);
}

/**
 * Search using index (faster for large datasets)
 * @param {string} query - Search query
 * @param {Object} index - Search index
 * @param {Array} prompts - All prompts
 * @returns {Array}
 */
export function searchWithIndex(query, index, prompts) {
    const queryTokens = tokenize(query);
    const matchedIds = new Set();

    queryTokens.forEach(token => {
        if (index.has(token)) {
            index.get(token).forEach(id => matchedIds.add(id));
        }
    });

    const promptMap = new Map(prompts.map(p => [p.id, p]));
    return Array.from(matchedIds)
        .map(id => promptMap.get(id))
        .filter(Boolean);
}

export default {
    performSearch,
    sortPrompts,
    highlightText,
    getSearchSuggestions,
    getRelatedPrompts,
    groupByCollections,
    buildSearchIndex,
    searchWithIndex
};
