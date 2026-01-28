/**
 * Feishu Policy - 权限策略
 * 
 * 负责：
 * - 私聊策略检查（open/allowlist）
 * - 群聊策略检查（open/allowlist/disabled）
 * - 白名单匹配
 * - @提及要求检查
 */

/**
 * 策略类型
 */
const PolicyType = {
    OPEN: 'open',           // 开放，允许所有
    ALLOWLIST: 'allowlist', // 白名单模式
    DISABLED: 'disabled'    // 禁用
};

/**
 * 权限策略类
 */
class Policy {
    /**
     * @param {Object} config - 配置对象
     * @param {string} config.dmPolicy - 私聊策略
     * @param {Array} config.allowFrom - 私聊白名单
     * @param {string} config.groupPolicy - 群聊策略
     * @param {Array} config.groupAllowFrom - 群聊白名单
     * @param {boolean} config.requireMention - 是否需要@提及
     * @param {Object} config.groups - 群组特定配置
     */
    constructor(config = {}) {
        this.config = {
            dmPolicy: PolicyType.OPEN,
            allowFrom: [],
            groupPolicy: PolicyType.ALLOWLIST,
            groupAllowFrom: [],
            requireMention: true,
            groups: {},
            ...config
        };
    }
    
    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * 检查私聊权限
     * @param {Object} params - 参数
     * @param {string} params.senderId - 发送者 ID
     * @returns {Object} 检查结果 { allowed, reason }
     */
    checkDM({ senderId }) {
        const policy = this.config.dmPolicy || PolicyType.OPEN;
        
        // 开放模式
        if (policy === PolicyType.OPEN) {
            return { allowed: true };
        }
        
        // 禁用模式
        if (policy === PolicyType.DISABLED) {
            return { allowed: false, reason: 'dm_disabled' };
        }
        
        // 白名单模式
        if (policy === PolicyType.ALLOWLIST) {
            const allowed = this._matchAllowlist(senderId, this.config.allowFrom);
            if (!allowed) {
                return { allowed: false, reason: 'not_in_allowlist' };
            }
        }
        
        return { allowed: true };
    }
    
    /**
     * 检查群聊权限
     * @param {Object} params - 参数
     * @param {string} params.chatId - 群聊 ID
     * @param {string} params.senderId - 发送者 ID
     * @returns {Object} 检查结果 { allowed, reason }
     */
    checkGroup({ chatId, senderId }) {
        // 检查是否有群组特定配置
        const groupConfig = this._getGroupConfig(chatId);
        
        // 群组被禁用
        if (groupConfig && groupConfig.enabled === false) {
            return { allowed: false, reason: 'group_disabled' };
        }
        
        const policy = this.config.groupPolicy || PolicyType.ALLOWLIST;
        
        // 禁用模式
        if (policy === PolicyType.DISABLED) {
            return { allowed: false, reason: 'group_disabled' };
        }
        
        // 开放模式
        if (policy === PolicyType.OPEN) {
            // 仍需检查发送者白名单（如果有配置）
            const senderAllowlist = groupConfig?.allowFrom || this.config.groupAllowFrom;
            if (senderAllowlist && senderAllowlist.length > 0) {
                if (!this._matchAllowlist(senderId, senderAllowlist)) {
                    return { allowed: false, reason: 'sender_not_in_allowlist' };
                }
            }
            return { allowed: true };
        }
        
        // 白名单模式
        if (policy === PolicyType.ALLOWLIST) {
            // 首先检查群聊是否在白名单中
            const groupAllowed = this._matchAllowlist(chatId, this.config.groupAllowFrom);
            if (!groupAllowed) {
                return { allowed: false, reason: 'group_not_in_allowlist' };
            }
            
            // 然后检查发送者是否在白名单中（如果有群组特定配置）
            const senderAllowlist = groupConfig?.allowFrom;
            if (senderAllowlist && senderAllowlist.length > 0) {
                if (!this._matchAllowlist(senderId, senderAllowlist)) {
                    return { allowed: false, reason: 'sender_not_in_allowlist' };
                }
            }
        }
        
        return { allowed: true };
    }
    
