/**
 * MemoryManager 配置常量
 * 
 * 简化后的配置，去掉索引区/内容区的复杂逻辑
 * 
 * 创建时间: 2026-01-17
 * 更新时间: 2026-01-18 - 简化配置，去掉索引/内容区，改为直接注入全部 summary
 */

module.exports = {
    // 记忆管理配置
    memory: {
        // 所有 summary 合计的最大 token 数
        maxTotalTokens: 50000,
        // 活跃记忆最大数量
        maxActiveMemories: 20,
        // 自动归档天数
        archiveAfterDays: 14
    },
    
    // 路径配置（两个核心目录 + 固定子结构）
    paths: {
        // 技能目录（相对于 workDir）- 包含 SKILL.md 和 scripts/
        skillDir: '.claude/skills/conversation-memory',
        // 数据目录（相对于 workDir）- 包含 active/, archive/, index.md
        dataDir: '.claude/data/conversation-memory/memories',
        
        // 以下是固定的子目录/文件名
        activeDir: 'active',
        archiveDir: 'archive',
        scriptsDir: 'scripts',
        indexFile: 'index.md',
        summaryFile: 'summary.md',
        conversationFile: 'conversation.md',
        messagesFile: 'messages.json',
        skillFile: 'SKILL.md'
    },
    
    // Token 估算配置
    tokenEstimate: {
        // 每个字符估算的 token 数（中文约 0.5-0.7，英文约 0.25）
        charsPerToken: 2.5,
        // 缓冲系数（预留空间）
        bufferRatio: 1.1
    }
};
