/**
 * 模块管理器
 * 
 * 负责管理服务模块的加载、初始化、启动和关闭
 * 支持内置模块和用户自定义模块
 * 支持多种运行模式（server、CLI、Electron）
 */

const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const { 
    getUserModulesDir, 
    getUserModulesConfigPath, 
    userModulesConfigExists,
    getUserDataDir,
    ensureDir
} = require('./utils/userDataDir');

// 存储已加载的模块实例
let moduleInstances = {};

// 存储合并后的模块配置
let mergedModuleConfigs = [];

// 存储模块启动顺序（用于逆序关闭）
let bootOrder = [];

// 存储运行时选项
let runtimeOptions = {};

// 存储运行时上下文（用于热加载）
let runtimeContext = null;

/**
 * 清理模块缓存
 * @param {string} modulePath 模块路径
 */
function clearModuleCache(modulePath) {
    try {
        const resolvedPath = require.resolve(modulePath);
        if (require.cache[resolvedPath]) {
            delete require.cache[resolvedPath];
            logger.debug(`已清理模块缓存: ${modulePath}`);
        }
    } catch (e) {
        // 模块可能不在缓存中，忽略错误
    }
}

/**
 * 加载内置模块配置
 * @returns {Array} 内置模块配置数组
 */
function loadBuiltinConfig() {
    try {
        const builtinConfig = require('./modulesConfig');
        return builtinConfig.modules || [];
    } catch (error) {
        logger.error('加载内置模块配置失败:', error);
        return [];
    }
}

/**
 * 加载用户模块配置
 * @returns {Object|null} 用户配置对象，包含 overrides 和 modules
 */
function loadUserConfig() {
    const configPath = getUserModulesConfigPath();
    
    if (!userModulesConfigExists()) {
        logger.debug('用户模块配置文件不存在，跳过加载');
        return null;
    }
    
    try {
        // 清除 require 缓存，确保每次读取最新配置
        delete require.cache[require.resolve(configPath)];
        const userConfig = require(configPath);
        logger.info('已加载用户模块配置:', configPath);
        return userConfig;
    } catch (error) {
        logger.error('加载用户模块配置失败:', error);
        return null;
    }
}

/**
 * 合并内置配置和用户配置
 * @returns {Array} 合并后的模块配置数组
 */
function loadAllConfigs() {
    const builtinConfigs = loadBuiltinConfig();
    const userConfig = loadUserConfig();
    
    // 创建配置映射（按模块名）
    const configMap = new Map();
    
    // 先添加内置配置
    for (const config of builtinConfigs) {
        configMap.set(config.name, { ...config, source: 'builtin' });
    }
    
    // 如果有用户配置，进行合并
    if (userConfig) {
        // 处理 overrides（覆盖内置模块配置）
        if (userConfig.overrides) {
            for (const [name, override] of Object.entries(userConfig.overrides)) {
                if (configMap.has(name)) {
                    const existing = configMap.get(name);
                    configMap.set(name, { ...existing, ...override });
                    logger.debug(`用户配置覆盖内置模块: ${name}`);
                }
            }
        }
        
        // 处理用户自定义模块
        if (userConfig.modules && Array.isArray(userConfig.modules)) {
            for (const userModule of userConfig.modules) {
                if (configMap.has(userModule.name)) {
                    // 同名模块，用户配置覆盖
                    const existing = configMap.get(userModule.name);
                    configMap.set(userModule.name, { ...existing, ...userModule, source: 'user' });
                    logger.debug(`用户模块覆盖: ${userModule.name}`);
                } else {
                    // 新模块
                    configMap.set(userModule.name, { ...userModule, source: 'user' });
                    logger.debug(`添加用户模块: ${userModule.name}`);
                }
            }
        }
    }
    
    mergedModuleConfigs = Array.from(configMap.values());
    logger.info(`已加载 ${mergedModuleConfigs.length} 个模块配置`);
    
    return mergedModuleConfigs;
}

/**
 * 获取已启用的模块配置
 * @param {Object} config 服务器配置（用于评估 enabledCondition）
 * @returns {Array} 已启用的模块配置数组
 */
function getEnabledModules(config) {
    return mergedModuleConfigs.filter(moduleConfig => {
        // 检查 enabled 标志
        if (moduleConfig.enabled === false) {
            return false;
        }
        
        // 检查 enabledCondition 函数
        if (typeof moduleConfig.enabledCondition === 'function') {
            return moduleConfig.enabledCondition(config);
        }
        
        return true;
    });
}

