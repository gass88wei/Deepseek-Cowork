/**
 * Memory Service Module
 * 
 * 提供对话记忆保存的 HTTP API，供 save_memory.js 脚本调用
 * 遵循标准服务模块接口
 */

const express = require('express');
const cors = require('cors');
const { EventEmitter } = require('events');

/**
 * Setup Memory Service
 * @param {Object} options 配置选项
 * @param {Object} [options.memoryManager] MemoryManager 实例（可选，优先使用）
 * @param {string} [options.dataDir] 记忆数据目录（可选，用于自动创建 MemoryManager）
 * @param {Object} [options.serverConfig] 服务器配置
 * @returns {MemoryService} Memory service instance
 */
function setupMemoryService(options = {}) {
  // 获取 MessageStore 单例
  const MessageStore = require('../../../lib/message-store');
  
  /**
   * Memory Service class
   */
  class MemoryService extends EventEmitter {
    constructor() {
      super();
      this.memoryManager = options.memoryManager || null;
      this.dataDir = options.dataDir || null;
      this.config = options.serverConfig || {};
      this.isRunning = false;
    }

    /**
     * 设置 MemoryManager 实例
     * @param {Object} memoryManager MemoryManager 实例
     */
    setMemoryManager(memoryManager) {
      this.memoryManager = memoryManager;
      console.log('[MemoryService] MemoryManager set');
    }

    /**
     * Initialize service
     */
    async init() {
      try {
        console.log('[MemoryService] Initializing...');
        
        // 如果没有外部注入的 memoryManager，且提供了 dataDir，则自动创建
        if (!this.memoryManager && this.dataDir) {
          console.log('[MemoryService] Creating MemoryManager with dataDir:', this.dataDir);
          const MemoryManager = require('../../../lib/memory-manager');
          this.memoryManager = new MemoryManager({ dataDir: this.dataDir });
          await this.memoryManager.initialize();
          console.log('[MemoryService] MemoryManager created and initialized');
        }
        
        if (!this.memoryManager) {
          console.warn('[MemoryService] MemoryManager not available, some features may not work');
        }
        
        console.log('[MemoryService] Initialized');
        return true;
      } catch (error) {
        console.error(`[MemoryService] Failed to initialize: ${error.message}`);
        this.emit('error', { type: 'initError', error });
        throw error;
      }
    }

    /**
     * Setup routes
     * @param {Express} app Express application
     */
    setupRoutes(app) {
      console.log('[MemoryService] Setting up routes...');
      
      // API route prefix
      const apiRouter = express.Router();
      
      // Enable CORS
      apiRouter.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type']
      }));

      // JSON parsing middleware
      apiRouter.use(express.json({ limit: '10mb' }));
      
      // POST /api/memory/save - 保存当前对话为记忆
      apiRouter.post('/save', async (req, res) => {
        try {
          const { sessionId, topic, aiSummary, keywords, decisions, conversationId: reqConversationId } = req.body;
          
          // 验证必需参数
          if (!sessionId) {
            return res.status(400).json({
              success: false,
              error: 'sessionId is required'
            });
          }
          
          // 验证摘要内容（必填）
          if (!aiSummary || typeof aiSummary !== 'string' || aiSummary.trim().length === 0) {
            return res.status(400).json({
              success: false,
              error: 'aiSummary is required. Please provide summary content using --summary or --summary-file parameter.'
            });
          }
          
          // 检查 MemoryManager 是否可用
          if (!this.memoryManager) {
            return res.status(503).json({
              success: false,
              error: 'MemoryManager not available'
            });
          }
          
          // 获取 conversationId：优先使用请求中传入的，否则从 MessageStore 获取当前的
          const conversationId = reqConversationId || MessageStore.getCurrentConversationId(sessionId);
          
          // 从 MessageStore 获取需要保存的消息
          const messages = MessageStore.getMessagesSinceLastSave(sessionId);
          
          if (!messages || messages.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'No new messages to save'
            });
          }
          
          console.log(`[MemoryService] Saving ${messages.length} messages for session: ${sessionId.substring(0, 8)}..., conv: ${conversationId}`);
          
          // 调用 MemoryManager 保存（包含 conversationId 和 sessionId）
          const result = await this.memoryManager.saveConversation(messages, {
            topic,
            aiSummary,
            keywords,
            decisions,
            conversationId,
            sessionId
          });
          
          if (result.success) {
            // 标记消息已保存（更新边界）
            MessageStore.markSaved(sessionId);
            
            console.log(`[MemoryService] Memory saved: ${result.name}, conv: ${conversationId}`);
            
            this.emit('memory:saved', {
              sessionId,
              conversationId,
              memoryName: result.name,
              messageCount: messages.length
            });
            
            return res.json({
              success: true,
              memoryName: result.name,
              topic: result.topic,
              conversationId,
              messageCount: messages.length
            });
          } else {
            return res.status(500).json({
              success: false,
              error: result.error || result.reason || 'Save failed'
            });
          }
          
        } catch (error) {
          console.error(`[MemoryService] Save error: ${error.message}`);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
      });
      
      // GET /api/memory/status - 获取服务状态
      apiRouter.get('/status', (req, res) => {
        res.json({
          success: true,
          running: this.isRunning,
          memoryManagerAvailable: !!this.memoryManager
        });
      });
      
      // GET /api/memory/session/:sessionId - 获取 session 的消息统计
      apiRouter.get('/session/:sessionId', (req, res) => {
        try {
          const { sessionId } = req.params;
          
          const allMessages = MessageStore.getMessages(sessionId);
          const newMessages = MessageStore.getMessagesSinceLastSave(sessionId);
          const lastSavedIndex = MessageStore.getLastSavedIndex(sessionId);
          const conversationId = MessageStore.getCurrentConversationId(sessionId);
          
          res.json({
            success: true,
            sessionId,
            conversationId,
            totalMessages: allMessages?.length || 0,
            newMessages: newMessages?.length || 0,
            lastSavedIndex
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      });
      
      // GET /api/memory/conversation/:conversationId - 获取某轮对话的所有记忆
      apiRouter.get('/conversation/:conversationId', (req, res) => {
        try {
          const { conversationId } = req.params;
          const { includeArchived } = req.query;
          
          if (!this.memoryManager) {
            return res.status(503).json({
              success: false,
              error: 'MemoryManager not available'
            });
          }
          
          const memories = this.memoryManager.getMemoriesByConversation(conversationId, {
            includeArchived: includeArchived !== 'false'
          });
          
          res.json({
            success: true,
            conversationId,
            count: memories.length,
            memories
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      });
      
      // GET /api/memory/conversation/:conversationId/messages - 合并获取某轮对话的所有消息
      apiRouter.get('/conversation/:conversationId/messages', (req, res) => {
        try {
          const { conversationId } = req.params;
          const { includeArchived } = req.query;
          
          if (!this.memoryManager) {
            return res.status(503).json({
              success: false,
              error: 'MemoryManager not available'
            });
          }
          
          const result = this.memoryManager.getMergedConversation(conversationId, {
            includeArchived: includeArchived !== 'false'
          });
          
          if (result.success) {
            res.json(result);
          } else {
            res.status(404).json(result);
          }
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      });
      
      // POST /api/memory/rebuild-index - 重建索引
      apiRouter.post('/rebuild-index', async (req, res) => {
        try {
          if (!this.memoryManager) {
            return res.status(503).json({
              success: false,
              error: 'MemoryManager not available'
            });
          }
          
          console.log('[MemoryService] Rebuilding index...');
          
          // 调用 MemoryManager 的重建索引方法
          await this.memoryManager.rebuildIndex();
          
          const status = this.memoryManager.getStatus();
          
          console.log(`[MemoryService] Index rebuilt: ${status.memoryCount} memories, ${status.indexTokens} tokens`);
          
          res.json({
            success: true,
            memoryCount: status.memoryCount,
            indexTokens: status.indexTokens
          });
        } catch (error) {
          console.error(`[MemoryService] Rebuild index error: ${error.message}`);
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      });
      
      // Mount router
      app.use('/api/memory', apiRouter);
      
      console.log('[MemoryService] Routes setup complete: /api/memory/*');
    }

    /**
     * Start service
     */
    async start() {
      try {
        console.log('[MemoryService] Starting...');
        this.isRunning = true;
        this.emit('started', { serverInfo: this.getStatus() });
        console.log('[MemoryService] Started successfully');
        return true;
      } catch (error) {
        console.error(`[MemoryService] Failed to start: ${error.message}`);
        this.emit('error', { type: 'startError', error });
        throw error;
      }
    }

    /**
     * Stop service
     */
    async stop() {
      try {
        console.log('[MemoryService] Stopping...');
        this.isRunning = false;
        this.emit('stopped');
        console.log('[MemoryService] Stopped');
        return true;
      } catch (error) {
        console.error(`[MemoryService] Failed to stop: ${error.message}`);
        return false;
      }
    }

    /**
     * Get service status
     */
    getStatus() {
      return {
        running: this.isRunning,
        memoryManagerAvailable: !!this.memoryManager
      };
    }
  }

  return new MemoryService();
}

module.exports = { setupMemoryService };
