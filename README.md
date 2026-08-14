# xlyq-task-ops

手机端 Web 公募基金营销任务管理平台。

当前阶段：项目设计。

设计基线见 [docs/PROJECT_DESIGN.md](docs/PROJECT_DESIGN.md)。
详细架构见 [docs/ARCHITECTURE_DESIGN.md](docs/ARCHITECTURE_DESIGN.md)。
技术选型见 [docs/TECH_STACK_SELECTION.md](docs/TECH_STACK_SELECTION.md)。

## 设计原则

- 围绕任务单层模型设计，不单独建设需求池。
- 面向公募基金营销场景，任务必须关联机构、平台等业务信息。
- 任务状态和责任边界明确，所有关键变化可追溯。
- 先以模块化单体交付 MVP，再根据实际吞吐和团队边界拆分服务。
- 核心领域规则集中在领域层，避免散落在控制器和页面中。
- 运营指标由事件和审计记录支撑，而不是依赖手工维护的统计字段。
# xlyq-fund-relay

## 第一版运行

根目录 `.env` 配置 `MYSQL_*`、`API_PORT`、`WEB_PORT`。端口不写死在业务代码中。

```bash
npm run prisma:generate -w @xlyq/api
npm run dev
```

首次使用任务跟踪 MVP 时，执行增量 SQL：

```bash
cd apps/api
node scripts/with-database-url.mjs prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260813_task_flow_v1.sql
```

远端数据库已有历史业务表，部署时不要对该库执行 `prisma db push`，避免删除未纳入本地 MVP schema 的旧表。

账号与基金帖子功能需要执行新增迁移：

```bash
cd apps/api
node scripts/with-database-url.mjs prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260813_executor_accounts_and_fund_posts.sql
```

兼职者需要先在“我的”中维护各平台发布账号；每个启用账号可承载一个对应平台的进行中任务。基金人员使用 `fund1 / 123456` 登录，在首页填报任务名称和帖子，运营创建任务时选择对应帖子配置。

浏览器打开 `http://localhost:<WEB_PORT>`；手机和电脑不在同一设备时使用电脑局域网 IP 加端口访问。
