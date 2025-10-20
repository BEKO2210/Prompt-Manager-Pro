/**
 * Database Layer - Dexie IndexedDB Wrapper
 * Manages Prompts and PromptVersions with CRUD operations
 */

// Dexie is loaded globally via script tag
const db = new Dexie('PromptMasterProDB');

// Define schema
db.version(1).stores({
    prompts: '&id, title, updatedAt, *tags',
    versions: '&id, promptId, version, updatedAt'
});

// ========================================
// CRUD Operations - Prompts
// ========================================

/**
 * Create a new prompt
 * @param {Object} promptData - Prompt data
 * @returns {Promise<string>} - Prompt ID
 */
export async function createPrompt(promptData) {
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

    await db.prompts.add(prompt);

    // Create initial version
    if (promptData.content) {
        await createVersion(id, promptData.content, promptData.notes);
    }

    return id;
}

/**
 * Get a prompt by ID
 * @param {string} id - Prompt ID
 * @returns {Promise<Object|null>}
 */
export async function getPrompt(id) {
    return await db.prompts.get(id);
}

/**
 * Get all prompts
 * @param {Object} options - Filter options
 * @returns {Promise<Array>}
 */
export async function getAllPrompts(options = {}) {
    let collection = db.prompts.toCollection();

    if (options.archived === false) {
        collection = collection.filter(p => !p.archived);
    } else if (options.archived === true) {
        collection = collection.filter(p => p.archived);
    }

    if (options.sortBy === 'title') {
        collection = collection.sortBy('title');
    } else if (options.sortBy === 'createdAt') {
        collection = collection.sortBy('createdAt');
    } else {
        // Default: sort by updatedAt descending
        collection = collection.reverse().sortBy('updatedAt');
    }

    return await collection;
}

/**
 * Update a prompt
 * @param {string} id - Prompt ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updatePrompt(id, updates) {
    const updateData = {
        ...updates,
        updatedAt: Date.now()
    };

    await db.prompts.update(id, updateData);
}

/**
 * Delete a prompt (soft delete)
 * @param {string} id - Prompt ID
 * @param {boolean} hard - Hard delete if true
 * @returns {Promise<void>}
 */
export async function deletePrompt(id, hard = false) {
    if (hard) {
        // Delete all versions first
        await db.versions.where('promptId').equals(id).delete();
        // Delete prompt
        await db.prompts.delete(id);
    } else {
        // Soft delete
        await updatePrompt(id, { archived: true });
    }
}

/**
 * Search prompts
 * @param {string} query - Search query
 * @returns {Promise<Array>}
 */
export async function searchPrompts(query) {
    if (!query) {
        return await getAllPrompts({ archived: false });
    }

    const lowerQuery = query.toLowerCase();
    const prompts = await db.prompts
        .filter(p => !p.archived)
        .toArray();

    return prompts.filter(p => {
        const inTitle = p.title.toLowerCase().includes(lowerQuery);
        const inDescription = p.description.toLowerCase().includes(lowerQuery);
        const inTags = p.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

        return inTitle || inDescription || inTags;
    });
}

/**
 * Filter prompts by tags
 * @param {Array<string>} tags - Tags to filter by
 * @returns {Promise<Array>}
 */
export async function filterPromptsByTags(tags) {
    if (!tags || tags.length === 0) {
        return await getAllPrompts({ archived: false });
    }

    const prompts = await db.prompts
        .filter(p => !p.archived)
        .toArray();

    // Match prompts that have ALL selected tags
    return prompts.filter(p => {
        return tags.every(tag => p.tags.includes(tag));
    });
}

// ========================================
// CRUD Operations - Versions
// ========================================

/**
 * Create a new version for a prompt
 * @param {string} promptId - Prompt ID
 * @param {string} content - Version content
 * @param {string} notes - Optional notes
 * @returns {Promise<string>} - Version ID
 */
export async function createVersion(promptId, content, notes = '') {
    const id = crypto.randomUUID();
    const now = Date.now();

    // Get current version count
    const existingVersions = await db.versions
        .where('promptId')
        .equals(promptId)
        .toArray();

    const versionNumber = existingVersions.length + 1;
    const versionString = `v${versionNumber}`;

    const version = {
        id,
        promptId,
        version: versionString,
        content: content || '',
        notes: notes || '',
        createdAt: now,
        updatedAt: now
    };

    await db.versions.add(version);

    // Update prompt's updatedAt
    await updatePrompt(promptId, {});

    return id;
}

