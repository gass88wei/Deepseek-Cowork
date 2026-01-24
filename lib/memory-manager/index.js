/**
 * MemoryManager - 对话记忆管理器
 * 
 * 功能：
 * - 保存对话为结构化记忆文件
 * - 自动归档超出数量限制的旧记忆
 * - 通过 index.md 文件缓存合集内容
 * 
 * 创建时间: 2026-01-17
 * 更新时间: 2026-01-18 - 简化机制，去掉关键词匹配
 * 更新时间: 2026-01-18 - 解耦重构，消息由外部传入，不再内部记录
 * 更新时间: 2026-01-24 - 解耦重构，dataDir 必须由调用者显式传入，移除自动注入功能
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { estimateTokens, generateMemoryName, formatDateTime } = require('./utils');

class MemoryManager extends EventEmitter {
    /**
     * 构造函数
     * @param {Object} options 配置选项
     * @param {string} options.dataDir 数据目录路径（必填）
     * @throws {Error} 如果 dataDir 未提供
     */
    constructor(options = {}) {
        super();
        
        // dataDir 必填
        if (!options.dataDir) {
            throw new Error('MemoryManager: dataDir is required');
        }
        
        this.options = {
            dataDir: options.dataDir
        };
        
        // 数据目录：存储记忆文件（active/, archive/, index.md）
        this.dataDir = options.dataDir;
        
        // 子目录路径
        this.activeDir = path.join(this.dataDir, config.paths.activeDir);
        this.archiveDir = path.join(this.dataDir, config.paths.archiveDir);
        
        // index.md 路径
        this.indexPath = path.join(this.dataDir, config.paths.indexFile);
        
        // 状态
        this._initialized = false;
        this._enabled = true;
        
        // 缓存的索引内容和统计
        this._indexContent = '';
        this._indexTokens = 0;
        this._memoryCount = 0;
    }
    
    /**
     * 初始化管理器
     * 注意：目录不会在初始化时创建，而是在首次保存时按需创建
     * @returns {Promise<boolean>} 是否成功
     */
    async initialize() {
        if (this._initialized) {
            return true;
        }
        
        try {
            console.log('[MemoryManager] Initializing...');
            console.log(`[MemoryManager] Data dir: ${this.dataDir}`);
            
            // 如果目录已存在，重建索引
            if (fs.existsSync(this.activeDir)) {
                await this._rebuildIndex();
            }
            
            this._initialized = true;
            
            console.log(`[MemoryManager] Initialized. Memories: ${this._memoryCount}, Tokens: ${this._indexTokens}`);
            
            this.emit('initialized', {
                memoryCount: this._memoryCount,
                indexTokens: this._indexTokens
            });
            
            return true;
        } catch (error) {
            console.error('[MemoryManager] Initialization failed:', error.message);
            this._enabled = false;
            return false;
        }
    }
    
    /**
     * 重建 index.md
     * 读取所有活动记忆的 summary，合并成一个文件
     * 可通过 API 调用或内部调用
     */
    async rebuildIndex() {
        return this._rebuildIndex();
    }
    
    /**
     * 重建 index.md（内部实现）
     * @private
     */
    async _rebuildIndex() {
        try {
            // 1. 读取 active/ 下所有记忆目录
            if (!fs.existsSync(this.activeDir)) {
                this._indexContent = '';
                this._indexTokens = 0;
                this._memoryCount = 0;
                return;
            }
            
            const dirs = fs.readdirSync(this.activeDir)
                .filter(name => name.startsWith('mem-'))
                .sort((a, b) => b.localeCompare(a));  // 按时间倒序（新的在前）
            
            // 2. 检查是否需要归档
            await this._checkAndArchive(dirs);
            
            // 重新读取目录（归档后可能有变化）
            const activeDirs = fs.readdirSync(this.activeDir)
                .filter(name => name.startsWith('mem-'))
                .sort((a, b) => b.localeCompare(a));
            
            // 3. 读取每个目录的 summary.md，构建目录和内容
            const tocEntries = [];
            const contentSections = [];
            let totalTokens = 0;
            
            for (const dir of activeDirs) {
                const summaryPath = path.join(this.activeDir, dir, config.paths.summaryFile);
                
                if (fs.existsSync(summaryPath)) {
                    const content = fs.readFileSync(summaryPath, 'utf8');
                    const tokens = estimateTokens(content);
                    
                    // 提取主题（从标题）
                    const titleMatch = content.match(/^# 对话记忆：(.+)$/m);
                    const topic = titleMatch ? titleMatch[1].trim() : '未知主题';
                    
                    tocEntries.push(`- [${dir}] ${topic}`);
                    contentSections.push(`## ${dir}\n\n${content}`);
                    totalTokens += tokens;
                }
            }
            
            // 4. 生成 index.md 内容
            if (tocEntries.length === 0) {
                this._indexContent = '';
                this._indexTokens = 0;
                this._memoryCount = 0;
            } else {
                this._indexContent = `# 对话记忆索引

## 目录

${tocEntries.join('\n')}

---

${contentSections.join('\n\n---\n\n')}
`;
                this._indexTokens = estimateTokens(this._indexContent);
                this._memoryCount = tocEntries.length;
            }
            
            // 5. 写入 index.md
            fs.writeFileSync(this.indexPath, this._indexContent, 'utf8');
            
            console.log(`[MemoryManager] Index rebuilt: ${this._memoryCount} memories, ${this._indexTokens} tokens`);
            
        } catch (error) {
            console.error('[MemoryManager] Failed to rebuild index:', error.message);
        }
    }
    
    /**
     * 检查并归档超出限制的记忆
     * @param {string[]} dirs 记忆目录列表（按时间倒序）
     * @private
     */
    async _checkAndArchive(dirs) {
        const maxMemories = config.memory.maxActiveMemories;
        const maxTokens = config.memory.maxTotalTokens;
        
        // 计算当前总 token 数
        let totalTokens = 0;
        const memoryStats = [];
        
        for (const dir of dirs) {
            const summaryPath = path.join(this.activeDir, dir, config.paths.summaryFile);
            if (fs.existsSync(summaryPath)) {
                const content = fs.readFileSync(summaryPath, 'utf8');
                const tokens = estimateTokens(content);
                memoryStats.push({ dir, tokens });
                totalTokens += tokens;
            }
        }
        
        // 按时间正序排列（旧的在前，用于归档）
        const sortedByOldest = [...memoryStats].reverse();
        
        // 归档超出数量限制的
        while (sortedByOldest.length > maxMemories) {
            const oldest = sortedByOldest.shift();
            await this._archiveMemory(oldest.dir);
            totalTokens -= oldest.tokens;
            console.log(`[MemoryManager] Archived (count limit): ${oldest.dir}`);
        }
        
        // 归档超出 token 限制的
        while (totalTokens > maxTokens && sortedByOldest.length > 0) {
            const oldest = sortedByOldest.shift();
            await this._archiveMemory(oldest.dir);
            totalTokens -= oldest.tokens;
            console.log(`[MemoryManager] Archived (token limit): ${oldest.dir}`);
        }
    }
    
    /**
     * 归档一条记忆
     * @param {string} memoryId 记忆 ID
     * @private
     */
    async _archiveMemory(memoryId) {
        const srcDir = path.join(this.activeDir, memoryId);
        const destDir = path.join(this.archiveDir, memoryId);
        
        if (!fs.existsSync(srcDir)) {
            return;
        }
        
        // 确保归档目录存在
        if (!fs.existsSync(this.archiveDir)) {
            fs.mkdirSync(this.archiveDir, { recursive: true });
        }
        
        // 移动目录（复制后删除）
        fs.cpSync(srcDir, destDir, { recursive: true });
        fs.rmSync(srcDir, { recursive: true });
        
        this.emit('memory:archived', { id: memoryId });
    }
    
    /**
     * 保存对话为记忆
     * @param {Array} messages 消息数组，格式：[{ role, text, timestamp }]
     * @param {Object} options 保存选项
     * @param {string} options.topic 主题（可选，自动生成）
     * @param {string} options.aiSummary AI 生成的摘要文本（可选）
     * @param {string[]} options.keywords 关键词（可选，自动提取）
     * @param {string} options.conversationId 对话ID（可选，用于关联同一轮对话的多个记忆）
     * @param {string} options.sessionId Session ID（可选）
     * @returns {Promise<Object>} 保存结果
     */
    async saveConversation(messages, options = {}) {
        if (!this._initialized) {
            return { success: false, reason: 'Not initialized' };
        }
        
        if (!messages || messages.length === 0) {
            return { success: false, reason: 'No messages to save' };
        }
        
        try {
            const memoryName = generateMemoryName();
            
            // 合并所有消息文本用于提取关键词
            const allText = messages.map(m => this._extractMessageText(m) || '').join('\n');
            const keywords = options.keywords || this._extractSimpleKeywords(allText, 8);
            const topic = options.topic || this._generateTopic(messages);
            
            // 生成摘要和对话内容（支持 AI 摘要，包含 conversationId）
            const summary = this._generateSummary(messages, topic, keywords, options.aiSummary, options.conversationId, options.sessionId);
            const conversation = this._generateConversation(messages);
            
            // 保存文件
            const memoryDir = path.join(this.activeDir, memoryName);
            
            console.log(`[MemoryManager] Saving to: ${memoryDir}`);
            if (options.conversationId) {
                console.log(`[MemoryManager] ConversationId: ${options.conversationId}`);
            }
            
            // 确保目录存在（延迟创建：首次保存时创建 activeDir 和 archiveDir）
            if (!fs.existsSync(this.activeDir)) {
                fs.mkdirSync(this.activeDir, { recursive: true });
            }
            if (!fs.existsSync(this.archiveDir)) {
                fs.mkdirSync(this.archiveDir, { recursive: true });
            }
            if (!fs.existsSync(memoryDir)) {
                fs.mkdirSync(memoryDir, { recursive: true });
            }
            
            // 写入文件
            const summaryPath = path.join(memoryDir, config.paths.summaryFile);
            const conversationPath = path.join(memoryDir, config.paths.conversationFile);
            const messagesPath = path.join(memoryDir, config.paths.messagesFile);
            
            fs.writeFileSync(summaryPath, summary, 'utf8');
            fs.writeFileSync(conversationPath, conversation, 'utf8');
            
            // 保存原始消息 JSON，包含元数据（用于恢复聊天历史和检索）
            const messagesData = {
                meta: {
                    conversationId: options.conversationId || null,
                    sessionId: options.sessionId || null,
                    memoryName,
                    savedAt: new Date().toISOString()
                },
                messages
            };
            fs.writeFileSync(messagesPath, JSON.stringify(messagesData, null, 2), 'utf8');
            
            console.log(`[MemoryManager] Saved memory: ${memoryName}`);
            
            // 重建索引
            await this._rebuildIndex();
            
            this.emit('memory:saved', { name: memoryName, topic, keywords, conversationId: options.conversationId });
            
            return { success: true, name: memoryName, topic, conversationId: options.conversationId };
        } catch (error) {
            console.error('[MemoryManager] Save failed:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 列出所有可恢复的记忆
     * @param {Object} options 选项
     * @param {boolean} options.includeArchived 是否包含已归档的记忆
     * @returns {Array<Object>} 记忆列表 [{ id, topic, timestamp, messageCount, isArchived }]
     */
    listMemories(options = {}) {
        const { includeArchived = false } = options;
        const memories = [];
        
        // 读取活动记忆
        if (fs.existsSync(this.activeDir)) {
            const activeDirs = fs.readdirSync(this.activeDir)
                .filter(name => name.startsWith('mem-'));
            
            for (const dir of activeDirs) {
                const memoryInfo = this._getMemoryInfo(path.join(this.activeDir, dir), false);
                if (memoryInfo) {
                    memories.push(memoryInfo);
                }
            }
        }
        
        // 读取归档记忆
        if (includeArchived && fs.existsSync(this.archiveDir)) {
            const archiveDirs = fs.readdirSync(this.archiveDir)
                .filter(name => name.startsWith('mem-'));
            
            for (const dir of archiveDirs) {
                const memoryInfo = this._getMemoryInfo(path.join(this.archiveDir, dir), true);
                if (memoryInfo) {
                    memories.push(memoryInfo);
                }
            }
        }
        
        // 按时间倒序排列（新的在前）
        memories.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        
        return memories;
    }
    
    /**
     * 获取单个记忆的信息
     * @param {string} memoryDir 记忆目录路径
     * @param {boolean} isArchived 是否已归档
     * @returns {Object|null} 记忆信息
     * @private
     */
    _getMemoryInfo(memoryDir, isArchived) {
        const id = path.basename(memoryDir);
        const messagesPath = path.join(memoryDir, config.paths.messagesFile);
        const summaryPath = path.join(memoryDir, config.paths.summaryFile);
        
        // 检查是否有 messages.json（支持恢复）
        const hasMessages = fs.existsSync(messagesPath);
        
        let topic = '未知主题';
        let timestamp = '';
        let messageCount = 0;
        
        // 从 id 提取时间戳（格式：mem-YYYYMMDD-HHMMSS）
        const match = id.match(/mem-(\d{8})-(\d{6})/);
        if (match) {
            const dateStr = match[1];
            const timeStr = match[2];
            timestamp = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
        }
        
        // 从 summary.md 提取主题
        if (fs.existsSync(summaryPath)) {
            try {
                const content = fs.readFileSync(summaryPath, 'utf8');
                const titleMatch = content.match(/^# 对话记忆：(.+)$/m);
                if (titleMatch) {
                    topic = titleMatch[1].trim();
                }
            } catch (e) {
                // 忽略读取错误
            }
        }
        
        // 从 messages.json 获取消息数量
        if (hasMessages) {
            try {
                const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
                messageCount = Array.isArray(messages) ? messages.length : 0;
            } catch (e) {
                // 忽略解析错误
            }
        }
        
        return {
            id,
            topic,
            timestamp,
            messageCount,
            isArchived,
            canRestore: hasMessages
        };
    }
    
    /**
     * 从记忆恢复对话消息
     * @param {string} memoryId 记忆 ID（如 mem-20260118-143000）
     * @param {Object} options 选项
     * @param {boolean} options.includeArchived 是否包含已归档的记忆
     * @returns {Object} { success, messages, topic, error }
     */
    loadConversation(memoryId, options = {}) {
        const { includeArchived = true } = options;
        
        if (!memoryId) {
            return { success: false, error: 'Memory ID is required' };
        }
        
        // 先在活动记忆中查找
        let memoryDir = path.join(this.activeDir, memoryId);
        let isArchived = false;
        
        if (!fs.existsSync(memoryDir)) {
            // 在归档记忆中查找
            if (includeArchived) {
                memoryDir = path.join(this.archiveDir, memoryId);
                isArchived = true;
            }
            
            if (!fs.existsSync(memoryDir)) {
                return { success: false, error: `Memory not found: ${memoryId}` };
            }
        }
        
        const messagesPath = path.join(memoryDir, config.paths.messagesFile);
        
        // 检查是否有 messages.json
        if (!fs.existsSync(messagesPath)) {
            return { 
                success: false, 
                error: 'This memory does not have messages.json (saved before this feature was added)' 
            };
        }
        
        try {
            const content = fs.readFileSync(messagesPath, 'utf8');
            const data = JSON.parse(content);
            
            // 支持两种格式：
            // 新格式: { meta: {...}, messages: [...] }
            // 旧格式: [...]（直接是消息数组）
            let messages;
            let meta = null;
            
            if (Array.isArray(data)) {
                // 旧格式
                messages = data;
            } else if (data.messages && Array.isArray(data.messages)) {
                // 新格式
                messages = data.messages;
                meta = data.meta || null;
            } else {
                return { success: false, error: 'Invalid messages format' };
            }
            
            // 获取主题
            const memoryInfo = this._getMemoryInfo(memoryDir, isArchived);
            
            console.log(`[MemoryManager] Loaded conversation from ${memoryId}: ${messages.length} messages`);
            
            return {
                success: true,
                messages,
                meta,
                conversationId: meta?.conversationId || null,
                topic: memoryInfo?.topic || '未知主题',
                memoryId,
                isArchived
            };
        } catch (error) {
            console.error(`[MemoryManager] Failed to load conversation: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 根据 conversationId 获取所有相关的记忆
     * @param {string} conversationId 对话ID
     * @param {Object} options 选项
     * @param {boolean} options.includeArchived 是否包含归档记忆
     * @returns {Array<Object>} 记忆列表 [{ memoryId, topic, savedAt, messageCount, isArchived }]
     */
    getMemoriesByConversation(conversationId, options = {}) {
        if (!conversationId) {
            return [];
        }
        
        const { includeArchived = true } = options;
        const memories = [];
        
        // 搜索活动记忆
        if (fs.existsSync(this.activeDir)) {
            const activeDirs = fs.readdirSync(this.activeDir)
                .filter(name => name.startsWith('mem-'));
            
            for (const dir of activeDirs) {
                const meta = this._getMemoryConversationMeta(path.join(this.activeDir, dir));
                if (meta && meta.conversationId === conversationId) {
                    memories.push({
                        memoryId: dir,
                        ...meta,
                        isArchived: false
                    });
                }
            }
        }
        
        // 搜索归档记忆
        if (includeArchived && fs.existsSync(this.archiveDir)) {
            const archiveDirs = fs.readdirSync(this.archiveDir)
                .filter(name => name.startsWith('mem-'));
            
            for (const dir of archiveDirs) {
                const meta = this._getMemoryConversationMeta(path.join(this.archiveDir, dir));
                if (meta && meta.conversationId === conversationId) {
                    memories.push({
                        memoryId: dir,
                        ...meta,
                        isArchived: true
                    });
                }
            }
        }
        
        // 按时间排序（旧的在前）
        memories.sort((a, b) => (a.savedAt || '').localeCompare(b.savedAt || ''));
        
        console.log(`[MemoryManager] Found ${memories.length} memories for conversation: ${conversationId}`);
        return memories;
    }
    
    /**
     * 获取记忆的 conversationId 元信息
     * @param {string} memoryDir 记忆目录路径
     * @returns {Object|null} { conversationId, sessionId, savedAt, topic, messageCount }
     * @private
     */
    _getMemoryConversationMeta(memoryDir) {
        const messagesPath = path.join(memoryDir, config.paths.messagesFile);
        const summaryPath = path.join(memoryDir, config.paths.summaryFile);
        
        let result = {
            conversationId: null,
            sessionId: null,
            savedAt: null,
            topic: null,
            messageCount: 0
        };
        
        // 从 messages.json 获取元信息
        if (fs.existsSync(messagesPath)) {
            try {
                const content = fs.readFileSync(messagesPath, 'utf8');
                const data = JSON.parse(content);
                
                if (data.meta) {
                    result.conversationId = data.meta.conversationId;
                    result.sessionId = data.meta.sessionId;
                    result.savedAt = data.meta.savedAt;
                }
                
                // 计算消息数
                if (Array.isArray(data)) {
                    result.messageCount = data.length;
                } else if (data.messages && Array.isArray(data.messages)) {
                    result.messageCount = data.messages.length;
                }
            } catch (e) {
                // 忽略解析错误
            }
        }
        
        // 从 summary.md 获取主题
        if (fs.existsSync(summaryPath)) {
            try {
                const content = fs.readFileSync(summaryPath, 'utf8');
                const titleMatch = content.match(/^# 对话记忆：(.+)$/m);
                if (titleMatch) {
                    result.topic = titleMatch[1].trim();
                }
            } catch (e) {
                // 忽略读取错误
            }
        }
        
        return result;
    }
    
    /**
     * 合并获取某轮对话的所有消息
     * @param {string} conversationId 对话ID
     * @param {Object} options 选项
     * @param {boolean} options.includeArchived 是否包含归档记忆
     * @returns {Object} { success, conversationId, memories, messages, totalCount }
     */
    getMergedConversation(conversationId, options = {}) {
        if (!conversationId) {
            return { success: false, error: 'conversationId is required' };
        }
        
        // 获取所有相关记忆
        const memories = this.getMemoriesByConversation(conversationId, options);
        
        if (memories.length === 0) {
            return { 
                success: false, 
                error: `No memories found for conversation: ${conversationId}` 
            };
        }
        
        // 合并所有消息
        const allMessages = [];
        const memoryDetails = [];
        
        for (const mem of memories) {
            const memoryDir = mem.isArchived 
                ? path.join(this.archiveDir, mem.memoryId)
                : path.join(this.activeDir, mem.memoryId);
            
            const messagesPath = path.join(memoryDir, config.paths.messagesFile);
            
            if (fs.existsSync(messagesPath)) {
                try {
                    const content = fs.readFileSync(messagesPath, 'utf8');
                    const data = JSON.parse(content);
                    
                    let messages;
                    if (Array.isArray(data)) {
                        messages = data;
                    } else if (data.messages && Array.isArray(data.messages)) {
                        messages = data.messages;
                    } else {
                        continue;
                    }
                    
                    allMessages.push(...messages);
                    memoryDetails.push({
                        memoryId: mem.memoryId,
                        topic: mem.topic,
                        messageCount: messages.length,
                        isArchived: mem.isArchived
                    });
                } catch (e) {
                    console.error(`[MemoryManager] Failed to read messages from ${mem.memoryId}: ${e.message}`);
                }
            }
        }
        
        console.log(`[MemoryManager] Merged ${allMessages.length} messages from ${memories.length} memories for conversation: ${conversationId}`);
        
        return {
            success: true,
            conversationId,
            memories: memoryDetails,
            messages: allMessages,
            totalCount: allMessages.length
        };
    }
    
    /**
     * 简单的关键词提取
     * @param {string} text 文本
     * @param {number} maxKeywords 最大关键词数
     * @private
     */
    _extractSimpleKeywords(text, maxKeywords = 8) {
        if (!text) return [];
        
        // 简单提取中文词汇（2-4 字）
        const chineseWords = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
        
        // 统计词频
        const wordCount = {};
        for (const word of chineseWords) {
            wordCount[word] = (wordCount[word] || 0) + 1;
        }
        
        // 按词频排序，返回前 N 个
        return Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxKeywords)
            .map(([word]) => word);
    }
    
    /**
     * 生成对话主题
     * @param {Array} messages 消息数组
     * @private
     */
    _generateTopic(messages) {
        // 简单实现：取第一条用户消息的前 30 个字符
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
            const msgText = this._extractMessageText(firstUserMsg);
            if (msgText) {
                const text = msgText.substring(0, 30).replace(/\n/g, ' ');
                return text.length < msgText.length ? text + '...' : text;
            }
        }
        return '对话记录';
    }
    
    /**
     * 生成摘要内容
     * @param {Array} messages 消息数组
     * @param {string} topic 主题
     * @param {string[]} keywords 关键词
     * @param {string} aiSummary AI 生成的完整摘要（必填，应包含主要内容、关键决策、重要结论等）
     * @param {string} conversationId 对话ID（可选）
     * @param {string} sessionId Session ID（可选）
     * @private
     */
    _generateSummary(messages, topic, keywords, aiSummary, conversationId = null, sessionId = null) {
        const now = formatDateTime();
        
        // 从消息时间戳计算对话时长
        let duration = 0;
        if (messages.length >= 2) {
            const firstMsg = messages[0];
            const lastMsg = messages[messages.length - 1];
            const startTime = firstMsg.timestamp ? new Date(firstMsg.timestamp).getTime() : Date.now();
            const endTime = lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : Date.now();
            duration = Math.round((endTime - startTime) / 60000);
        }
        
        // 构建元信息部分（包含 conversationId 和 sessionId）
        let metaInfo = `- **时间**：${now}
- **持续**：约 ${duration} 分钟
- **对话轮次**：${Math.ceil(messages.length / 2)} 轮
- **关键词**：${keywords.join(', ')}`;
        
        if (conversationId) {
            metaInfo += `\n- **conversationId**：${conversationId}`;
        }
        if (sessionId) {
            metaInfo += `\n- **sessionId**：${sessionId.substring(0, 12)}...`;
        }
        
        // 简化的摘要结构：元信息 + 完整摘要内容
        // aiSummary 应该是完整的摘要，包含主要内容、关键决策、重要结论等
        return `# 对话记忆：${topic}

## 元信息

${metaInfo}

## 摘要

${aiSummary}

## 溯源

如需查看完整原始对话，请参阅 [conversation.md](conversation.md)
`;
    }
    
    /**
     * 从消息对象中提取文本内容
     * 支持多种消息格式：
     * - 简单格式: { text: '...' }
     * - 嵌套格式: { content: { data: { message: { content: [{ type: 'text', text: '...' }] } } } }
     * @param {Object} msg 消息对象
     * @returns {string} 提取的文本内容
     * @private
     */
    _extractMessageText(msg) {
        // 1. 简单格式：直接有 text 字段
        if (msg.text && typeof msg.text === 'string') {
            return msg.text;
        }
        
        // 2. 嵌套格式：content.data.message.content[]
        if (msg.content && msg.content.data && msg.content.data.message) {
            const messageContent = msg.content.data.message.content;
            if (Array.isArray(messageContent)) {
                // 提取所有 text 类型的内容
                const texts = messageContent
                    .filter(item => item.type === 'text' && item.text)
                    .map(item => item.text);
                
                if (texts.length > 0) {
                    return texts.join('\n\n');
                }
                
                // 如果没有 text，检查是否有 tool_use（工具调用）
                const toolUses = messageContent
                    .filter(item => item.type === 'tool_use')
                    .map(item => `[调用工具: ${item.name}]`);
                
                if (toolUses.length > 0) {
                    return toolUses.join('\n');
                }
            }
        }
        
        // 3. 另一种嵌套格式：content 直接是数组
        if (Array.isArray(msg.content)) {
            const texts = msg.content
                .filter(item => item.type === 'text' && item.text)
                .map(item => item.text);
            
            if (texts.length > 0) {
                return texts.join('\n\n');
            }
        }
        
        return null;
    }

    /**
     * 生成对话内容
     * @param {Array} messages 消息数组
     * @private
     */
    _generateConversation(messages) {
        // 从消息时间戳获取开始和结束时间
        const firstMsg = messages[0];
        const lastMsg = messages[messages.length - 1];
        
        const startTime = firstMsg?.timestamp 
            ? formatDateTime(new Date(firstMsg.timestamp))
            : formatDateTime();
        const endTime = lastMsg?.timestamp 
            ? formatDateTime(new Date(lastMsg.timestamp))
            : formatDateTime();
        
        let content = `# 原始对话记录

## 对话信息

- **开始时间**：${startTime}
- **结束时间**：${endTime}
- **对话轮次**：${Math.ceil(messages.length / 2)} 轮

---

## 对话内容

`;
        
        for (const msg of messages) {
            const role = msg.role === 'user' ? '用户' : 'Claude';
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
            const text = this._extractMessageText(msg) || '（无内容）';
            content += `### ${role} [${time}]\n\n${text}\n\n---\n\n`;
        }
        
        return content;
    }
    
    /**
     * 获取索引内容（用于调试）
     */
    getIndexText() {
        return this._indexContent;
    }
    
    /**
     * 获取管理器状态
     */
    getStatus() {
        return {
            initialized: this._initialized,
            enabled: this._enabled,
            dataDir: this.dataDir,
            memoryCount: this._memoryCount,
            indexTokens: this._indexTokens
        };
    }
    
    /**
     * 启用/禁用记忆功能
     */
    setEnabled(enabled) {
        this._enabled = enabled;
        console.log(`[MemoryManager] ${enabled ? 'Enabled' : 'Disabled'}`);
    }
    
    /**
     * 清理资源
     */
    cleanup() {
        this._initialized = false;
        this._indexContent = '';
        this._indexTokens = 0;
        this._memoryCount = 0;
        
        this.removeAllListeners();
        console.log('[MemoryManager] Cleaned up');
    }
}

module.exports = MemoryManager;