/**
 * 默认路径解析器
 * @param {Object} moduleConfig 模块配置
 * @returns {string} 绝对模块路径
 */
function defaultPathResolver(moduleConfig) {
    if (moduleConfig.source === 'user') {
        // 用户模块：相对于用户模块目录
        return path.resolve(getUserModulesDir(), moduleConfig.module);
    } else {
        // 内置模块：相对于当前目录（server/）
        return path.resolve(__dirname, moduleConfig.module);
    }
}

/**
 * 解析模块路径
 * @param {Object} moduleConfig 模块配置
 * @returns {string} 绝对模块路径
 */
function resolveModulePath(moduleConfig) {
    // 使用自定义路径解析器或默认解析器
    const resolver = runtimeOptions.pathResolver || defaultPathResolver;
    return resolver(moduleConfig);
}

/**
 * 重置管理器状态
 * 用于在不同入口重新初始化时清理状态
 */
function reset() {
    moduleInstances = {};
    mergedModuleConfigs = [];
    bootOrder = [];
    runtimeOptions = {};
    logger.debug('模块管理器状态已重置');
}

/**
 * 初始化所有模块
 * @param {Object} config 服务器配置对象
 * @param {Object} options 运行时选项
 * @param {Function} options.pathResolver 自定义路径解析函数
 * @param {boolean} options.clearCache 是否清理模块缓存
 * @param {Object} options.runtimeContext 运行时上下文（workspaceDir, memoriesDir 等）
 * @returns {Object} 模块实例映射
 */
function initModules(config, options = {}) {
    // 保存运行时选项
    runtimeOptions = options;
    
    const enabledModules = getEnabledModules(config);
    
    for (const moduleConfig of enabledModules) {
        try {
            // 解析模块路径
            const modulePath = resolveModulePath(moduleConfig);
            
            // 可选：清理模块缓存
            if (options.clearCache) {
                clearModuleCache(modulePath);
            }
            
            // 动态加载模块
            const serviceModule = require(modulePath);
            
            // 获取 setup 函数
            const setupFunction = serviceModule[moduleConfig.setupFunction];
            if (typeof setupFunction !== 'function') {
                logger.error(`模块 ${moduleConfig.name} 的 setup 函数不存在: ${moduleConfig.setupFunction}`);
                continue;
            }
            
            // 生成初始化参数（支持 runtimeContext）
            let moduleOptions = {};
            if (typeof moduleConfig.getOptions === 'function') {
                // getOptions 可以接收 config 和 runtimeContext 两个参数
                moduleOptions = moduleConfig.getOptions(config, options.runtimeContext);
            }
            
            // 创建模块实例
            const instance = setupFunction(moduleOptions);
            moduleInstances[moduleConfig.name] = instance;
            
            logger.info(`已初始化模块: ${moduleConfig.name} (来源: ${moduleConfig.source || 'builtin'})`);
        } catch (error) {
            logger.error(`初始化模块 ${moduleConfig.name} 失败:`, error);
        }
    }
    
    return moduleInstances;
}

/**
 * 为模块设置事件监听器
 * @param {Object} instance 模块实例
 * @param {Object} moduleConfig 模块配置
 */
function setupModuleEvents(instance, moduleConfig) {
    if (!moduleConfig.events || !instance.on) return;
    
    for (const [eventName, handler] of Object.entries(moduleConfig.events)) {
        if (typeof handler === 'function') {
            instance.on(eventName, handler);
        }
    }
}

/**
 * 启动单个模块
 * @param {Object} instance 模块实例
 * @param {Object} moduleConfig 模块配置
 * @param {Object} context 启动上下文
 */
async function bootstrapModule(instance, moduleConfig, context) {
    const { app } = context;
    
    try {
        // 初始化
        if (instance.init) {
            await instance.init();
        }
        
        // 设置路由
        if (moduleConfig.features?.hasRoutes && instance.setupRoutes) {
            instance.setupRoutes(app);
        }
        
        // 启动服务
        if (instance.start) {
            await instance.start();
        }
        
        // 设置事件监听器
        if (moduleConfig.features?.emitsEvents) {
            setupModuleEvents(instance, moduleConfig);
        }
        
        // 记录启动顺序
        bootOrder.push(moduleConfig.name);
        
        logger.info(`模块 ${moduleConfig.name} 启动成功`);
    } catch (error) {
        logger.error(`启动模块 ${moduleConfig.name} 时出错:`, error);
    }
}

