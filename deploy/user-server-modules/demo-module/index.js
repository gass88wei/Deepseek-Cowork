/**
 * Demo Module - 演示模块
 * 
 * 展示自定义模块的完整功能和开发模式
 * 
 * 功能：
 * - 静态页面服务（介绍自定义模块功能）
 * - API 接口示例（状态查询、Echo）
 * - 标准模块生命周期实现
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

/**
 * 创建演示模块服务实例
 * @param {Object} options - 配置选项
 * @returns {DemoModuleService} 服务实例
 */
function setupDemoModuleService(options = {}) {
    
    class DemoModuleService extends EventEmitter {
        constructor() {
            super();
            this.name = 'demo-module';
            this.version = '1.0.0';
            this.isRunning = false;
            this.startTime = null;
            this.requestCount = 0;
            this.staticDir = path.join(__dirname, 'static');
        }
        
        /**
         * 初始化模块
         */
        async init() {
            console.log(`[DemoModule] 初始化中...`);
            
            // 检查静态目录是否存在
            if (!fs.existsSync(this.staticDir)) {
                console.warn(`[DemoModule] 静态目录不存在: ${this.staticDir}`);
            }
            
            console.log(`[DemoModule] 初始化完成`);
        }
        
        /**
         * 注册路由
         * @param {Express} app - Express 应用实例
         */
        setupRoutes(app) {
            // 静态页面 - 介绍页面
            app.get('/demo/', (req, res) => {
                this.requestCount++;
                const indexPath = path.join(this.staticDir, 'index.html');
                
                if (fs.existsSync(indexPath)) {
                    res.sendFile(indexPath);
                } else {
                    res.status(404).send('Demo page not found');
                }
            });
            
            // API: 状态查询
            app.get('/api/demo/status', (req, res) => {
                this.requestCount++;
                res.json({
                    success: true,
                    data: {
                        name: this.name,
                        version: this.version,
                        isRunning: this.isRunning,
                        uptime: this.getUptime(),
                        requestCount: this.requestCount,
                        startTime: this.startTime ? this.startTime.toISOString() : null
                    }
                });
            });
            
            // API: Echo 接口
            app.post('/api/demo/echo', (req, res) => {
                this.requestCount++;
                res.json({
                    success: true,
                    data: {
                        echo: req.body,
                        timestamp: new Date().toISOString(),
                        headers: {
                            'content-type': req.headers['content-type'],
                            'user-agent': req.headers['user-agent']
                        }
                    }
                });
            });
            
            // API: 模块信息
            app.get('/api/demo/info', (req, res) => {
                this.requestCount++;
                res.json({
                    success: true,
                    data: {
                        name: this.name,
                        version: this.version,
                        description: '演示模块 - 展示自定义模块的完整功能',
                        author: 'deepseek-cowork',
                        features: [
                            '静态页面服务',
                            'RESTful API 接口',
                            '标准模块生命周期',
                            '事件驱动架构'
                        ],
                        endpoints: [
                            { method: 'GET', path: '/demo/', description: '介绍页面' },
                            { method: 'GET', path: '/api/demo/status', description: '状态查询' },
                            { method: 'POST', path: '/api/demo/echo', description: 'Echo 请求体' },
                            { method: 'GET', path: '/api/demo/info', description: '模块信息' }
                        ]
                    }
                });
            });
            
            console.log(`[DemoModule] 已注册路由: /demo/, /api/demo/*`);
        }
        
        /**
         * 启动模块
         */
        async start() {
            this.isRunning = true;
            this.startTime = new Date();
            
            console.log(`[DemoModule] 已启动`);
            this.emit('started', { 
                name: this.name,
                version: this.version,
                startTime: this.startTime 
            });
        }
        
        /**
         * 停止模块
         */
        async stop() {
            this.isRunning = false;
            const uptime = this.getUptime();
            
            console.log(`[DemoModule] 已停止 (运行时长: ${uptime}秒)`);
            this.emit('stopped', { 
                uptime,
                requestCount: this.requestCount 
            });
            
            this.startTime = null;
            this.requestCount = 0;
        }
        
        /**
         * 获取运行时长（秒）
         * @returns {number} 运行时长
         */
        getUptime() {
            if (!this.startTime) return 0;
            return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
        }
    }
    
    return new DemoModuleService();
}

module.exports = { setupDemoModuleService };
