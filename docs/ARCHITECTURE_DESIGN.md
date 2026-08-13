# xlyq-fund-relay 架构设计

> 版本：v0.1  
> 日期：2026-08-06  
> 范围：MVP 到 M3 的系统架构、模块边界、数据流和落地约束

## 1. 架构目标

xlyq-fund-relay 首版采用模块化单体架构。系统先围绕“公募基金营销任务”的完整闭环交付，避免过早拆成多个服务；后续当任务量、团队边界或部署诉求变清晰后，再按模块边界拆分。

核心目标：

- 任务创建、发布、领取、提交、审核、返工、关闭全链路可追溯。
- 运营、机构、普通用户三类角色共用一套领域模型，通过权限和数据范围隔离。
- 状态变更只能由后端领域服务执行，前端只展示可操作动作。
- 审计、通知、看板指标由事件和记录驱动，避免依赖人工维护统计字段。
- 文件、通知、统计等非核心流程与主交易流程解耦，不影响任务主链路成功率。

## 2. 总体分层

```text
Mobile Web
  |
  | HTTPS / JSON
  v
API Gateway / BFF
  |
  +-- Auth Guard
  +-- Permission Guard
  +-- Request Validation
  |
  v
Application Services
  |
  +-- Task Application Service
  +-- Review Application Service
  +-- Dashboard Application Service
  +-- Notification Application Service
  |
  v
Domain Layer
  |
  +-- Task Aggregate
  +-- TaskClaim Aggregate
  +-- Submission
  +-- Review
  +-- Organization
  +-- Notification
  |
  v
Infrastructure
  |
  +-- MySQL
  +-- Redis
  +-- Object Storage
  +-- Background Workers
```

### 2.1 前端

前端采用 React + TypeScript + Vite，优先适配手机端 Web。首版不拆多端应用，按角色切换页面能力。

建议目录：

```text
src/
  app/                 # 路由、全局状态、鉴权入口
  pages/
    operator/          # 运营端页面
    organization/      # 机构端页面
    user/              # 普通用户页面
  features/
    tasks/
    claims/
    reviews/
    dashboards/
    notifications/
  components/          # 通用 UI 组件
  services/            # API client
  models/              # 前端类型
  utils/
```

前端不保存业务真相，所有关键状态以接口返回为准。列表页可以使用筛选参数和分页状态，详情页进入时重新拉取最新数据。

### 2.2 后端

后端推荐 TypeScript + NestJS，也可以替换为团队已有同等模块化框架。后端按照“模块内高内聚、模块间通过应用服务交互”的方式组织。

建议目录：

```text
src/
  modules/
    tasks/
      application/
      domain/
      infra/
      tasks.controller.ts
      tasks.module.ts
    reviews/
    organizations/
    users/
    notifications/
    analytics/
    files/
    audit/
  shared/
    auth/
    database/
    errors/
    events/
    pagination/
    validation/
```

模块边界：

| 模块 | 责任 | 不负责 |
| --- | --- | --- |
| `tasks` | 任务、领取记录、提交记录、状态机、任务时间线 | 通知投递、复杂统计 |
| `reviews` | 审核动作、驳回原因、审核记录 | 直接修改任务字段 |
| `organizations` | 机构、机构成员、机构数据范围 | 角色权限判断的全部规则 |
| `users` | 用户、角色、用户组织关系 | 任务业务状态 |
| `notifications` | 通知模板、通知记录、投递状态 | 决定业务是否成功 |
| `analytics` | 看板查询、指标聚合、异常规则查询 | 作为任务状态真相来源 |
| `files` | 附件元数据、上传凭证、下载授权 | 解析所有业务材料 |
| `audit` | 关键操作日志、状态历史 | 业务流程编排 |

## 3. 领域模型

### 3.1 聚合关系

```text
Task
  |
  +-- TaskClaim
        |
        +-- TaskSubmission
        +-- TaskReview

Task
  +-- TaskAttachment
  +-- TaskComment
  +-- TaskStatusHistory

TaskClaim
  +-- ClaimStatusHistory
```

