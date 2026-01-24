/**
 * MemoryManager 配置常量
 * 
 * 创建时间: 2026-01-17
 * 更新时间: 2026-01-18 - 简化配置，去掉索引/内容区
 * 更新时间: 2026-01-24 - 解耦重构，移除 skillDir 相关配置
 */

module.exports = {
    // 记忆管理配置
    memory: {
        // 所有 summary 合计的最大 token 数
        maxTotalTokens: 50000,
        // 活跃记忆最大数量
        maxActiveMemories: 20
    },
    
    // 路径配置（固定的子目录/文件名，相对于 dataDir）
    paths: {
        activeDir: 'active',
        archiveDir: 'archive',
        indexFile: 'index.md',
        summaryFile: 'summary.md',
        conversationFile: 'conversation.md',
        messagesFile: 'messages.json'
    },
    
    // Token 估算配置
    tokenEstimate: {
        // 每个字符估算的 token 数（中文约 0.5-0.7，英文约 0.25）
        charsPerToken: 2.5,
        // 缓冲系数（预留空间）
        bufferRatio: 1.1
    }
};
