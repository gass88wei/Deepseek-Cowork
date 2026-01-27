# Demo Module - 演示模块

展示 deepseek-cowork 自定义模块的完整功能和开发模式。

## 功能

- **静态页面服务**: 提供介绍自定义模块功能的 HTML 页面
- **API 接口示例**: 状态查询、Echo 接口、模块信息
- **标准生命周期**: 实现 init/setupRoutes/start/stop 接口

## API 接口

| 路由 | 方法 | 说明 |
|------|------|------|
| `/demo/` | GET | 介绍页面 |
| `/api/demo/status` | GET | 获取模块运行状态 |
| `/api/demo/echo` | POST | Echo 请求体 |
| `/api/demo/info` | GET | 获取模块详细信息 |

## 部署

```bash
# 部署演示模块到用户数据目录
node deploy/index.js module demo-module

# 重启服务后访问
# http://localhost:3000/demo/
```

## 文件结构

```
demo-module/
├── index.js           # 模块入口
├── static/
│   └── index.html     # 介绍页面
└── README.md          # 本文件
```

## 模块配置

部署后会自动在 `userServerModulesConfig.js` 中添加以下配置：

```javascript
{
    name: 'demo-module',
    module: './demo-module',
    setupFunction: 'setupDemoModuleService',
    enabled: true,
    features: {
        hasRoutes: true,
        hasStatic: true
    }
}
```

## 开发参考

此模块可作为开发自定义模块的参考模板。关键点：

1. **导出 setup 函数**: `module.exports = { setupDemoModuleService }`
2. **继承 EventEmitter**: 支持事件发射
3. **实现标准接口**: init, setupRoutes, start, stop
4. **路由注册**: 在 setupRoutes 中使用 Express app 注册路由

详细开发指南请参考模块介绍页面或项目文档。