`Task` 是运营发布的营销任务。`TaskClaim` 是某个用户对某个任务的领取和执行实例。一个任务可以有多个领取记录，一个用户在同一任务下默认只能有一个有效领取记录。

### 3.2 核心不变量

- 只有 `draft` 和 `pending_publish` 状态的任务允许编辑核心字段。
- `published` 或 `in_progress` 的任务不允许减少到低于已领取数量的名额。
- 用户领取任务时必须同时检查任务状态、截止时间、剩余名额和领取资格。
- 同一用户同一任务只允许存在一个未终结的领取记录。
- 提交材料必须绑定到有效领取记录，不能直接绑定到用户或任务。
- 审核只能针对最新待审核提交执行，历史提交只读保留。
- 驳回必须填写原因，作废必须填写原因。
- 所有状态变更必须写入状态历史和审计日志。

### 3.3 状态枚举

后端内部建议使用英文枚举，前端展示时映射为中文文案。

```text
TaskStatus:
  DRAFT
  PENDING_PUBLISH
  PUBLISHED
  IN_PROGRESS
  COMPLETED
  UNPUBLISHED
  EXPIRED
  CLOSED

ClaimStatus:
  CLAIMED
  PENDING_SUBMIT
  PENDING_REVIEW
  REWORKING
  APPROVED
  INVALIDATED
  ABANDONED
  EXPIRED
```

`PUBLISHED` 表示任务对外可领取；`IN_PROGRESS` 表示已有领取或提交，仍可继续领取或执行。`CLOSED` 表示运营主动结束，不再参与自动过期逻辑。

## 4. 主链路数据流

### 4.1 创建并发布任务

```text
Operator submits create form
  -> API validation
  -> TaskApplicationService.createTask
  -> Task domain validates required fields
  -> Insert tasks
  -> Insert audit_logs
  -> Return task detail

Operator publishes task
  -> TaskApplicationService.publishTask
  -> Validate status, due_at, quota, organization, platform, fund product
  -> Update task status to PUBLISHED
  -> Insert task_status_history
  -> Insert domain_event: TaskPublished
  -> Worker creates notifications
```

发布动作必须是显式接口，不能通过 `PATCH /tasks/:id` 修改 `status` 完成。

### 4.2 领取任务

```text
User taps claim
  -> Permission and eligibility check
  -> Open transaction
  -> Lock task row or use conditional update quota
  -> Ensure remaining quota > 0
  -> Ensure no active claim exists for user and task
  -> Insert task_claims
  -> Increment claimed_count
  -> If first claim, task may become IN_PROGRESS
  -> Insert claim_status_history and audit_logs
  -> Commit
  -> Emit TaskClaimed
```

领取必须保证并发安全。MySQL 下推荐使用 InnoDB 事务加条件更新：

```sql
UPDATE tasks
SET claimed_count = claimed_count + 1
WHERE id = ?
  AND status IN ('PUBLISHED', 'IN_PROGRESS')
  AND claimed_count < quota
  AND due_at > NOW();
```

如果更新行数为 0，则返回名额不足、任务不可领取或任务已过期。

### 4.3 提交与审核

```text
User submits materials
  -> Validate claim belongs to user
  -> Validate claim status in PENDING_SUBMIT / REWORKING
  -> Insert task_submissions
  -> Update claim status to PENDING_REVIEW
  -> Insert status history
  -> Emit TaskSubmitted

Operator reviews submission
  -> Validate submission is latest pending review
  -> Approve / Reject / Invalidate
  -> Insert task_reviews
  -> Update claim status
  -> If approved, increment approved_count
  -> If approved_count reaches target, task can be COMPLETED by rule
  -> Emit TaskReviewed
```

审核通过和驳回必须是幂等接口。客户端重试时，服务端不能重复增加通过数或重复生成有效审核结果。

