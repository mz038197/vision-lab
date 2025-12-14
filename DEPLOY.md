# 🚀 Render 部署清单

## ✅ 已完成的修改

### 1. **后端服务器 (server.js)**
- ✅ 添加了生产环境检测
- ✅ 在生产环境下自动服务前端静态文件
- ✅ 配置了 catch-all 路由用于 React Router

### 2. **Package.json**
- ✅ 添加了 `start` 脚本用于生产环境
- ✅ 添加了 `render:build` 脚本用于 Render 构建
- ✅ 将构建依赖移到 dependencies（Render 需要）

### 3. **Render 配置 (render.yaml)**
- ✅ 配置了 Web Service 类型
- ✅ 设置了构建和启动命令
- ✅ 配置了健康检查端点
- ✅ 设置了环境变量

### 4. **Node.js 版本 (.nvmrc)**
- ✅ 指定 Node.js 18 版本

### 5. **文档更新 (README.md)**
- ✅ 添加了详细的 Render 部署说明
- ✅ 包含了手动和自动部署步骤
- ✅ 添加了故障排除指南

## 📋 部署前检查清单

- [ ] 代码已推送到 GitHub
- [ ] 已获取 Gemini API Key
- [ ] 已创建 Render 账号
- [ ] 确认所有依赖都在 dependencies 中

## 🎯 部署步骤

### 方法一：使用 Blueprint（推荐）

1. 将代码推送到 GitHub
2. 登录 [Render Dashboard](https://dashboard.render.com/)
3. 点击 "New +" → "Blueprint"
4. 连接 GitHub 仓库
5. 在环境变量中设置 `GEMINI_API_KEY`
6. 点击部署

### 方法二：手动创建服务

1. 登录 [Render Dashboard](https://dashboard.render.com/)
2. 点击 "New +" → "Web Service"
3. 连接 GitHub 仓库
4. 配置：
   - **Build Command**: `npm run render:build`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. 添加环境变量：
   - `NODE_ENV` = `production`
   - `GEMINI_API_KEY` = 你的 API key
6. 点击创建服务

## 🔍 验证部署

部署完成后，访问你的 Render URL 并测试：

1. ✅ 网站能正常加载
2. ✅ 相机功能正常
3. ✅ 手势识别正常
4. ✅ AI 图片编辑功能正常（这会调用后端 API）

## 🌐 访问应用

- **生产环境**: `https://your-app-name.onrender.com`
- **健康检查**: `https://your-app-name.onrender.com/api/health`

## ⚠️ 注意事项

1. **免费方案限制**:
   - 服务闲置 15 分钟后会休眠
   - 首次访问需要 30-50 秒唤醒
   - 每月有 750 小时免费时数

2. **环境变量**:
   - 确保在 Render 中正确设置 `GEMINI_API_KEY`
   - 不要在代码中硬编码 API key

3. **构建时间**:
   - 首次构建可能需要 5-10 分钟
   - Vite 构建 + npm 安装依赖

4. **相机权限**:
   - 需要 HTTPS 才能使用相机功能
   - Render 自动提供 HTTPS

## 🐛 常见问题

### 问题：构建失败
**解决方案**:
- 检查 Node.js 版本（需要 18+）
- 确认所有依赖都正确安装
- 查看 Render 构建日志

### 问题：API 调用失败
**解决方案**:
- 检查 `GEMINI_API_KEY` 环境变量是否设置
- 验证 API key 是否有效
- 查看服务器日志

### 问题：页面刷新 404
**解决方案**:
- 确认 server.js 中有 catch-all 路由
- 检查静态文件服务配置

## 📞 支持

如果遇到问题：
1. 查看 Render 服务日志
2. 访问 `/api/health` 检查后端状态
3. 检查浏览器控制台错误

