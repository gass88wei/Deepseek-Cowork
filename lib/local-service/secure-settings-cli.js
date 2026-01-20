/**
 * CLI 模式安全设置存储模块
 * 
 * 使用 libsodium 加密存储敏感数据（无需 Electron）
 * 加密后的数据以 Base64 存储在 secure-settings.json 中
 * 
 * 创建时间: 2026-01-20
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { getDataDir, ensureDir } = require('./config');

// libsodium 延迟加载
let sodium = null;

/**
 * 获取或生成机器密钥
 * 使用机器 ID 和用户信息派生一个稳定的加密密钥
 * @returns {Buffer} 32 字节密钥
 */
function getMachineKey() {
    // 收集机器信息作为熵源
    const machineInfo = [
        os.hostname(),
        os.homedir(),
        os.platform(),
        os.arch(),
        // 使用用户目录作为稳定标识
        process.env.USER || process.env.USERNAME || 'default'
    ].join(':');
    
    // 使用 SHA-256 派生 32 字节密钥
    return crypto.createHash('sha256').update(machineInfo).digest();
}

/**
 * CLI 模式安全设置管理器
 */
class SecureSettingsCLI {
    constructor() {
        this._settings = null;
        this._settingsPath = null;
        this._initialized = false;
        this._encryptionKey = null;
    }

    /**
     * 初始化
     * @param {string} [customDataDir] 可选的自定义数据目录
     */
    async initialize(customDataDir = null) {
        // 加载 libsodium
        try {
            sodium = require('libsodium-wrappers');
            await sodium.ready;
        } catch (error) {
            console.warn('[SecureSettingsCLI] libsodium not available, using fallback encryption');
        }
        
        const dataDir = customDataDir || getDataDir();
        ensureDir(dataDir);
        
        this._settingsPath = path.join(dataDir, 'secure-settings.json');
        this._encryptionKey = getMachineKey();
        this._load();
        this._initialized = true;
    }

    /**
     * 同步初始化（用于兼容现有代码）
     * @param {string} dataDir 数据目录
     */
    initializeSync(dataDir) {
        ensureDir(dataDir);
        
        this._settingsPath = path.join(dataDir, 'secure-settings.json');
        this._encryptionKey = getMachineKey();
        this._load();
        this._initialized = true;
        
        // 异步加载 sodium
        this._loadSodiumAsync();
    }

    /**
     * 异步加载 sodium
     * @private
     */
    async _loadSodiumAsync() {
        try {
            sodium = require('libsodium-wrappers');
            await sodium.ready;
        } catch (error) {
            // 忽略错误，使用回退加密
        }
    }

    /**
     * 检查是否已初始化
     * @returns {boolean}
     */
    isInitialized() {
        return this._initialized;
    }

    /**
     * 检查加密是否可用
     * @returns {boolean}
     */
    isEncryptionAvailable() {
        return sodium !== null || this._encryptionKey !== null;
    }

    /**
     * 加载设置
     * @private
     */
    _load() {
        try {
            if (fs.existsSync(this._settingsPath)) {
                const content = fs.readFileSync(this._settingsPath, 'utf8');
                this._settings = JSON.parse(content);
                
                // 检查并警告旧格式数据（Electron safeStorage 加密）
                this._checkLegacyData();
            } else {
                this._settings = {};
            }
        } catch (error) {
            console.error('[SecureSettingsCLI] Failed to load settings:', error.message);
            this._settings = {};
        }
    }
    
    /**
     * 检查并警告旧格式数据（Electron safeStorage 加密）
     * @private
     */
    _checkLegacyData() {
        const legacyKeys = [];
        
        for (const [key, entry] of Object.entries(this._settings)) {
            if (entry && entry.encrypted && !entry.method) {
                legacyKeys.push(key);
            }
        }
        
        if (legacyKeys.length > 0) {
            console.warn('[SecureSettingsCLI] Found legacy encrypted data (Electron safeStorage format):');
            console.warn(`  Keys: ${legacyKeys.join(', ')}`);
            console.warn('  These settings cannot be decrypted in CLI mode and need to be reconfigured.');
        }
    }

    /**
     * 保存设置
     * @private
     */
    _save() {
        try {
            const dir = path.dirname(this._settingsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this._settingsPath, JSON.stringify(this._settings, null, 2), 'utf8');
        } catch (error) {
            console.error('[SecureSettingsCLI] Failed to save settings:', error.message);
        }
    }

