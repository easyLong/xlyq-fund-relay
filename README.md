# xlyq-fund-relay

手机端 Web 公募基金营销任务管理平台。

平台围绕“任务发布 → 兼职领取 → 内容发布 → 链接和截图提交 → 运营审核 → 积分结算”的闭环建设，同时支持基金公司维护对应基金的帖子原文和任务进度。

## 当前版本

当前为第一版 MVP，技术栈为 TypeScript 全栈：

- 前端：React 18、Vite、Ant Design Mobile、TanStack Query
- API：NestJS、Prisma
- 数据库：MySQL 8，InnoDB
- 运行方式：单体 API + H5 静态页面，可继续拆分为服务或迁移到其他前端容器
- API 默认端口：`3100`
- Web 默认端口：`5173`

## 已实现能力

- 运营账号登录、任务创建、发布、下架、提醒和任务详情查看
- 一个任务包含多条帖子，帖子数量决定执行名额；帖子唯一键为“基金公司 + 基金产品 + 任务名称 + 标题”
- 兼职账号按发布账号领取多条帖子，逐帖复制标题和正文、提交独立链接、截图及说明
- 兼职账号逐帖修改已提交资产
- 运营账号逐帖查看提交资产并审核通过或退回
- 兼职平台账号维护，仅展示平台和账号 ID，不展示账号密码
- 基金公司账号维护基金帖子和查看任务进度
- `fund1` 绑定“红土基金”，基金产品编码为 `DEMO-FUND-001`
- 任务、领取、提交、审核、通知、审计和领域事件的数据模型
- 基于登录角色和基金产品范围的后端数据权限校验

更完整的实现状态见：[docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)

## 本地运行

根目录 `.env` 配置数据库和端口：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=fund_relay
API_PORT=3100
WEB_PORT=5173
```

安装依赖并生成 Prisma Client：

```bash
npm install
npm run prisma:generate
```

启动 API 和 H5：

```bash
npm run dev
```

分别启动：

```bash
npm run dev:api
npm run dev:web
```

访问地址：

- H5：`http://localhost:5173`
- API 健康检查：`http://localhost:3100/api/v1/health`

手机访问电脑开发服务时，使用电脑局域网 IP，例如：`http://192.168.1.10:5173`。需要确保 Vite 监听局域网地址，并允许系统防火墙放行对应端口。

## 正式环境部署

正式环境请参考：[正式环境部署文档](docs/DEPLOYMENT.md)，其中包含 MySQL 初始化、增量迁移、生产环境变量、PM2、Nginx、HTTPS 和上线验收流程。

## 演示账号

首次打开页面会调用 `/api/v1/demo/bootstrap` 初始化或修正演示数据。

| 账号 | 角色 | 数据范围 |
| --- | --- | --- |
| `admin` | 运营 | 查看和管理全部任务 |
| `staff1` | 兼职 | 领取、发布和提交自己的任务 |
| `staff2` | 兼职 | 领取、发布和提交自己的任务 |
| `staff3` | 兼职 | 领取、发布和提交自己的任务 |
| `fund1` | 基金公司 | 仅查看和维护红土基金内容 |

演示密码：`123456`。

## 数据库迁移

项目使用增量 SQL 迁移，不建议对已有远程数据库执行 `prisma db push`，避免影响未纳入本地 MVP 的历史表。

执行迁移示例：

```bash
cd apps/api
node scripts/with-database-url.mjs prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260814_fund_account_scope.sql
node scripts/with-database-url.mjs prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260814_workflow_foundation.sql
```

当前核心表包括：

- `organizations`：机构
- `users`：账号、角色和基金绑定
- `fund_products`：基金产品
- `tasks`：营销任务
- `task_claims`：兼职领取记录
- `task_submissions`：任务提交材料
- `executor_accounts`：兼职发布账号
- `fund_task_posts`：基金帖子原文和发布内容
- `fund_tasks`：基金任务进度
- `task_status_history`：任务状态历史
- `claim_status_history`：领取状态历史
- `task_reviews`：审核记录
- `notifications`：通知记录
- `audit_logs`：审计日志
- `domain_events`：领域事件和重试记录

附件文件表暂未建设，符合当前“文件先不要”的范围约束。

## 主要接口

```text
POST /api/v1/auth/login
POST /api/v1/demo/bootstrap
GET  /api/v1/health

GET  /api/v1/tasks
GET  /api/v1/task-market
GET  /api/v1/tasks/:id
POST /api/v1/tasks
POST /api/v1/tasks/:id/publish
POST /api/v1/tasks/:id/unpublish
POST /api/v1/tasks/:id/remind
POST /api/v1/tasks/:id/claims

POST /api/v1/task-submissions
PUT  /api/v1/task-submissions/:id
POST /api/v1/task-submissions/:id/review

GET  /api/v1/fund-posts
GET  /api/v1/fund-posts/progress
POST /api/v1/fund-posts
PUT  /api/v1/fund-posts/:id
```

## 验证命令

```bash
npm run typecheck
npm run build
```

当前 API 健康检查会同时验证数据库连接。生产部署前还需要补充对象存储、正式登录、消息通知和发布平台接口配置。

## 设计文档

- [产品与项目设计](docs/PROJECT_DESIGN.md)
- [系统架构设计](docs/ARCHITECTURE_DESIGN.md)
- [任务跟踪架构设计](docs/TASK_TRACKING_ARCHITECTURE_DESIGN.md)
- [运营工作台设计](docs/OPERATOR_WORKBENCH_DESIGN.md)
- [兼职工作台设计](docs/PART_TIME_WORKBENCH_DESIGN.md)
- [首页设计](docs/HOMEPAGE_DESIGN.md)
- [技术选型](docs/TECH_STACK_SELECTION.md)
- [当前实现状态](docs/IMPLEMENTATION_STATUS.md)