/**
 * 启动所有模块
 * @param {Object} context 启动上下文 { app, io, http, config, PORT }
 */
async function bootstrapModules(context) {
    // 保存运行时上下文，用于热加载
    runtimeContext = context;
    
    const { config } = context;
    const enabledModules = getEnabledModules(config);
    
    for (const moduleConfig of enabledModules) {
        const instance = moduleInstances[moduleConfig.name];
        if (!instance) {
            logger.warn(`模块 ${moduleConfig.name} 未初始化，跳过启动`);
            continue;
        }
        
        logger.info(`正在启动模块: ${moduleConfig.name}...`);
        await bootstrapModule(instance, moduleConfig, context);
    }
}

/**
 * 关闭所有模块（按启动的逆序）
 */
async function shutdownModules() {
    // 按启动顺序的逆序关闭
    const reversedOrder = [...bootOrder].reverse();
    
    for (const moduleName of reversedOrder) {
        const instance = moduleInstances[moduleName];
        if (!instance) continue;
        
        try {
            if (instance.stop && typeof instance.stop === 'function') {
                await instance.stop();
                logger.info(`Module ${moduleName} stopped`);
            }
        } catch (error) {
            logger.error(`关闭模块 ${moduleName} 时出错:`, error);
        }
    }
    
    // 清空状态
    bootOrder = [];
}

// ============================================================
// 热加载 API - 运行时动态加载/卸载模块
// ============================================================

/**
 * 运行时加载单个模块
 * @param {string} moduleName 模块名称
 * @returns {Object} 加载结果 { success, data?, error? }
 */
