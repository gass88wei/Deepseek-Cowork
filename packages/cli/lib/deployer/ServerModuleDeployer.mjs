/**
 * Server Module Deployer
 * 部署服务器模块到用户数据目录
 * 
 * 创建时间: 2026-01-28
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { getMessages } from './messages.mjs';
import {
    USER_SERVER_MODULES_DIR,
    USER_MODULES_DIR_NAME,
    USER_MODULES_CONFIG_NAME,
    getUserDataDir
} from './paths.mjs';

// 创建 require 函数用于加载用户配置（CommonJS）
const require = createRequire(import.meta.url);

export class ServerModuleDeployer {
    /**
     * @param {string} lang - 语言代码 ('en' | 'zh')
     */
    constructor(lang = 'en') {
        this.lang = lang;
        this.msg = getMessages(lang);
        this.userDataDir = getUserDataDir();
        this.userModulesDir = path.join(this.userDataDir, USER_MODULES_DIR_NAME);
        this.userConfigPath = path.join(this.userDataDir, USER_MODULES_CONFIG_NAME);
    }

    /**
     * 日志输出
     */
    log(level, message) {
        const styles = {
            info: chalk.blue,
            success: chalk.green,
            warn: chalk.yellow,
            error: chalk.red
        };
        const style = styles[level] || chalk.white;
        console.log(style(message));
    }

    /**
     * 确保目录存在
     */
    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * 递归复制目录
     */
    copyDirRecursive(src, dest) {
        this.ensureDir(dest);
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyDirRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * 列出可用模块模板
     */
    listModules() {
        console.log('\n' + chalk.bold(`=== ${this.msg.moduleListTitle} ===`) + '\n');

        if (!fs.existsSync(USER_SERVER_MODULES_DIR)) {
            this.log('warn', this.msg.moduleSourceNotFound(USER_SERVER_MODULES_DIR));
            return;
        }

        const modules = fs.readdirSync(USER_SERVER_MODULES_DIR, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
            .map(entry => entry.name);

        if (modules.length === 0) {
            this.log('info', 'No modules available');
            return;
        }

        for (const moduleName of modules) {
            const modulePath = path.join(USER_SERVER_MODULES_DIR, moduleName);
            const readmePath = path.join(modulePath, 'README.md');
            const indexPath = path.join(modulePath, 'index.js');
            
            let description = '';
            if (fs.existsSync(readmePath)) {
                const content = fs.readFileSync(readmePath, 'utf8');
                const firstLine = content.split('\n').find(line => line.trim() && !line.startsWith('#'));
                if (firstLine) {
                    description = firstLine.trim().substring(0, 60);
                }
            }

            const hasIndex = fs.existsSync(indexPath);
            const icon = hasIndex ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${icon} ${chalk.bold(moduleName)}`);
            if (description) {
                console.log(chalk.dim(`     ${description}`));
            }
        }

        console.log(`\n${chalk.dim(this.msg.userDataDir(this.userDataDir))}\n`);
    }

    /**
     * 从内置模板部署模块
     * @param {string} moduleName - 模块名称
     */
    async deployModule(moduleName) {
        const sourcePath = path.join(USER_SERVER_MODULES_DIR, moduleName);
        return this.deployFromPath(sourcePath, moduleName);
    }

    /**
     * 从指定路径部署模块
     * @param {string} sourcePath - 模块源路径
     * @param {string} moduleName - 模块名称（可选，默认使用目录名）
     */
    async deployFromPath(sourcePath, moduleName = null) {
        // 如果未指定模块名，使用目录名
        if (!moduleName) {
            moduleName = path.basename(sourcePath);
        }

        const destPath = path.join(this.userModulesDir, moduleName);

        // 检查源路径是否存在
        if (!fs.existsSync(sourcePath)) {
            this.log('error', this.msg.moduleNotFound(moduleName));
            console.log(chalk.dim(`  Source path: ${sourcePath}`));
            return false;
        }

        // 检查是否已部署
        if (fs.existsSync(destPath)) {
            this.log('warn', this.msg.moduleAlreadyDeployed(moduleName));
            return false;
        }

        const spinner = ora(this.msg.moduleDeploying(moduleName)).start();

        try {
            // 确保用户数据目录存在
            this.ensureDir(this.userModulesDir);

            // 复制模块文件
            this.copyDirRecursive(sourcePath, destPath);

            // 检查是否有 package.json，如果有则安装依赖
            const packageJsonPath = path.join(destPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                spinner.text = `Installing dependencies for ${moduleName}...`;
                await this.installDependencies(destPath);
            }

            // 更新配置文件
            this.updateConfig(moduleName, 'add');

            spinner.succeed(this.msg.moduleDeployComplete(moduleName));
            
            // 尝试热加载
            await this.tryHotLoad(moduleName);
            
            console.log(`\n${chalk.dim(this.msg.userDataDir(this.userDataDir))}\n`);

            return true;
        } catch (error) {
            spinner.fail(`Deploy failed: ${error.message}`);
            return false;
        }
    }

    /**
     * 安装模块依赖
     * @param {string} modulePath - 模块目录路径
     * @returns {Promise<void>}
     */
    async installDependencies(modulePath) {
        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';
            const npmCmd = isWindows ? 'npm.cmd' : 'npm';
            
            const npmProcess = spawn(npmCmd, ['install', '--production'], {
                cwd: modulePath,
                stdio: 'pipe',
                shell: isWindows, // Windows 上需要 shell
                windowsHide: true
            });
            
            let stdout = '';
            let stderr = '';
            
            npmProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            npmProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            npmProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    // npm install 失败不应该阻止部署，只记录警告
                    console.log(chalk.yellow(`\n警告: npm install 失败 (退出码: ${code})`));
                    console.log(chalk.dim('你可以稍后手动运行: npm install'));
                    if (stderr) {
                        console.log(chalk.dim(stderr));
                    }
                    resolve(); // 仍然继续部署流程
                }
            });
            
            npmProcess.on('error', (error) => {
                // 如果找不到 npm，给出提示但不阻止部署
                console.log(chalk.yellow(`\n警告: 无法执行 npm install: ${error.message}`));
                console.log(chalk.dim('请确保已安装 Node.js 和 npm'));
                console.log(chalk.dim('你可以稍后手动运行: npm install'));
                resolve(); // 继续部署流程
            });
        });
    }

    /**
     * 尝试通过 API 热加载模块
     */
    async tryHotLoad(moduleName) {
        const apiUrl = 'http://localhost:3333/api/modules/load';
        
        try {
            this.log('info', this.msg.hotLoadAttempting(moduleName));
            
            const result = await new Promise((resolve, reject) => {
                const postData = JSON.stringify({ name: moduleName });
                
                const req = http.request(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    timeout: 5000
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error(`Invalid response: ${data}`));
                        }
                    });
                });
                
                req.on('error', (err) => {
                    if (err.code === 'ECONNREFUSED') {
                        resolve({ skipped: true });
                    } else {
                        reject(err);
                    }
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    resolve({ skipped: true });
                });
                
                req.write(postData);
                req.end();
            });
            
            if (result.skipped) {
                this.log('info', this.msg.hotLoadSkipped);
                this.log('info', this.msg.restartHint);
            } else if (result.success) {
                this.log('success', this.msg.hotLoadSuccess(moduleName));
            } else {
                this.log('warn', this.msg.hotLoadFailed(moduleName, result.error));
                this.log('info', this.msg.restartHint);
            }
            
        } catch (error) {
            this.log('warn', this.msg.hotLoadFailed(moduleName, error.message));
            this.log('info', this.msg.restartHint);
        }
    }

    /**
     * 移除已部署的模块
     */
    async removeModule(moduleName) {
        const modulePath = path.join(this.userModulesDir, moduleName);

        if (!fs.existsSync(modulePath)) {
            this.log('error', this.msg.moduleNotDeployed(moduleName));
            return false;
        }

        const spinner = ora(`Removing ${moduleName}...`).start();

        try {
            // 移除模块目录
            fs.rmSync(modulePath, { recursive: true, force: true });

            // 更新配置文件
            this.updateConfig(moduleName, 'remove');

            spinner.succeed(this.msg.moduleRemoved(moduleName));
            this.log('info', this.msg.restartHint);

            return true;
        } catch (error) {
            spinner.fail(`Remove failed: ${error.message}`);
            return false;
        }
    }

    /**
     * 显示已部署模块状态
     */
    moduleStatus() {
        console.log('\n' + chalk.bold(`=== ${this.msg.moduleStatusTitle} ===`) + '\n');
        console.log(chalk.dim(`${this.msg.userDataDir(this.userDataDir)}\n`));

        if (!fs.existsSync(this.userModulesDir)) {
            this.log('info', this.msg.noModulesDeployed);
            return;
        }

        const modules = fs.readdirSync(this.userModulesDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);

        if (modules.length === 0) {
            this.log('info', this.msg.noModulesDeployed);
            return;
        }

        // 读取配置获取启用状态
        let configModules = {};
        if (fs.existsSync(this.userConfigPath)) {
            try {
                // 清除 require 缓存以获取最新配置
                delete require.cache[require.resolve(this.userConfigPath)];
                const config = require(this.userConfigPath);
                if (config.modules) {
                    config.modules.forEach(m => {
                        configModules[m.name] = m.enabled !== false;
                    });
                }
            } catch (err) {
                this.log('warn', `Failed to read config: ${err.message}`);
            }
        }

        for (const moduleName of modules) {
            const modulePath = path.join(this.userModulesDir, moduleName);
            const indexPath = path.join(modulePath, 'index.js');
            const hasIndex = fs.existsSync(indexPath);
            const enabled = configModules[moduleName] !== false;
            
            let statusIcon, statusText;
            if (hasIndex) {
                statusIcon = enabled ? chalk.green('✓') : chalk.yellow('⏸');
                statusText = enabled ? chalk.green('enabled') : chalk.yellow('disabled');
            } else {
                statusIcon = chalk.red('✗');
                statusText = chalk.red('invalid');
            }
            
            console.log(`  ${statusIcon} ${chalk.bold(moduleName)} (${statusText})`);
        }

        console.log('');
    }

    /**
     * 更新用户模块配置文件
     */
    updateConfig(moduleName, action) {
        this.ensureDir(this.userDataDir);

        let config = { modules: [] };

        // 读取现有配置
        if (fs.existsSync(this.userConfigPath)) {
            try {
                delete require.cache[require.resolve(this.userConfigPath)];
                config = require(this.userConfigPath);
            } catch (err) {
                // 配置文件可能损坏，重新开始
                config = { modules: [] };
            }
        }

        if (!config.modules) {
            config.modules = [];
        }

        if (action === 'add') {
            // 检查模块是否已在配置中
            const existingIndex = config.modules.findIndex(m => m.name === moduleName);
            if (existingIndex === -1) {
                const modulePath = path.join(this.userModulesDir, moduleName);
                const indexPath = path.join(modulePath, 'index.js');
                const packageJsonPath = path.join(modulePath, 'package.json');
                
                // 读取 package.json 获取模块配置
                let packageConfig = null;
                if (fs.existsSync(packageJsonPath)) {
                    try {
                        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                        packageConfig = packageJson['deepseek-cowork'] || null;
                    } catch (err) {
                        // package.json 解析失败，忽略
                    }
                }
                
                // 读取模块获取 setup 函数名
                let setupFunction = `setup${this.toPascalCase(moduleName)}Service`;
                if (packageConfig?.setupFunction) {
                    setupFunction = packageConfig.setupFunction;
                } else if (fs.existsSync(indexPath)) {
                    const content = fs.readFileSync(indexPath, 'utf8');
                    const match = content.match(/module\.exports\s*=\s*\{\s*(\w+)/);
                    if (match) {
                        setupFunction = match[1];
                    }
                }

                // 读取 features 配置
                let features = {
                    hasRoutes: true,
                    hasStatic: false
                };
                if (packageConfig?.features) {
                    features = { ...features, ...packageConfig.features };
                } else if (fs.existsSync(indexPath)) {
                    // 检查是否有静态目录
                    const staticDir = path.join(modulePath, 'static');
                    if (fs.existsSync(staticDir)) {
                        features.hasStatic = true;
                    }
                }

                // 检查模块是否需要核心服务注入
                // 通过检测 options.HappyService 或 options.MessageStore 的使用
                let needsCoreServices = false;
                if (fs.existsSync(indexPath)) {
                    const content = fs.readFileSync(indexPath, 'utf8');
                    needsCoreServices = content.includes('options.HappyService') || 
                                        content.includes('options.MessageStore') ||
                                        content.includes('options.MemoryManager');
                }

                // 检查是否需要自定义 getOptions
                let customGetOptions = null;
                if (packageConfig?.getOptions) {
                    customGetOptions = packageConfig.getOptions;
                }

                const moduleConfig = {
                    name: moduleName,
                    module: `./${moduleName}`,
                    setupFunction: setupFunction,
                    enabled: true,
                    features: features
                };
                
                // 标记需要核心服务注入（在序列化时使用）
                if (needsCoreServices) {
                    moduleConfig._needsCoreServices = true;
                }
                
                // 标记自定义 getOptions（在序列化时使用）
                if (customGetOptions) {
                    moduleConfig._customGetOptions = customGetOptions;
                }

                config.modules.push(moduleConfig);
            }
        } else if (action === 'remove') {
            config.modules = config.modules.filter(m => m.name !== moduleName);
        }

        // 写入配置文件（使用字符串模板以支持函数定义）
        const configContent = this.generateConfigFile(config);
        fs.writeFileSync(this.userConfigPath, configContent, 'utf8');
        this.log('success', this.msg.moduleConfigUpdated);
    }

    /**
     * 生成配置文件内容
     * 支持生成包含函数的配置（如 getOptions）
     */
    generateConfigFile(config) {
        const moduleConfigs = config.modules.map(m => {
            const featuresObj = {
                hasRoutes: m.features?.hasRoutes ?? true,
                hasStatic: m.features?.hasStatic ?? false
            };
            const featuresStr = `{
                hasRoutes: ${featuresObj.hasRoutes},
                hasStatic: ${featuresObj.hasStatic}
            }`;
            
            // 如果模块有自定义 getOptions，优先使用
            if (m._customGetOptions) {
                const getOptionsStr = typeof m._customGetOptions === 'string' 
                    ? this.generateGetOptionsFromString(m._customGetOptions, m.name)
                    : JSON.stringify(m._customGetOptions);
                
                return `        {
            name: '${m.name}',
            module: '${m.module}',
            setupFunction: '${m.setupFunction}',
            enabled: ${m.enabled},
            features: ${featuresStr},
            getOptions: ${getOptionsStr}
        }`;
            }
            // 如果模块需要核心服务，生成带 getOptions 的配置
            else if (m._needsCoreServices) {
                return `        {
            name: '${m.name}',
            module: '${m.module}',
            setupFunction: '${m.setupFunction}',
            enabled: ${m.enabled},
            features: ${featuresStr},
            // 注入核心服务（通过 runtimeContext.services）
            getOptions: (config, runtimeContext) => ({
                HappyService: runtimeContext?.services?.HappyService,
                MessageStore: runtimeContext?.services?.MessageStore
            })
        }`;
            } else {
                // 普通模块配置
                return `        {
            name: '${m.name}',
            module: '${m.module}',
            setupFunction: '${m.setupFunction}',
            enabled: ${m.enabled},
            features: ${featuresStr}
        }`;
            }
        }).join(',\n');

        return `/**
 * User Server Modules Configuration
 * Auto-generated by deploy script
 * 
 * You can manually edit this file to:
 * - Enable/disable modules
 * - Add custom module configurations
 * - Override module options
 * 
 * Core services available in runtimeContext.services:
 * - HappyService: AI communication service
 * - MessageStore: Message persistence
 * - MemoryManager: Memory management (class, needs instantiation)
 */

module.exports = {
    modules: [
${moduleConfigs}
    ]
};
`;
    }

    /**
     * 从字符串生成 getOptions 函数
     * 例如: "userDataPath,dbPath" -> (config, runtimeContext) => ({ userDataPath: ..., dbPath: ... })
     * @param {string} optionsStr - 选项字符串，例如 "userDataPath,dbPath"
     * @param {string} moduleName - 模块名称
     */
    generateGetOptionsFromString(optionsStr, moduleName) {
        // 解析选项字符串，例如 "userDataPath,dbPath"
        const options = optionsStr.split(',').map(s => s.trim()).filter(s => s);
        
        // 生成函数体
        const optionsObj = options.map(opt => {
            if (opt === 'userDataPath') {
                return `                userDataPath: runtimeContext?.userDataPath`;
            } else if (opt === 'dbPath') {
                return `                dbPath: config?.${moduleName}?.dbPath`;
            } else {
                // 默认从 runtimeContext 获取
                return `                ${opt}: runtimeContext?.${opt}`;
            }
        }).join(',\n');
        
        return `(config, runtimeContext) => ({
${optionsObj}
            })`;
    }

    /**
     * 转换字符串为 PascalCase
     */
    toPascalCase(str) {
        return str
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }
}

export { getUserDataDir };
export default ServerModuleDeployer;
