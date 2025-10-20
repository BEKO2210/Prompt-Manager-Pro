/**
 * Data Models and Validation
 * Type definitions and validators for Prompts and Versions
 */

// ========================================
// Type Definitions (JSDoc)
// ========================================

/**
 * @typedef {Object} Prompt
 * @property {string} id - UUID
 * @property {string} title - Prompt title
 * @property {string} description - Short description
 * @property {string[]} tags - Array of tags
 * @property {number} createdAt - Timestamp (epoch ms)
 * @property {number} updatedAt - Timestamp (epoch ms)
 * @property {boolean} [archived] - Soft delete flag
 */

/**
 * @typedef {Object} PromptVersion
 * @property {string} id - UUID
 * @property {string} promptId - Foreign key to Prompt
 * @property {string} version - Version string (e.g., "v1", "v2")
 * @property {string} content - Prompt content (multiline)
 * @property {string} [notes] - Optional notes
 * @property {number} createdAt - Timestamp (epoch ms)
 * @property {number} updatedAt - Timestamp (epoch ms)
 */

// ========================================
// Validators
// ========================================

/**
 * Validate prompt data
 * @param {Object} data - Prompt data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePrompt(data) {
    const errors = [];

    if (!data.title || typeof data.title !== 'string') {
        errors.push('Title is required and must be a string');
    } else if (data.title.trim().length === 0) {
        errors.push('Title cannot be empty');
    } else if (data.title.length > 200) {
        errors.push('Title must be less than 200 characters');
    }

    if (data.description && typeof data.description !== 'string') {
        errors.push('Description must be a string');
    } else if (data.description && data.description.length > 500) {
        errors.push('Description must be less than 500 characters');
    }

    if (data.tags) {
        if (!Array.isArray(data.tags)) {
            errors.push('Tags must be an array');
        } else {
            data.tags.forEach((tag, index) => {
                if (typeof tag !== 'string') {
                    errors.push(`Tag at index ${index} must be a string`);
                } else if (tag.trim().length === 0) {
                    errors.push(`Tag at index ${index} cannot be empty`);
                }
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate version data
 * @param {Object} data - Version data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateVersion(data) {
    const errors = [];

    if (!data.promptId || typeof data.promptId !== 'string') {
        errors.push('Prompt ID is required and must be a string');
    }

    if (!data.content || typeof data.content !== 'string') {
        errors.push('Content is required and must be a string');
    } else if (data.content.length > 100000) {
        errors.push('Content must be less than 100,000 characters');
    }

    if (data.notes && typeof data.notes !== 'string') {
        errors.push('Notes must be a string');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize user input (basic XSS prevention)
 * @param {string} str - String to sanitize
 * @returns {string}
 */
export function sanitizeString(str) {
    if (typeof str !== 'string') return '';

    return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Parse tags from comma-separated string
 * @param {string} tagString - Comma-separated tags
 * @returns {string[]}
 */
export function parseTags(tagString) {
    if (!tagString || typeof tagString !== 'string') {
        return [];
    }

    return tagString
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .map(tag => tag.toLowerCase());
}

/**
 * Format tags for display
 * @param {string[]} tags - Array of tags
 * @returns {string}
 */
export function formatTags(tags) {
    if (!Array.isArray(tags)) return '';
    return tags.join(', ');
}

/**
 * Check if tag is a collection tag
 * @param {string} tag - Tag to check
 * @returns {boolean}
 */
export function isCollectionTag(tag) {
    return tag.startsWith('collection:');
}

/**
 * Extract collection name from tag
 * @param {string} tag - Collection tag
 * @returns {string}
 */
export function getCollectionName(tag) {
    if (!isCollectionTag(tag)) return '';
    return tag.replace('collection:', '');
}

/**
 * Format timestamp to readable date
 * @param {number} timestamp - Epoch timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return 'Gerade eben';
    } else if (diffMins < 60) {
        return `Vor ${diffMins} Minute${diffMins > 1 ? 'n' : ''}`;
    } else if (diffHours < 24) {
        return `Vor ${diffHours} Stunde${diffHours > 1 ? 'n' : ''}`;
    } else if (diffDays < 7) {
        return `Vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    } else {
        return date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

/**
 * Format timestamp to full date/time
 * @param {number} timestamp - Epoch timestamp
 * @returns {string}
 */
export function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Truncate text to max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
export function truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Create a slug from title
 * @param {string} title - Title to slugify
 * @returns {string}
 */
export function slugify(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Generate a filename for export
 * @param {string} prefix - Filename prefix
 * @returns {string}
 */
export function generateExportFilename(prefix = 'prompt-master-pro') {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    return `${prefix}_${date}_${time}.json`;
}

export default {
    validatePrompt,
    validateVersion,
    sanitizeString,
    parseTags,
    formatTags,
    isCollectionTag,
    getCollectionName,
    formatDate,
    formatDateTime,
    truncate,
    slugify,
    generateExportFilename
};