## 5. 事件与异步任务

首版可以用数据库事件表 + 后台 worker，不必立即引入 Kafka 或 RabbitMQ。

### 5.1 事件表

建议表名：`domain_events`

| 字段 | 说明 |
| --- | --- |
| `id` | 事件 ID |
| `event_type` | 事件类型 |
| `aggregate_type` | 聚合类型，如 `Task` / `TaskClaim` |
| `aggregate_id` | 聚合 ID |
| `payload` | JSON 载荷 |
| `status` | `pending` / `processing` / `done` / `failed` |
| `retry_count` | 重试次数 |
| `next_retry_at` | 下次重试时间 |
| `created_at` / `processed_at` | 时间 |

### 5.2 事件类型

| 事件 | 触发时机 | 消费方 |
| --- | --- | --- |
| `TaskPublished` | 任务发布成功 | 通知、看板刷新 |
| `TaskClaimed` | 用户领取成功 | 通知、看板刷新 |
| `TaskSubmitted` | 用户提交成功 | 审核待办、通知、看板刷新 |
| `TaskReviewed` | 审核完成 | 通知、看板刷新 |
| `TaskExpired` | 定时任务标记过期 | 通知、看板刷新 |
| `ClaimAbandoned` | 用户放弃任务 | 通知、看板刷新 |

事件消费要支持至少一次投递，因此消费者必须幂等。通知记录可以使用 `event_id + recipient_id + template_code` 做唯一约束。

### 5.3 定时任务

| Job | 周期 | 责任 |
| --- | --- | --- |
| `expire-tasks` | 每 5 分钟 | 将超过截止时间且未关闭的任务标记为过期 |
| `expire-claims` | 每 5 分钟 | 处理领取后长期未提交的记录，是否释放名额由规则决定 |
| `due-reminder` | 每 30 分钟 | 生成即将截止提醒 |
| `review-backlog-alert` | 每小时 | 生成待审核积压提醒 |
| `analytics-rollup` | 每小时或每日 | 聚合看板指标，MVP 可先不启用 |

## 6. 权限与数据范围

权限分两层：动作权限和数据范围。

### 6.1 动作权限

| 动作 | 运营 | 机构 | 普通用户 |
| --- | --- | --- | --- |
| 创建任务 | 是 | 否 | 否 |
| 发布任务 | 是 | 否 | 否 |
| 编辑任务 | 是 | 否 | 否 |
| 下架任务 | 是 | 否 | 否 |
| 查看任务列表 | 是 | 本机构 | 可领取和自己的 |
| 领取任务 | 否 | 否 | 是 |
| 提交任务 | 否 | 否 | 是 |
| 审核提交 | 是 | MVP 否 | 否 |
| 查看看板 | 是 | 本机构 | 个人 |

### 6.2 数据范围

```text
Operator:
  all tasks within authorized organizations and platforms

Organization:
  tasks where tasks.organization_id in current user's organization scope

User:
  task market:
    published or in_progress tasks
    not expired
    has remaining quota
    matches claim_rules
  my claims:
    task_claims.user_id = current_user.id
```

所有数据范围必须在后端查询层实现，不能只依赖前端隐藏。

## 7. 数据库设计补充

### 7.1 关键索引

```text
tasks(status, due_at)
tasks(organization_id, status)
tasks(fund_product_id, status)
tasks(platform, status)
tasks(created_by, created_at)

task_claims(task_id, status)
task_claims(user_id, status)
task_claims(task_id, user_id)
task_claims(status, submitted_at)

task_submissions(claim_id, created_at)
task_reviews(submission_id)
notifications(recipient_id, read_at, created_at)
domain_events(status, next_retry_at)
audit_logs(aggregate_type, aggregate_id, created_at)
```

### 7.2 唯一约束

```text
users.mobile unique nullable
users.email unique nullable
organizations.code unique
fund_products.code unique nullable
task_claims(task_id, user_id, active_flag) unique
task_reviews(submission_id) unique
notifications(event_id, recipient_id, template_code) unique
```

