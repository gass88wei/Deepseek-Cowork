/**
 * 状态相关 API 路由
 * 
 * 创建时间: 2026-01-20
 */

const HappyService = require('../../happy-service');

// 简单的日志存储（内存中）
const MAX_LOGS = 500;
let serverLogs = [];

/**
 * 添加日志
 * @param {string} level 日志级别
 * @param {string} message 日志消息
 */
function addLog(level, message) {
    serverLogs.push({
        timestamp: new Date().toISOString(),
        level,
        message
    });
    // 保持日志数量在限制内
    if (serverLogs.length > MAX_LOGS) {
        serverLogs = serverLogs.slice(-MAX_LOGS);
    }
}

// 捕获 console 输出作为日志
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    addLog('info', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
};

console.error = function(...args) {
    originalConsoleError.apply(console, args);
    addLog('error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
};

console.warn = function(...args) {
    originalConsoleWarn.apply(console, args);
    addLog('warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
};

/**
 * 注册状态路由
 * @param {Object} app Express 应用
 * @param {Object} context 上下文对象
 */
function statusRoutes(app, context) {
    const { localService } = context;
    
    /**
     * GET /api/status
     * 获取服务总体状态
     */
    app.get('/api/status', (req, res) => {
        try {
            const status = localService.getStatus();
            res.json({
                success: true,
                status
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * GET /api/version
     * 获取版本信息
     */
    app.get('/api/version', (req, res) => {
        try {
            const packageJson = require('../../../package.json');
            res.json({
                success: true,
                version: packageJson.version,
                name: packageJson.name,
                description: packageJson.description
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * GET /api/logs
     * 获取服务器日志
     */
    app.get('/api/logs', (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const logs = serverLogs.slice(-limit);
            res.json({
                success: true,
                logs,
                total: serverLogs.length
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * DELETE /api/logs
     * 清除服务器日志
     */
    app.delete('/api/logs', (req, res) => {
        try {
            serverLogs = [];
            res.json({
                success: true,
                message: 'Logs cleared'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
}

module.exports = statusRoutes;
