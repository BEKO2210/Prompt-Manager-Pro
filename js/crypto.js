/**
 * Crypto Module
 * WebCrypto API wrapper for optional local encryption
 * AES-GCM encryption with PBKDF2 key derivation
 */

import { appState } from './state.js';

// In-memory key storage (never persisted)
let encryptionKey = null;
let salt = null;

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

/**
 * Initialize encryption with passphrase
 * @param {string} passphrase - User passphrase
 * @returns {Promise<void>}
 */
export async function initEncryption(passphrase) {
    if (!passphrase || passphrase.length < 8) {
        throw new Error('Passphrase must be at least 8 characters');
    }

    // Generate or retrieve salt
    const storedSalt = localStorage.getItem('encryptionSalt');
    if (storedSalt) {
        salt = base64ToArrayBuffer(storedSalt);
    } else {
        salt = window.crypto.getRandomValues(new Uint8Array(16));
        localStorage.setItem('encryptionSalt', arrayBufferToBase64(salt));
    }

    // Derive key from passphrase
    encryptionKey = await deriveKey(passphrase, salt);

    // Update settings
    appState.updateSettings({
        encryption: {
            enabled: true,
            hasPassphrase: true
        }
    });
}

/**
 * Derive encryption key from passphrase
 * @param {string} passphrase - User passphrase
 * @param {ArrayBuffer} salt - Salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const passphraseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        passphraseKey,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt data
 * @param {string} data - Data to encrypt
 * @returns {Promise<string>} - Encrypted data (base64)
 */
export async function encryptData(data) {
    if (!encryptionKey) {
        throw new Error('Encryption not initialized. Call initEncryption() first.');
    }

    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        encryptionKey,
        encoder.encode(data)
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return JSON.stringify({
        encrypted: arrayBufferToBase64(combined),
        iv: arrayBufferToBase64(iv),
        algorithm: 'AES-GCM'
    });
}

/**
 * Decrypt data
 * @param {string} encryptedData - Encrypted data (JSON string)
 * @returns {Promise<string>} - Decrypted data
 */
export async function decryptData(encryptedData) {
    if (!encryptionKey) {
        throw new Error('Encryption not initialized. Call initEncryption() first.');
    }

    const parsed = JSON.parse(encryptedData);
    const combined = base64ToArrayBuffer(parsed.encrypted);
    const iv = base64ToArrayBuffer(parsed.iv);

    const encryptedBytes = combined.slice(iv.byteLength);

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        encryptionKey,
        encryptedBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

/**
 * Change passphrase
 * @param {string} oldPassphrase - Old passphrase
 * @param {string} newPassphrase - New passphrase
 * @returns {Promise<void>}
 */
export async function changePassphrase(oldPassphrase, newPassphrase) {
    // Verify old passphrase
    const oldKey = await deriveKey(oldPassphrase, salt);

    // Test decryption with old key
    const testData = 'test';
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    try {
        await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            oldKey,
            encoder.encode(testData)
        );
    } catch (error) {
        throw new Error('Invalid old passphrase');
    }

    // Generate new salt
    salt = window.crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem('encryptionSalt', arrayBufferToBase64(salt));

    // Derive new key
    encryptionKey = await deriveKey(newPassphrase, salt);
}

/**
 * Disable encryption
 */
export function disableEncryption() {
    encryptionKey = null;
    salt = null;
    localStorage.removeItem('encryptionSalt');

    appState.updateSettings({
        encryption: {
            enabled: false,
            hasPassphrase: false
        }
    });
}

/**
 * Check if encryption is enabled
 * @returns {boolean}
 */
export function isEncryptionEnabled() {
    return encryptionKey !== null;
}

/**
 * Verify passphrase
 * @param {string} passphrase - Passphrase to verify
 * @returns {Promise<boolean>}
 */
export async function verifyPassphrase(passphrase) {
    try {
        const storedSalt = localStorage.getItem('encryptionSalt');
        if (!storedSalt) {
            return false;
        }

        const testSalt = base64ToArrayBuffer(storedSalt);
        const testKey = await deriveKey(passphrase, testSalt);

        // Test encryption
        const encoder = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            testKey,
            encoder.encode('test')
        );

        return true;
    } catch (error) {
        return false;
    }
}

// ========================================
// Utility Functions
// ========================================

/**
 * Convert ArrayBuffer to base64
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert base64 to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export default {
    initEncryption,
    encryptData,
    decryptData,
    changePassphrase,
    disableEncryption,
    isEncryptionEnabled,
    verifyPassphrase
};
