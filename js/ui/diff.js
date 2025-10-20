/**
 * Diff View Component
 * Line-by-line diff visualization
 */

/**
 * Render diff between two texts
 * @param {string} oldText - Old text
 * @param {string} newText - New text
 * @returns {string} - HTML string
 */
export function renderDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    const diff = computeDiff(oldLines, newLines);

    const html = `
        <div class="diff-container">
            ${diff.map(line => {
                let className = 'diff-line';
                let prefix = ' ';

                if (line.type === 'added') {
                    className += ' added';
                    prefix = '+';
                } else if (line.type === 'removed') {
                    className += ' removed';
                    prefix = '-';
                } else {
                    className += ' unchanged';
                }

                return `<div class="${className}">${prefix} ${escapeHtml(line.content)}</div>`;
            }).join('')}
        </div>
    `;

    return html;
}

/**
 * Compute diff (simple line-based algorithm)
 * @param {Array<string>} oldLines - Old lines
 * @param {Array<string>} newLines - New lines
 * @returns {Array<{type: string, content: string}>}
 */
function computeDiff(oldLines, newLines) {
    const result = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    let i = 0;
    let j = 0;

    while (i < oldLines.length || j < newLines.length) {
        const oldLine = oldLines[i];
        const newLine = newLines[j];

        if (i >= oldLines.length) {
            // Only new lines left
            result.push({ type: 'added', content: newLine });
            j++;
        } else if (j >= newLines.length) {
            // Only old lines left
            result.push({ type: 'removed', content: oldLine });
            i++;
        } else if (oldLine === newLine) {
            // Lines match
            result.push({ type: 'unchanged', content: oldLine });
            i++;
            j++;
        } else {
            // Lines differ - use LCS approach
            // For simplicity, we'll check if the next line matches
            const oldMatchesNext = oldLines[i + 1] === newLine;
            const newMatchesNext = newLines[j + 1] === oldLine;

            if (oldMatchesNext && !newMatchesNext) {
                // Old line was removed
                result.push({ type: 'removed', content: oldLine });
                i++;
            } else if (newMatchesNext && !oldMatchesNext) {
                // New line was added
                result.push({ type: 'added', content: newLine });
                j++;
            } else {
                // Both lines changed
                result.push({ type: 'removed', content: oldLine });
                result.push({ type: 'added', content: newLine });
                i++;
                j++;
            }
        }
    }

    return result;
}

/**
 * Escape HTML
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export default {
    renderDiff
};