    /**
     * 使用 Node.js crypto 加密数据
     * @param {string} plaintext 明文
     * @returns {string} Base64 编码的加密数据
     * @private
     */
    _encryptWithCrypto(plaintext) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this._encryptionKey, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        const authTag = cipher.getAuthTag();
        
        // 格式: iv(16) + authTag(16) + encrypted
        return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]).toString('base64');
    }

    /**
     * 使用 Node.js crypto 解密数据
     * @param {string} encryptedData Base64 编码的加密数据
     * @returns {string} 明文
     * @private
     */
    _decryptWithCrypto(encryptedData) {
        const data = Buffer.from(encryptedData, 'base64');
        
        const iv = data.subarray(0, 16);
        const authTag = data.subarray(16, 32);
        const encrypted = data.subarray(32);
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', this._encryptionKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * 使用 libsodium 加密数据
     * 使用 URLSAFE_NO_PADDING 变体，与 Electron 版本兼容
     * @param {string} plaintext 明文
     * @returns {string} Base64 编码的加密数据
     * @private
     */
    _encryptWithSodium(plaintext) {
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
        const encrypted = sodium.crypto_secretbox_easy(
            sodium.from_string(plaintext),
            nonce,
            this._encryptionKey
        );
        
        // 格式: nonce + encrypted
        const combined = new Uint8Array(nonce.length + encrypted.length);
        combined.set(nonce);
        combined.set(encrypted, nonce.length);
        
        // 使用 URLSAFE_NO_PADDING 变体，与 Electron 版本兼容
        return sodium.to_base64(combined, sodium.base64_variants.URLSAFE_NO_PADDING);
    }

    /**
     * 使用 libsodium 解密数据
     * 支持 URLSAFE_NO_PADDING 变体（Electron 格式）和默认变体（旧 CLI 格式）
     * @param {string} encryptedData Base64 编码的加密数据
     * @returns {string} 明文
     * @private
     */
    _decryptWithSodium(encryptedData) {
        let combined;
        
        // 尝试使用 URLSAFE_NO_PADDING 解码（与 Electron 版本兼容）
        try {
            combined = sodium.from_base64(encryptedData, sodium.base64_variants.URLSAFE_NO_PADDING);
        } catch (e) {
            // 回退到默认变体（兼容旧的 CLI 格式）
            combined = sodium.from_base64(encryptedData);
        }
        
        const nonceLength = sodium.crypto_secretbox_NONCEBYTES;
        const nonce = combined.subarray(0, nonceLength);
        const encrypted = combined.subarray(nonceLength);
        
        const decrypted = sodium.crypto_secretbox_open_easy(
            encrypted,
            nonce,
            this._encryptionKey
        );
        
        return sodium.to_string(decrypted);
    }

    /**
     * 加密并存储敏感数据
     * @param {string} key 键名
     * @param {string} value 明文值
     * @returns {boolean} 是否成功
     */
    setSecret(key, value) {
        if (!this._initialized) {
            throw new Error('SecureSettingsCLI not initialized');
        }
        
        if (!value || typeof value !== 'string') {
            throw new Error('Value must be a non-empty string');
        }
        
        try {
            let encryptedData;
            let method;
            
            if (sodium) {
                encryptedData = this._encryptWithSodium(value);
                method = 'sodium';
            } else {
                encryptedData = this._encryptWithCrypto(value);
                method = 'crypto';
            }
            
            this._settings[key] = {
                encrypted: true,
                method: method,
                data: encryptedData
            };
            
            this._save();
            return true;
        } catch (error) {
            console.error(`[SecureSettingsCLI] Failed to encrypt ${key}:`, error.message);
            return false;
        }
    }

    /**
     * 解密并读取敏感数据
     * @param {string} key 键名
     * @returns {string|null} 明文值，不存在返回 null
     */
    getSecret(key) {
        if (!this._initialized) {
            throw new Error('SecureSettingsCLI not initialized');
        }
        
        const entry = this._settings[key];
        if (!entry || !entry.data) {
            console.log(`[SecureSettingsCLI] getSecret(${key}): no entry or data`);
            return null;
        }
        
        console.log(`[SecureSettingsCLI] getSecret(${key}): entry.method=${entry.method}, entry.encrypted=${entry.encrypted}`);
        
        try {
            if (!entry.encrypted) {
                // 未加密数据（兼容旧格式）
                return Buffer.from(entry.data, 'base64').toString('utf8');
            }
            
            // 检查是否是 Electron safeStorage 加密的旧数据（没有 method 字段）
            if (entry.encrypted && !entry.method) {
                console.warn(`[SecureSettingsCLI] ${key} was encrypted with Electron safeStorage and cannot be decrypted in CLI mode. Please reconfigure this setting.`);
                return null;
            }
            
            if (entry.method === 'sodium' && sodium) {
                const decrypted = this._decryptWithSodium(entry.data);
                console.log(`[SecureSettingsCLI] getSecret(${key}): decrypted length=${decrypted?.length}, starts with=${decrypted?.substring(0, 5)}`);
                return decrypted;
            } else if (entry.method === 'crypto') {
                return this._decryptWithCrypto(entry.data);
            } else {
                console.warn(`[SecureSettingsCLI] Unknown encryption method for ${key}: ${entry.method}`);
                return null;
            }
        } catch (error) {
            console.error(`[SecureSettingsCLI] Failed to decrypt ${key}:`, error.message);
            return null;
        }
    }

    /**
     * 检查是否存在指定的敏感数据（且可以解密）
     * @param {string} key 键名
     * @returns {boolean}
     */
    hasSecret(key) {
        if (!this._initialized) {
            return false;
        }
        
        const entry = this._settings[key];
        if (!entry || !entry.data) {
            return false;
        }
        
        // 检查是否是旧格式数据（Electron safeStorage 加密）
        // 旧格式: { encrypted: true, data: "..." } 但没有 method 字段
        if (entry.encrypted && !entry.method) {
            // 旧格式数据无法在 CLI 模式下解密，视为不存在
            return false;
        }
        
        return true;
    }

    /**
     * 删除敏感数据
     * @param {string} key 键名
     * @returns {boolean} 是否成功
     */
    deleteSecret(key) {
        if (!this._initialized) {
            throw new Error('SecureSettingsCLI not initialized');
        }
        
        if (this._settings[key]) {
            delete this._settings[key];
            this._save();
            return true;
        }
        
        return false;
    }

    /**
     * 获取所有已存储的键名
     * @returns {string[]}
     */
    getKeys() {
        if (!this._initialized) {
            return [];
        }
        return Object.keys(this._settings);
    }

    /**
     * 清空所有敏感数据
     */
    clear() {
        if (!this._initialized) {
            throw new Error('SecureSettingsCLI not initialized');
        }
        
        this._settings = {};
        this._save();
    }

    /**
     * 获取设置文件路径
     * @returns {string}
     */
    getSettingsPath() {
        return this._settingsPath;
    }
    
    /**
     * 清理旧格式数据（Electron safeStorage 加密）
     * @returns {string[]} 被清理的键名列表
     */
    clearLegacyData() {
        if (!this._initialized) {
            throw new Error('SecureSettingsCLI not initialized');
        }
        
        const clearedKeys = [];
        
        for (const [key, entry] of Object.entries(this._settings)) {
            if (entry && entry.encrypted && !entry.method) {
                delete this._settings[key];
                clearedKeys.push(key);
            }
        }
        
        if (clearedKeys.length > 0) {
            this._save();
            console.log(`[SecureSettingsCLI] Cleared legacy data: ${clearedKeys.join(', ')}`);
        }
        
        return clearedKeys;
    }
    
    /**
     * 检查是否有旧格式数据
     * @returns {boolean}
     */
    hasLegacyData() {
        if (!this._initialized) {
            return false;
        }
        
        for (const entry of Object.values(this._settings)) {
            if (entry && entry.encrypted && !entry.method) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 获取旧格式数据的键名列表
     * @returns {string[]}
     */
    getLegacyKeys() {
        if (!this._initialized) {
            return [];
        }
        
        const legacyKeys = [];
        
        for (const [key, entry] of Object.entries(this._settings)) {
            if (entry && entry.encrypted && !entry.method) {
                legacyKeys.push(key);
            }
        }
        
        return legacyKeys;
    }
}

// 导出单例
module.exports = new SecureSettingsCLI();
