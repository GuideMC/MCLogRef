<p align="center">
  <h1 align="center">MCLogRef</h1>
  <p align="center">以 <b>RAG + LLM</b> 为核心的 Minecraft 崩溃报告 / 游戏日志分析工具，拖入日志，自动给出可读的解决方案。</p>
  <p align="center">
    <img alt="Stars" src="https://img.shields.io/github/stars/GuideMC/MCLogRef?style=flat&logo=github&label=Stars">
    <img alt="Docker" src="https://img.shields.io/github/actions/workflow/status/GuideMC/MCLogRef/docker.yml?branch=master&label=Docker%20镜像">
    <img alt="Nuxt" src="https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt&logoColor=white">
    <img alt="Vue" src="https://img.shields.io/badge/Vue-3.x-42b883?logo=vuedotjs&logoColor=white">
    <img alt="Node" src="https://img.shields.io/badge/Node-22+-339933?logo=nodedotjs&logoColor=white">
    <img alt="Language" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  </p>
</p>

## 简介

MCLogRef 分析 Minecraft 崩溃报告与游戏日志：上传启动器导出的 TXT/LOG 日志或 ZIP 崩溃包后，自动提取模组列表、报错堆栈等元数据，将报错特征向量化后存入本地向量数据库，基于语义 + 关键词混合检索召回历史案例与知识库，最终由 Agent 调用网页搜索、GitHub、Modrinth 等工具自主查阅资料，生成结构化的分析结果与解决方案。

## ✨ 特性

- **拖拽即析**：支持 TXT / LOG 原始日志与启动器导出的 ZIP 崩溃包，点击或拖拽上传
- **RAG 检索**：LanceDB 向量库 + SQLite 案例库，语义相似度与关键词混合召回
- **Agent 分析**：大模型自主调用网页搜索、GitHub Issue/代码搜索、源码查阅、Modrinth 搜索等工具
- **流式输出**：结果以 Markdown 流式渲染，边分析边查看
- **本地优先**：数据与配置全部存储在本地 `data` 目录，不上传第三方
- **自定义模型**：支持任意 OpenAI 兼容 API（转发服务、本地模型均可）

## 🚀 开始

环境要求：Node.js ≥ 22，pnpm ≥ 9

```bash
pnpm install
cp .env.example .env   # 填入 API_URL / API_KEY / API_MODEL
pnpm dev               # 打开 http://localhost:3000
```

## ⚙️ 配置

配置优先级：环境变量 > `data/config.json`（界面「选项」页可维护）> 默认值。

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `API_URL` | LLM API 地址（OpenAI 兼容） | 空 |
| `API_KEY` | LLM API 密钥 | 空 |
| `API_MODEL` | 模型名称 | 空 |
| `API_TEMPERATURE` | 采样温度 | 0.2 |
| `DATA_DIR` | 数据目录（SQLite / LanceDB / 配置） | `./data` |
| `ADMIN_SECRET` | 管理令牌，登录「选项 / 状态」页使用 | 空 |
| `TEXT_CHUNK_SIZE` | 文本分块大小 | 6144 |
| `CHUNK_OFFSET` | 分块重叠长度 | 2048 |
| `SEARCH_LIMIT` / `SEARCH_CANDIDATE` | 相似案例召回数 / 候选数 | 5 / 64 |
| `SEMANTIC_WEIGHT` | 语义相似度权重 | 0.6 |
| `EMBEDDING_HOST` | 嵌入模型服务地址 | 空 |
| `PROXY_URL` | 全局出站代理（如 `http://127.0.0.1:7890`） | 空 |
| `GITHUB_TOKEN` | GitHub 搜索工具令牌（也可在「选项」页配置） | 空 |

## 📦 部署

### Node

```bash
pnpm install --frozen-lockfile
pnpm build
HOST=0.0.0.0 PORT=3000 DATA_DIR=/var/lib/mclogref NODE_ENV=production node .output/server/index.mjs
```

### Docker（推荐）

```bash
docker build -t ghcr.io/guidemc/mclogref:latest .
docker run -d --name mclogref \
  -p 3000:3000 \
  -v /var/lib/mclogref:/app/data \
  -e API_URL=https://api.example.com/v1 \
  -e API_KEY=sk-xxx \
  -e API_MODEL=gpt-4o-mini \
  -e ADMIN_SECRET=your-secret \
  ghcr.io/guidemc/mclogref:latest
```
