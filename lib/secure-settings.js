/**
 * 安全设置存储模块
 * 
 * 统一使用 libsodium 加密存储敏感数据（与 CLI 模式兼容）
 * 向后兼容旧的 Electron safeStorage 格式
 * 加密后的数据以 Base64 存储在 secure-settings.json 中
 * 
 * 创建时间: 2026-01-09
 * 更新时间: 2026-01-21 - 统一使用 libsodium 加密，与 CLI 模式兼容
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// safeStorage 需要在主进程中使用，延迟加载（仅用于读取旧数据）
let safeStorage = null;

// libsodium 延迟加载
let sodium = null;

/**
 * 获取或生成机器密钥
 * 使用机器 ID 和用户信息派生一个稳定的加密密钥
 * 与 CLI 版本使用相同的算法，确保两种模式可以互通
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
 * 安全设置管理器
 */
class SecureSettings {
    constructor() {
        this._settings = null;
        this._settingsPath = null;
        this._userDataPath = null;
        this._initialized = false;
        this._encryptionKey = null;
    }

    /**
     * 初始化（需要在 app ready 后调用）
     * @param {string} userDataPath Electron app.getPath('userData')
     */
    initialize(userDataPath) {
        // 延迟加载 safeStorage（只在主进程可用，仅用于读取旧数据）
        try {
            const electron = require('electron');
            safeStorage = electron.safeStorage;
        } catch (error) {
            console.warn('[SecureSettings] safeStorage not available (not in Electron main process)');
        }
        
        // 加载 libsodium
        this._loadSodiumSync();
        
        this._userDataPath = userDataPath;
        this._settingsPath = path.join(userDataPath, 'secure-settings.json');
        this._encryptionKey = getMachineKey();
        this._load();
        this._initialized = true;
        
        // 异步完成 sodium 初始化
        this._loadSodiumAsync();
    }

    /**
     * 同步加载 sodium（仅加载模块）
     * @private
     */
    _loadSodiumSync() {
        try {
            sodium = require('libsodium-wrappers');
        } catch (error) {
            console.warn('[SecureSettings] libsodium not available');
        }
    }

