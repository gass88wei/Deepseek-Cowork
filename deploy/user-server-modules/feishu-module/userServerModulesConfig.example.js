/**
 * 飞书模块配置示例
 * 
 * 将此文件复制到用户模块配置目录：
 * - Windows: %APPDATA%/deepseek-cowork/userServerModulesConfig.js
 * - macOS: ~/Library/Application Support/deepseek-cowork/userServerModulesConfig.js
 * - Linux: ~/.config/deepseek-cowork/userServerModulesConfig.js
 */

module.exports = {
    modules: [
        {
            name: 'feishu-module',
            module: './feishu-module',
            setupFunction: 'setupFeishuModuleService',
            enabled: true,
            features: {
                hasRoutes: true,
                hasStatic: true,
                emitsEvents: true
            },
            // 注入核心服务和飞书配置
            getOptions: (config, runtimeContext) => ({
                // 核心服务
                HappyService: runtimeContext?.services?.HappyService,
                MessageStore: runtimeContext?.services?.MessageStore,
                secureSettings: runtimeContext?.services?.secureSettings,
                
                // 飞书配置（从 config/local.js 或 config/default.js 读取）
                feishuConfig: config.feishu || {}
            }),
            
            // 事件监听（可选）
            events: {
                started: ({ name, version }) => {
                    console.log(`[飞书模块] 已启动: ${name} v${version}`);
                },
                'feishu:connected': (state) => {
                    console.log(`[飞书模块] 已连接`);
                },
                'feishu:disconnected': (state) => {
                    console.log(`[飞书模块] 已断开`);
                }
            }
        }
    ]
};