/**
 * Get a version by ID
 * @param {string} id - Version ID
 * @returns {Promise<Object|null>}
 */
export async function getVersion(id) {
    return await db.versions.get(id);
}

/**
 * Get all versions for a prompt
 * @param {string} promptId - Prompt ID
 * @returns {Promise<Array>}
 */
export async function getVersionsByPrompt(promptId) {
    return await db.versions
        .where('promptId')
        .equals(promptId)
        .reverse()
        .sortBy('createdAt');
}

/**
 * Get the latest version for a prompt
 * @param {string} promptId - Prompt ID
 * @returns {Promise<Object|null>}
 */
export async function getLatestVersion(promptId) {
    const versions = await getVersionsByPrompt(promptId);
    return versions.length > 0 ? versions[0] : null;
}

/**
 * Update a version
 * @param {string} id - Version ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateVersion(id, updates) {
    const updateData = {
        ...updates,
        updatedAt: Date.now()
    };

    await db.versions.update(id, updateData);
}

/**
 * Delete a version
 * @param {string} id - Version ID
 * @returns {Promise<void>}
 */
export async function deleteVersion(id) {
    await db.versions.delete(id);
}

/**
 * Rollback to a specific version (creates new version with old content)
 * @param {string} versionId - Version ID to rollback to
 * @returns {Promise<string>} - New version ID
 */
export async function rollbackToVersion(versionId) {
    const oldVersion = await getVersion(versionId);
    if (!oldVersion) {
        throw new Error('Version not found');
    }

    const newVersionId = await createVersion(
        oldVersion.promptId,
        oldVersion.content,
        `Rollback to ${oldVersion.version}`
    );

    return newVersionId;
}

// ========================================
// Utility Functions
// ========================================

/**
 * Get all unique tags from all prompts
 * @returns {Promise<Array<{tag: string, count: number}>>}
 */
export async function getAllTags() {
    const prompts = await db.prompts.filter(p => !p.archived).toArray();
    const tagMap = new Map();

    prompts.forEach(prompt => {
        prompt.tags.forEach(tag => {
            tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
    });

    return Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Export all data as JSON
 * @returns {Promise<Object>}
 */
export async function exportData() {
    const prompts = await db.prompts.toArray();
    const versions = await db.versions.toArray();

    return {
        version: 1,
        exportedAt: Date.now(),
        prompts,
        versions
    };
}

/**
 * Import data from JSON
 * @param {Object} data - Data to import
 * @param {boolean} merge - Merge with existing data
 * @returns {Promise<{imported: number, skipped: number, merged: number}>}
 */
export async function importData(data, merge = true) {
    let imported = 0;
    let skipped = 0;
    let merged = 0;

    if (!data.prompts || !data.versions) {
        throw new Error('Invalid import data format');
    }

    for (const prompt of data.prompts) {
        const existing = await db.prompts.get(prompt.id);

        if (existing && !merge) {
            skipped++;
            continue;
        }

        if (existing && merge) {
            // Check if content is different
            const existingVersions = await getVersionsByPrompt(prompt.id);
            const importVersions = data.versions.filter(v => v.promptId === prompt.id);

            // Import new versions
            for (const version of importVersions) {
                const versionExists = existingVersions.some(v => v.id === version.id);
                if (!versionExists) {
                    await db.versions.add(version);
                    merged++;
                }
            }

            // Update prompt metadata
            await db.prompts.update(prompt.id, {
                ...prompt,
                updatedAt: Date.now()
            });
        } else {
            // New prompt
            await db.prompts.add(prompt);

            // Add all versions
            const versions = data.versions.filter(v => v.promptId === prompt.id);
            for (const version of versions) {
                await db.versions.add(version);
            }

            imported++;
        }
    }

    return { imported, skipped, merged };
}

/**
 * Clear all data (for testing/reset)
 * @returns {Promise<void>}
 */
export async function clearAllData() {
    await db.prompts.clear();
    await db.versions.clear();
}

/**
 * Get database stats
 * @returns {Promise<Object>}
 */
export async function getStats() {
    const promptCount = await db.prompts.count();
    const versionCount = await db.versions.count();
    const archivedCount = await db.prompts.filter(p => p.archived).count();

    return {
        prompts: promptCount,
        versions: versionCount,
        archived: archivedCount,
        active: promptCount - archivedCount
    };
}

export default db;