    /**
     * 异步完成 sodium 初始化
     * @private
     */
    async _loadSodiumAsync() {
        if (sodium) {
            try {
                await sodium.ready;
                console.log('[SecureSettings] libsodium ready');
            } catch (error) {
                console.warn('[SecureSettings] libsodium ready failed:', error.message);
            }
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
            } else {
                this._settings = {};
            }
        } catch (error) {
            console.error('[SecureSettings] 加载设置失败:', error.message);
            this._settings = {};
        }
    }

    /**
     * 保存设置
     * @private
     */
    _save() {
        try {
            // 确保目录存在
            const dir = path.dirname(this._settingsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this._settingsPath, JSON.stringify(this._settings, null, 2), 'utf8');
        } catch (error) {
            console.error('[SecureSettings] Failed to save settings:', error.message);
        }
    }

    /**
     * 使用 libsodium 加密
     * @param {string} plaintext 明文
     * @returns {string} Base64 编码的密文
     * @private
     */
    _encryptWithSodium(plaintext) {
        if (!sodium) {
            throw new Error('libsodium not available');
        }
        
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
        const message = sodium.from_string(plaintext);
        const ciphertext = sodium.crypto_secretbox_easy(message, nonce, this._encryptionKey);
        
        // 将 nonce 和密文合并
        const combined = new Uint8Array(nonce.length + ciphertext.length);
        combined.set(nonce);
        combined.set(ciphertext, nonce.length);
        
        return sodium.to_base64(combined, sodium.base64_variants.URLSAFE_NO_PADDING);
    }

    /**
     * 使用 libsodium 解密
     * 支持 URLSAFE_NO_PADDING 变体和默认变体（兼容 CLI 格式）
     * @param {string} encrypted Base64 编码的密文
     * @returns {string} 明文
     * @private
     */
    _decryptWithSodium(encrypted) {
        if (!sodium) {
            throw new Error('libsodium not available');
        }
        
        let combined;
        
        // 尝试使用 URLSAFE_NO_PADDING 解码
        try {
            combined = sodium.from_base64(encrypted, sodium.base64_variants.URLSAFE_NO_PADDING);
        } catch (e) {
            // 回退到默认变体（兼容旧的 CLI 格式）
            combined = sodium.from_base64(encrypted);
        }
        
        // 分离 nonce 和密文
        const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
        const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
        
        const decrypted = sodium.crypto_secretbox_open_easy(
            ciphertext,
            nonce,
            this._encryptionKey
        );
        
        return sodium.to_string(decrypted);
    }

    /**
     * 使用 Node.js crypto 加密（回退方案）
     * @param {string} plaintext 明文
     * @returns {string} Base64 编码的密文
     * @private
     */
    _encryptWithCrypto(plaintext) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this._encryptionKey, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        const authTag = cipher.getAuthTag();
        
        // 格式: iv:authTag:encrypted
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    }

    /**
     * 使用 Node.js crypto 解密
     * @param {string} encrypted 加密的数据
     * @returns {string} 明文
     * @private
     */
    _decryptWithCrypto(encrypted) {
        const [ivB64, authTagB64, ciphertext] = encrypted.split(':');
        
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', this._encryptionKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * 加密并存储敏感数据
     * 统一使用 libsodium 格式，与 CLI 模式兼容
     * @param {string} key 键名
     * @param {string} value 明文值
     * @returns {boolean} 是否成功
     */
    setSecret(key, value) {
        if (!this._initialized) {
            throw new Error('SecureSettings not initialized');
        }
        
        if (!value || typeof value !== 'string') {
            throw new Error('值必须是非空字符串');
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
            console.error(`[SecureSettings] Failed to encrypt ${key}:`, error.message);
            return false;
        }
    }

    /**
     * 解密并读取敏感数据
     * 支持多种格式：libsodium（新）、safeStorage（旧 Electron）、Base64（不加密）
     * @param {string} key 键名
     * @returns {string|null} 明文值，不存在返回 null
     */
    getSecret(key) {
        if (!this._initialized) {
            throw new Error('SecureSettings not initialized');
        }
        
        const entry = this._settings[key];
        if (!entry || !entry.data) {
            return null;
        }
        
        try {
            // 新格式：有 method 字段（libsodium 或 crypto）
            if (entry.method) {
                if (entry.method === 'sodium' && sodium) {
                    return this._decryptWithSodium(entry.data);
                } else if (entry.method === 'crypto') {
                    return this._decryptWithCrypto(entry.data);
                } else if (entry.method === 'sodium' && !sodium) {
                    console.warn(`[SecureSettings] ${key} requires libsodium which is not available`);
                    return null;
                } else {
                    console.warn(`[SecureSettings] Unknown encryption method for ${key}: ${entry.method}`);
                    return null;
                }
            }
            
            // 旧格式：Electron safeStorage（无 method 字段）
            if (entry.encrypted) {
                if (!safeStorage) {
                    console.warn(`[SecureSettings] ${key} was encrypted with Electron safeStorage which is not available`);
                    return null;
                }
                const buffer = Buffer.from(entry.data, 'base64');
                return safeStorage.decryptString(buffer);
            }
            
            // 未加密：Base64 编码
            return Buffer.from(entry.data, 'base64').toString('utf8');
            
        } catch (error) {
            console.error(`[SecureSettings] Failed to decrypt ${key}:`, error.message);
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
        
        // 新格式：有 method 字段
        if (entry.method) {
            if (entry.method === 'sodium') {
                return sodium !== null;
            }
            if (entry.method === 'crypto') {
                return true;
            }
            return false;
        }
        
        // 旧格式：Electron safeStorage
        if (entry.encrypted) {
            return safeStorage !== null;
        }
        
        // 未加密
        return true;
    }

    /**
     * 删除敏感数据
     * @param {string} key 键名
     * @returns {boolean} 是否成功
     */
    deleteSecret(key) {
        if (!this._initialized) {
            throw new Error('SecureSettings not initialized');
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
            throw new Error('SecureSettings not initialized');
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
     * 迁移旧的 safeStorage 数据到 libsodium 格式
     * @returns {Object} 迁移结果
     */
    async migrateToSodium() {
        if (!this._initialized) {
            throw new Error('SecureSettings not initialized');
        }
        
        if (!sodium) {
            return { success: false, error: 'libsodium not available' };
        }
        
        const migrated = [];
        const failed = [];
        
        for (const key of Object.keys(this._settings)) {
            const entry = this._settings[key];
            
            // 只迁移旧的 safeStorage 格式
            if (entry && entry.encrypted && !entry.method) {
                try {
                    // 尝试用 safeStorage 解密
                    if (!safeStorage) {
                        failed.push({ key, error: 'safeStorage not available' });
                        continue;
                    }
                    
                    const buffer = Buffer.from(entry.data, 'base64');
                    const plaintext = safeStorage.decryptString(buffer);
                    
                    // 用 libsodium 重新加密
                    const encryptedData = this._encryptWithSodium(plaintext);
                    this._settings[key] = {
                        encrypted: true,
                        method: 'sodium',
                        data: encryptedData
                    };
                    
                    migrated.push(key);
                } catch (error) {
                    failed.push({ key, error: error.message });
                }
            }
        }
        
        if (migrated.length > 0) {
            this._save();
        }
        
        return {
            success: true,
            migrated,
            failed
        };
    }
}

// 导出单例
module.exports = new SecureSettings();