async function loadSingleModule(moduleName) {
    try {
        // 检查运行时上下文是否可用
        if (!runtimeContext) {
            return { success: false, error: '服务未完全启动，无法热加载模块' };
        }
        
        // 检查模块是否已加载
        if (moduleInstances[moduleName]) {
            return { success: false, error: `模块 ${moduleName} 已加载，请先卸载或使用重载` };
        }
        
        // 重新读取用户配置以获取最新的模块信息
        const userConfig = loadUserConfig();
        if (!userConfig || !userConfig.modules) {
            return { success: false, error: '无法读取用户模块配置' };
        }
        
        // 找到目标模块配置
        const moduleConfig = userConfig.modules.find(m => m.name === moduleName);
        if (!moduleConfig) {
            return { success: false, error: `模块配置不存在: ${moduleName}` };
        }
        
        // 标记为用户模块
        moduleConfig.source = 'user';
        
        // 解析模块路径
        const modulePath = resolveModulePath(moduleConfig);
        
        // 检查模块文件是否存在
        if (!fs.existsSync(modulePath)) {
            return { success: false, error: `模块文件不存在: ${modulePath}` };
        }
        
        // 清理可能的旧缓存
        clearModuleCache(modulePath);
        
        logger.info(`[热加载] 正在加载模块: ${moduleName}...`);
        
        // 动态加载模块
        const serviceModule = require(modulePath);
        
        // 获取 setup 函数
        const setupFunction = serviceModule[moduleConfig.setupFunction];
        if (typeof setupFunction !== 'function') {
            return { success: false, error: `模块 ${moduleName} 的 setup 函数不存在: ${moduleConfig.setupFunction}` };
        }
        
        // 生成初始化参数
        let moduleOptions = {};
        if (typeof moduleConfig.getOptions === 'function') {
            moduleOptions = moduleConfig.getOptions(runtimeContext.config, runtimeOptions.runtimeContext);
        }
        
        // 创建模块实例
        const instance = setupFunction(moduleOptions);
        moduleInstances[moduleName] = instance;
        
        // 添加到合并配置中（如果不存在）
        if (!mergedModuleConfigs.find(m => m.name === moduleName)) {
            mergedModuleConfigs.push(moduleConfig);
        }
        
        // 启动模块
        await bootstrapModule(instance, moduleConfig, runtimeContext);
        
        logger.info(`[热加载] 模块 ${moduleName} 加载成功`);
        
        return { 
            success: true, 
            data: { 
                name: moduleName, 
                status: 'loaded',
                source: 'user'
            } 
        };
        
    } catch (error) {
        logger.error(`[热加载] 加载模块 ${moduleName} 失败:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * 运行时卸载单个模块
 * @param {string} moduleName 模块名称
 * @returns {Object} 卸载结果 { success, data?, error? }
 */
async function unloadSingleModule(moduleName) {
    try {
        // 检查模块是否已加载
        const instance = moduleInstances[moduleName];
        if (!instance) {
            return { success: false, error: `模块 ${moduleName} 未加载` };
        }
        
        // 找到模块配置
        const moduleConfig = mergedModuleConfigs.find(m => m.name === moduleName);
        
        // 不允许卸载内置模块
        if (moduleConfig && moduleConfig.source !== 'user') {
            return { success: false, error: `不允许卸载内置模块: ${moduleName}` };
        }
        
        logger.info(`[热加载] 正在卸载模块: ${moduleName}...`);
        
        // 调用 stop 方法
        if (instance.stop && typeof instance.stop === 'function') {
            await instance.stop();
        }
        
        // 从实例映射中移除
        delete moduleInstances[moduleName];
        
        // 从启动顺序中移除
        const bootIndex = bootOrder.indexOf(moduleName);
        if (bootIndex !== -1) {
            bootOrder.splice(bootIndex, 1);
        }
        
        // 清理 require 缓存
        if (moduleConfig) {
            const modulePath = resolveModulePath(moduleConfig);
            clearModuleCache(modulePath);
        }
        
        logger.info(`[热加载] 模块 ${moduleName} 已卸载`);
        
        return { 
            success: true, 
            data: { 
                name: moduleName, 
                status: 'unloaded' 
            } 
        };
        
    } catch (error) {
        logger.error(`[热加载] 卸载模块 ${moduleName} 失败:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * 运行时重载单个模块（卸载后重新加载）
 * @param {string} moduleName 模块名称
 * @returns {Object} 重载结果 { success, data?, error? }
 */
async function reloadModule(moduleName) {
    try {
        logger.info(`[热加载] 正在重载模块: ${moduleName}...`);
        
        // 如果模块已加载，先卸载
        if (moduleInstances[moduleName]) {
            const unloadResult = await unloadSingleModule(moduleName);
            if (!unloadResult.success) {
                return unloadResult;
            }
        }
        
        // 重新加载
        const loadResult = await loadSingleModule(moduleName);
        if (!loadResult.success) {
            return loadResult;
        }
        
        logger.info(`[热加载] 模块 ${moduleName} 重载成功`);
        
        return { 
            success: true, 
            data: { 
                name: moduleName, 
                status: 'reloaded' 
            } 
        };
        
    } catch (error) {
        logger.error(`[热加载] 重载模块 ${moduleName} 失败:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * 获取所有已加载模块的状态信息
 * @returns {Array} 模块状态列表
 */
function getModulesStatus() {
    return mergedModuleConfigs.map(config => {
        const instance = moduleInstances[config.name];
        return {
            name: config.name,
            source: config.source || 'builtin',
            enabled: config.enabled !== false,
            loaded: !!instance,
            running: instance ? (instance.isRunning !== undefined ? instance.isRunning : true) : false,
            features: config.features || {}
        };
    });
}

/**
 * 获取单个模块实例
 * @param {string} name 模块名称
 * @returns {Object|null} 模块实例
 */
function getModule(name) {
    return moduleInstances[name] || null;
}

/**
 * 获取所有模块实例
 * @returns {Object} 模块实例映射
 */
function getAllModules() {
    return moduleInstances;
}

/**
 * 获取所有已加载的模块配置
 * @returns {Array} 模块配置数组
 */
function getModuleConfigs() {
    return mergedModuleConfigs;
}

/**
 * 获取运行时选项
 * @returns {Object} 运行时选项
 */
function getRuntimeOptions() {
    return runtimeOptions;
}

module.exports = {
    loadAllConfigs,
    getEnabledModules,
    initModules,
    bootstrapModules,
    shutdownModules,
    getModule,
    getAllModules,
    getModuleConfigs,
    getRuntimeOptions,
    reset,
    clearModuleCache,
    defaultPathResolver,
    // 热加载 API
    loadSingleModule,
    unloadSingleModule,
    reloadModule,
    getModulesStatus
};
