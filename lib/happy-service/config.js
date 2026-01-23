/**
 * Happy Service 配置模块
 * 
 * 为 deepseek-cowork 提供 Happy Service 配置
 * 支持环境变量和运行时配置
 * 
 * 创建时间: 2026-01-09
 */

const path = require('path');
const os = require('os');

/**
 * 默认配置
 */
const defaults = {
    // Happy 命令配置
    HAPPY_COMMAND: 'happy',
    HAPPY_ARGS: [],
    
    // 日志级别
    LOG_LEVEL: 'INFO',
    
    // 工作目录
    WORK_DIR: process.cwd(),
    
    // 是否使用 Daemon 模式
    USE_DAEMON: true,
    
    // Happy Home 目录
    HAPPY_HOME_DIR: path.join(os.homedir(), '.happy'),
    
    // Daemon 操作超时时间（毫秒）
    DAEMON_TIMEOUT: 15000,
    
    // Daemon 启动超时时间（毫秒）
    DAEMON_START_TIMEOUT: 30000,
    
    // Daemon 启动重试次数（增加到 3 次以应对网络超时问题）
    DAEMON_START_RETRIES: 3,
    
    // 服务运行模式
    SERVICE_MODE: 'session-manager',
    
    // 监控间隔（毫秒）
    MONITOR_INTERVAL: 30000,
    
    // 状态文件目录（null 表示使用默认）
    STATE_DIR: null,
    
    // 状态文件名
    STATE_FILE_NAME: '.happy-sessions.json',
    
    // Session 创建超时（毫秒）
    SESSION_CREATE_TIMEOUT: 60000,
    
    // HTTP 请求超时（毫秒）
    HTTP_TIMEOUT: 60000,
    
    // workDirs 配置
    WORK_DIRS: [{ name: 'main', path: '.' }]
};

/**
 * 从环境变量读取配置
 */
function loadFromEnv() {
    const config = { ...defaults };
    
    // Happy 命令
    if (process.env.HAPPY_COMMAND) {
        config.HAPPY_COMMAND = process.env.HAPPY_COMMAND;
    }
    
    // Happy 命令参数
    if (process.env.HAPPY_ARGS) {
        config.HAPPY_ARGS = process.env.HAPPY_ARGS.split(',').map(arg => arg.trim());
    }
    
    // 日志级别
    if (process.env.HAPPY_LOG_LEVEL) {
        config.LOG_LEVEL = process.env.HAPPY_LOG_LEVEL;
    }
    
    // 工作目录
    if (process.env.HAPPY_WORK_DIR) {
        config.WORK_DIR = process.env.HAPPY_WORK_DIR;
    }
    
    // Daemon 模式
    if (process.env.HAPPY_USE_DAEMON !== undefined) {
        config.USE_DAEMON = process.env.HAPPY_USE_DAEMON !== 'false';
    }
    
    // Happy Home 目录
    if (process.env.HAPPY_HOME_DIR) {
        config.HAPPY_HOME_DIR = process.env.HAPPY_HOME_DIR;
    }
    
    // Daemon 超时
    if (process.env.HAPPY_DAEMON_TIMEOUT) {
        config.DAEMON_TIMEOUT = parseInt(process.env.HAPPY_DAEMON_TIMEOUT, 10);
    }
    
    // Daemon 启动超时
    if (process.env.HAPPY_DAEMON_START_TIMEOUT) {
        config.DAEMON_START_TIMEOUT = parseInt(process.env.HAPPY_DAEMON_START_TIMEOUT, 10);
    }
    
    // Daemon 启动重试次数
    if (process.env.HAPPY_DAEMON_START_RETRIES) {
        config.DAEMON_START_RETRIES = parseInt(process.env.HAPPY_DAEMON_START_RETRIES, 10);
    }
    
    // 服务模式
    if (process.env.HAPPY_SERVICE_MODE) {
        config.SERVICE_MODE = process.env.HAPPY_SERVICE_MODE;
    }
    
    // 监控间隔
    if (process.env.HAPPY_MONITOR_INTERVAL) {
        config.MONITOR_INTERVAL = parseInt(process.env.HAPPY_MONITOR_INTERVAL, 10);
    }
    
    // 状态文件目录
    if (process.env.HAPPY_STATE_DIR) {
        config.STATE_DIR = process.env.HAPPY_STATE_DIR;
    }
    
    // workDirs 配置
    if (process.env.HAPPY_WORK_DIRS) {
        try {
            config.WORK_DIRS = JSON.parse(process.env.HAPPY_WORK_DIRS);
        } catch (e) {
            console.warn('[HappyService Config] Failed to parse HAPPY_WORK_DIRS:', e.message);
        }
    }
    
    return config;
}

/**
 * 配置类
 */
class Config {
    constructor() {
        // 从环境变量加载初始配置
        this._config = loadFromEnv();
    }
    
    /**
     * 获取配置值
     * @param {string} key 配置键
     * @returns {*} 配置值
     */
    get(key) {
        return this._config[key];
    }
    
    /**
     * 设置配置值
     * @param {string} key 配置键
     * @param {*} value 配置值
     */
    set(key, value) {
        this._config[key] = value;
    }
    
    /**
     * 合并配置
     * @param {Object} options 配置对象
     */
    merge(options = {}) {
        Object.assign(this._config, options);
    }
    
    /**
     * 获取所有配置
     * @returns {Object} 配置对象
     */
    getAll() {
        return { ...this._config };
    }
    
    // ============================================================================
    // 便捷属性访问器
    // ============================================================================
    
    get HAPPY_COMMAND() { return this._config.HAPPY_COMMAND; }
    get HAPPY_ARGS() { return this._config.HAPPY_ARGS; }
    get LOG_LEVEL() { return this._config.LOG_LEVEL; }
    get WORK_DIR() { return this._config.WORK_DIR; }
    get USE_DAEMON() { return this._config.USE_DAEMON; }
    get HAPPY_HOME_DIR() { return this._config.HAPPY_HOME_DIR; }
    get DAEMON_TIMEOUT() { return this._config.DAEMON_TIMEOUT; }
    get DAEMON_START_TIMEOUT() { return this._config.DAEMON_START_TIMEOUT; }
    get DAEMON_START_RETRIES() { return this._config.DAEMON_START_RETRIES; }
    get SERVICE_MODE() { return this._config.SERVICE_MODE; }
    get MONITOR_INTERVAL() { return this._config.MONITOR_INTERVAL; }
    get STATE_DIR() { return this._config.STATE_DIR; }
    get STATE_FILE_NAME() { return this._config.STATE_FILE_NAME; }
    get SESSION_CREATE_TIMEOUT() { return this._config.SESSION_CREATE_TIMEOUT; }
    get HTTP_TIMEOUT() { return this._config.HTTP_TIMEOUT; }
    get WORK_DIRS() { return this._config.WORK_DIRS; }
}

// 导出单例
module.exports = new Config();

// 同时导出类以便测试
module.exports.Config = Config;
module.exports.defaults = defaults;
