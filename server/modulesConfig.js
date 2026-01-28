/**
 * 内置模块配置
 * 
 * 声明式配置 server/modules/ 下的内置模块
 * 由 modulesManager.js 加载和管理
 */

const path = require('path');
const logger = require('./utils/logger');
const { getUserDataDir } = require('./utils/userDataDir');

/**
 * 内置模块配置列表
 */
const modules = [
    {
        // 浏览器控制服务
        name: 'browser',
        module: './modules/browser',
        setupFunction: 'setupBrowserControlService',
        enabled: true,
        
        // 服务特性
        features: {
            hasRoutes: true,
            emitsEvents: true
        },
        
        // 生成初始化参数
        getOptions: (config, runtimeContext) => ({
            browserControlConfig: config.browserControl,
            serverConfig: {
                host: config.server.host,
                port: config.server.port
            }
        }),
        
        // 事件监听配置
        events: {
            started: ({ serverInfo }) => {
                logger.info('浏览器控制服务器已启动');
                logger.info('配置摘要:', JSON.stringify(serverInfo.config, null, 2));
                if (serverInfo.connections?.extensionWebSocket?.enabled) {
                    logger.info(`浏览器扩展WebSocket: ${serverInfo.connections.extensionWebSocket.baseUrl}`);
                }
            },
            stopped: () => {
                logger.info('Browser control server stopped');
            },
            error: ({ type, error }) => {
                logger.error(`浏览器控制服务器错误 (${type}):`, error);
            }
        }
    },
    
    {
        // Explorer 文件浏览服务
        name: 'explorer',
        module: './modules/explorer',
        setupFunction: 'setupExplorerService',
        enabled: true,
        
        // 启用条件（通过配置控制）
        enabledCondition: (config) => config.explorer?.enabled !== false,
        
        // 服务特性
        features: {
            hasRoutes: true,
            emitsEvents: true
        },
        
        // 生成初始化参数（支持 runtimeContext）
        getOptions: (config, runtimeContext) => {
            // 使用 runtimeContext 中的 workspaceDir，如果没有则使用默认值
            const workspaceDir = runtimeContext?.workspaceDir || global.rootDir || process.cwd();
            
            return {
                explorerConfig: {
                    ...config.explorer,
                    // 如果 runtimeContext 提供了 watchDirs，使用它
                    watchDirs: runtimeContext?.watchDirs || config.explorer?.watchDirs
                },
                serverConfig: {
                    host: config.server.host,
                    port: config.server.port
                },
                appDir: workspaceDir
            };
        },
        
        // 事件监听配置
        events: {
            started: ({ serverInfo }) => {
                logger.info('Explorer 服务已启动');
                logger.info('Explorer 配置摘要:', JSON.stringify(serverInfo.config, null, 2));
            },
            stopped: () => {
                logger.info('Explorer 服务已停止');
            },
            error: ({ type, error }) => {
                logger.error(`Explorer 服务错误 (${type}):`, error);
            },
            file_change: (data) => {
                logger.debug(`文件变化: ${data.type} - ${data.path}`);
            }
        }
    },
    
    {
        // Memory 记忆服务
        name: 'memory',
        module: './modules/memory',
        setupFunction: 'setupMemoryService',
        enabled: true,
        
        // 启用条件（通过配置控制）
        enabledCondition: (config) => config.memory?.enabled !== false,
        
        // 服务特性
        features: {
            hasRoutes: true,
            emitsEvents: true
        },
        
        // 生成初始化参数（支持 runtimeContext）
        getOptions: (config, runtimeContext) => {
            // 使用 runtimeContext 中的 memoriesDir，如果没有则使用默认值
            const memoriesDir = runtimeContext?.memoriesDir || path.join(getUserDataDir(), 'memories');
            
            return {
                serverConfig: {
                    host: config.server.host,
                    port: config.server.port
                },
                dataDir: memoriesDir
            };
        },
        
        // 事件监听配置
        events: {
            started: ({ serverInfo }) => {
                logger.info('Memory 服务已启动');
            },
            stopped: () => {
                logger.info('Memory 服务已停止');
            },
            error: ({ type, error }) => {
                logger.error(`Memory 服务错误 (${type}):`, error);
            },
            'memory:saved': ({ sessionId, memoryName, messageCount }) => {
                logger.info(`Memory 已保存: ${memoryName} (${messageCount} 条消息)`);
            }
        }
    }
];

module.exports = {
    modules
};