MySQL 不支持 PostgreSQL 风格的 partial unique index。`task_claims.active_flag` 建议用 `TINYINT` 或生成列实现：有效领取记录为 `1`，终结态记录为 `0` 或 `NULL`。这样可以保证同一用户同一任务最多只有一个有效领取，同时保留历史放弃、作废、过期记录。

### 7.3 乐观锁

`tasks` 和 `task_claims` 建议保留 `version` 字段。编辑任务、审核提交、放弃任务等动作带上版本号，避免多人同时操作产生覆盖。

## 8. 文件与材料

文件不直接进入业务表的大字段。上传流程：

```text
Client asks upload credential
  -> files module creates file record with pending status
  -> client uploads to object storage
  -> client confirms file
  -> files module marks uploaded
  -> task submission references file_id
```

首版提交材料建议支持：

- 文本说明
- 图片
- 链接

如果需要支持视频或大型文件，单独增加文件大小、格式、转码和审核预览规则。

## 9. 看板与指标

MVP 使用实时查询即可，M2/M3 再引入聚合表。

### 9.1 实时指标来源

| 指标 | 来源 |
| --- | --- |
| 发布任务数 | `tasks` |
| 领取数 | `task_claims` |
| 提交数 | `task_submissions` 或 `task_claims.status` |
| 通过数 | `task_reviews` 或 `task_claims.status = APPROVED` |
| 返工数 | `task_reviews.result = REJECTED` |
| 过期数 | `tasks.status = EXPIRED` |
| 待审核积压 | `task_claims.status = PENDING_REVIEW` |

### 9.2 聚合表

当数据量增长后增加：

```text
task_metric_daily
  date
  organization_id
  platform
  fund_product_id
  task_type
  published_count
  claimed_count
  submitted_count
  approved_count
  rejected_count
  expired_count
```

聚合表只服务查询，不作为业务状态依据。

## 10. 接口设计约束

接口按资源和动作拆分。查询接口可以使用 REST，状态变更使用动作接口。

### 10.1 M1 必备接口

```text
POST   /api/v1/tasks
GET    /api/v1/tasks
GET    /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id
POST   /api/v1/tasks/:id/publish
POST   /api/v1/tasks/:id/unpublish
POST   /api/v1/tasks/:id/close

GET    /api/v1/task-market
POST   /api/v1/tasks/:id/claim
GET    /api/v1/my/task-claims
GET    /api/v1/task-claims/:id
POST   /api/v1/task-claims/:id/submit
POST   /api/v1/task-claims/:id/abandon

GET    /api/v1/reviews
POST   /api/v1/task-submissions/:id/approve
POST   /api/v1/task-submissions/:id/reject
POST   /api/v1/task-submissions/:id/invalidate

GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
```

### 10.2 返回结构

```json
{
  "data": {},
  "requestId": "req_20260806120000_xxx"
}
```

列表接口：

```json
{
  "data": [],
  "page": {
    "pageNo": 1,
    "pageSize": 20,
    "total": 100
  },
  "requestId": "req_20260806120000_xxx"
}
```

错误接口：

```json
{
  "error": {
    "code": "TASK_QUOTA_EXHAUSTED",
    "message": "任务名额已满",
    "details": {}
  },
  "requestId": "req_20260806120000_xxx"
}
```

## 11. 前端页面架构

### 11.1 路由

```text
/login

/operator
/operator/tasks
/operator/tasks/new
/operator/tasks/:id
/operator/reviews
/operator/dashboards

/organization
/organization/tasks
/organization/tasks/:id
/organization/dashboards

/user
/user/task-market
/user/tasks
/user/task-claims/:id
/user/task-claims/:id/submit
/user/notifications
```

### 11.2 页面数据策略