    /**
     * 检查是否需要@提及
     * @param {string} chatId - 群聊 ID
     * @returns {boolean} 是否需要@提及
     */
    requiresMention(chatId) {
        // 检查群组特定配置
        const groupConfig = this._getGroupConfig(chatId);
        if (groupConfig && typeof groupConfig.requireMention === 'boolean') {
            return groupConfig.requireMention;
        }
        
        return this.config.requireMention !== false;
    }
    
    /**
     * 获取群组特定配置
     * @param {string} chatId - 群聊 ID
     * @returns {Object|null} 群组配置
     */
    _getGroupConfig(chatId) {
        if (!chatId || !this.config.groups) {
            return null;
        }
        return this.config.groups[chatId] || null;
    }
    
    /**
     * 匹配白名单
     * @param {string} id - 要检查的 ID
     * @param {Array} allowlist - 白名单数组
     * @returns {boolean} 是否在白名单中
     */
    _matchAllowlist(id, allowlist) {
        if (!allowlist || allowlist.length === 0) {
            return false;
        }
        
        // 支持通配符
        if (allowlist.includes('*')) {
            return true;
        }
        
        // 规范化 ID
        const normalizedId = this._normalizeId(id);
        
        return allowlist.some(entry => {
            const normalizedEntry = this._normalizeId(String(entry));
            return normalizedEntry === normalizedId;
        });
    }
    
    /**
     * 规范化 ID（移除前缀，转小写）
     * @param {string} id - ID
     * @returns {string} 规范化后的 ID
     */
    _normalizeId(id) {
        if (!id) return '';
        
        return String(id)
            .replace(/^(feishu|user|open_id|chat):?/i, '')
            .toLowerCase()
            .trim();
    }
    
    /**
     * 获取当前策略摘要
     * @returns {Object} 策略摘要
     */
    getSummary() {
        return {
            dmPolicy: this.config.dmPolicy,
            dmAllowlistCount: this.config.allowFrom?.length || 0,
            groupPolicy: this.config.groupPolicy,
            groupAllowlistCount: this.config.groupAllowFrom?.length || 0,
            requireMention: this.config.requireMention,
            groupConfigCount: Object.keys(this.config.groups || {}).length
        };
    }
    
    /**
     * 添加到私聊白名单
     * @param {string} id - 用户 ID
     */
    addToDMAllowlist(id) {
        if (!this.config.allowFrom) {
            this.config.allowFrom = [];
        }
        const normalizedId = this._normalizeId(id);
        if (!this.config.allowFrom.includes(normalizedId)) {
            this.config.allowFrom.push(normalizedId);
        }
    }
    
    /**
     * 从私聊白名单移除
     * @param {string} id - 用户 ID
     */
    removeFromDMAllowlist(id) {
        if (!this.config.allowFrom) return;
        const normalizedId = this._normalizeId(id);
        const index = this.config.allowFrom.findIndex(
            e => this._normalizeId(e) === normalizedId
        );
        if (index !== -1) {
            this.config.allowFrom.splice(index, 1);
        }
    }
    
    /**
     * 添加到群聊白名单
     * @param {string} chatId - 群聊 ID
     */
    addToGroupAllowlist(chatId) {
        if (!this.config.groupAllowFrom) {
            this.config.groupAllowFrom = [];
        }
        const normalizedId = this._normalizeId(chatId);
        if (!this.config.groupAllowFrom.includes(normalizedId)) {
            this.config.groupAllowFrom.push(normalizedId);
        }
    }
    
    /**
     * 从群聊白名单移除
     * @param {string} chatId - 群聊 ID
     */
    removeFromGroupAllowlist(chatId) {
        if (!this.config.groupAllowFrom) return;
        const normalizedId = this._normalizeId(chatId);
        const index = this.config.groupAllowFrom.findIndex(
            e => this._normalizeId(e) === normalizedId
        );
        if (index !== -1) {
            this.config.groupAllowFrom.splice(index, 1);
        }
    }
}

module.exports = Policy;