- 首页：聚合接口优先，减少多接口串行请求。
- 列表页：筛选条件进入 URL query，支持刷新后保留。
- 详情页：详情、时间线、提交记录分区加载。
- 提交页：先上传文件，再提交表单引用文件 ID。
- 审核页：审核动作成功后刷新当前队列，不依赖本地移除。

## 12. 部署架构

MVP 部署可以采用单机或小规模容器部署。

```text
Nginx / Ingress
  |
  +-- Web Static Assets
  |
  +-- API Container
  |
  +-- Worker Container
  |
  +-- MySQL
  |
  +-- Redis
  |
  +-- Object Storage
```

生产环境至少拆为：

- `web`：前端静态资源。
- `api`：同步接口服务，可水平扩展。
- `worker`：通知、过期扫描、事件消费。
- `mysql`：主数据库。
- `redis`：缓存和轻量任务协调。
- `object-storage`：附件材料。

## 13. 可观测性

首版需要保留以下观测点：

- 每个请求生成 `requestId`。
- 关键日志包含 `userId`、`role`、`action`、`aggregateType`、`aggregateId`。
- 状态流转写入业务历史表，不只写技术日志。
- 事件消费失败进入可查询失败队列。
- 审核、发布、下架、关闭、作废必须进入审计日志。

建议指标：

| 指标 | 目的 |
| --- | --- |
| API P95 延迟 | 判断手机端体验 |
| API 错误率 | 发现接口异常 |
| 领取失败次数 | 观察名额不足或资格规则问题 |
| 审核队列长度 | 运营处理压力 |
| 事件积压数量 | 后台任务健康度 |
| 通知失败数量 | 触达健康度 |

## 14. 安全与合规

- 所有接口必须鉴权。
- 机构用户不能通过 ID 枚举访问其他机构任务。
- 普通用户不能查看其他用户领取记录和提交材料。
- 附件下载必须使用短期授权链接或后端鉴权代理。
- 审核材料如包含敏感信息，机构端默认只看审核后结果。
- 审计日志不可被普通业务接口删除。
- 生产环境开启 HTTPS。
- 管理端高危动作建议后续增加二次确认或操作原因。

## 15. MVP 落地顺序

建议按以下顺序实现，能最快闭环：

1. 初始化前后端工程、数据库迁移、基础鉴权。
2. 用户、角色、机构、基金产品基础表。
3. 任务创建、编辑、发布、下架、关闭。
4. 任务大厅和任务领取。
5. 我的任务、提交材料、附件上传。
6. 审核队列、通过、驳回、作废。
7. 状态历史、审计日志、时间线。
8. 首页聚合接口和三角色首页。
9. 站内通知和基础提醒。
10. 过期扫描、待审核积压提醒。

## 16. 待确认的架构决策

| 决策点 | 推荐默认值 | 影响 |
| --- | --- | --- |
| 后端框架 | NestJS | 与 TypeScript 前端共享类型更容易 |
| ORM | Prisma 或 TypeORM | 两者均支持 MySQL；Prisma 类型体验更好，TypeORM 更贴近 NestJS 常见实践 |
| 权限粒度 | RBAC + 数据范围 | 能覆盖 MVP，后续可扩展到机构/区域/平台 |
| 事件机制 | 数据库事件表 + Worker | 成本低，足够支撑首版 |
| 文件存储 | S3 兼容对象存储 | 便于迁移和私有化部署 |
| 看板计算 | MVP 实时查询 | 降低首版复杂度 |
| 机构可见材料 | 默认看审核后结果 | 降低敏感材料泄露风险 |

## 17. 下一步

下一轮建议进入工程骨架设计：

1. 确定技术栈：NestJS + MySQL + Redis + React/Vite 是否作为默认方案。
2. 输出数据库 ERD 和迁移脚本草案。
3. 输出 M1 接口 DTO 和错误码。
4. 初始化前后端目录结构。
5. 先实现任务闭环的最小可运行路径。

技术选型细节见 [TECH_STACK_SELECTION.md](TECH_STACK_SELECTION.md)。
