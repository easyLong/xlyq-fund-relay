# 任务跟踪系统架构设计

> 版本：v0.1  
> 日期：2026-08-13  
> 输入文档：《任务跟踪系统需求文档.docx》  
> 目标：将需求规格转化为可落地的产品架构、系统架构、数据架构和阶段建设方案。

## 1. 架构结论

《任务跟踪系统需求文档.docx》描述的系统已经不是单纯的“任务列表 + 状态跟踪”，而是一个面向公募基金营销场景的端到端任务运营平台。

它覆盖：

- 任务自动获取
- 任务整理与发布
- 账号匹配与任务分发
- 兼职人员领取与提交
- 自动回查与屏蔽补发
- 账号分级与账号养成
- 组织架构与组长激励
- 积分、提现与费用核算
- 客户看板与效果归因
- 风控、审计、通知和数据可视化

建议总体架构采用：

```text
手机端 H5 + 管理后台
  |
NestJS BFF / API
  |
模块化单体业务核心
  |
MySQL + Redis + OSS
  |
独立 Worker：采集、回查、通知、结算、统计
```

第一阶段不建议直接微服务化。更稳的方式是先建设模块化单体，把业务边界、状态机、权限和数据模型稳定下来；采集、回查、通知、统计这类异步能力用 Worker 独立进程承载。等任务量、采集量和团队边界清晰后，再拆服务。

## 2. 系统定位

系统定位为：

> 面向公募基金营销任务的任务获取、分发执行、质量回查、账号运营、积分结算和客户效果追踪平台。

核心目标：

- 让任务来源可追踪：知道任务来自哪个文档、哪次导入、哪个客户。
- 让任务执行可闭环：发布、领取、提交、回查、补发、结算全链路有状态。
- 让账号使用可治理：账号分级、频控、屏蔽率、成长策略可量化。
- 让组织激励可核算：个人积分、组长加成、社团赞助、客户费用都可追溯。
- 让客户效果可反馈：客户能查看任务进度、账号资源、效果趋势和导出数据。

## 3. 用户与权限模型

### 3.1 角色

| 角色 | 定位 | 数据范围 | 核心能力 |
| --- | --- | --- | --- |
| 任务管理者 | 运营/管理员 | 全局或授权范围 | 任务导入、编辑、发布、分配、回查、结算、看板 |
| 兼职管理者/组长 | 组织管理层 | 本组及直属组员 | 跟踪组内任务、评价效果、管理成员、核算加成 |
| 兼职人员 | 执行层 | 本人任务和本人账号 | 领取任务、提交链接/截图、查看积分 |
| 客户/基金公司 | 项目观察方 | 本公司关联任务 | 查看任务、策略确认、账号看板、效果分析、导出报告 |

需求文档中重点说明了“组长可同时是组员”和“数据范围不无限递归”。因此权限模型需要区分：

- 功能权限：能不能做某个动作。
- 数据权限：能看哪些任务、账号、人员和结算数据。
- 组织关系：谁管理谁，是否只看直属成员。
- 客户关联：客户只能看本公司项目或任务。

### 3.2 权限策略

建议采用 RBAC + Data Scope：

```text
User
  -> UserRole
  -> RolePermission
  -> DataScopePolicy
```

数据范围策略：

- `GLOBAL`：全局可见。
- `CUSTOMER`：按客户 ID 过滤。
- `GROUP_DIRECT`：只看直属组员。
- `GROUP_TREE`：看组织树下级，默认不开。
- `SELF`：仅本人数据。

组长场景建议首版只实现 `GROUP_DIRECT`。因为需求明确提到 A 管理 B/C/D，但 A 不管理 B/C/D 的下设组员。后续若需要区域负责人、城市负责人，再单独开放 `GROUP_TREE`。

## 4. 产品能力分层

### 4.1 总体产品结构

```text
任务来源层
  - 腾讯文档
  - 企业微信文档
  - 飞书文档
  - 手动 Excel/CSV 导入

任务运营层
  - 任务导入
  - 字段映射
  - 任务编辑
  - 审核发布
  - 批量操作
  - 版本管理

分发执行层
  - 账号画像
  - 智能匹配
  - 任务大厅
  - 任务领取
  - 提交链接/截图
  - 消息推送

质量回查层
  - 链接回查
  - 屏蔽识别
  - 补发任务
  - 数据矫正
  - 风控策略

账号运营层
  - 账号登记
  - 账号分级
  - 账号养成
  - 高质量账号绑定
  - 达人监控

组织激励层
  - 组织层级
  - 组长加成
  - 积分账户
  - 提现审批
  - 社团赞助

客户与看板层
  - 客户任务总览
  - 账号看板
  - 投放效果
  - 报告订阅
  - 数据导出
```

### 4.2 MVP 应保留的核心闭环

第一版建议只做这条闭环：

```text
手动导入/创建任务
  -> 运营发布
  -> 兼职人员领取
  -> 提交链接和截图
  -> 运营审核
  -> 积分冻结/解冻
  -> 基础看板
```

暂缓内容：

- 多平台文档自动采集
- 自动屏蔽回查
- 自动补发任务
- 达人监控
- 社团赞助复杂核算
- 客户 ROI 归因
- 微服务拆分

这些能力都很有价值，但不适合作为首版主链路阻塞项。

## 5. 技术架构

### 5.1 当前项目推荐技术路线

需求文档中建议了 Spring Boot + Vue3，但当前项目已经采用：

- 前端：React + TypeScript + Vite
- 移动端组件：antd-mobile 可继续引入
- 后端：NestJS + TypeScript
- 数据库：MySQL
- ORM：Prisma
- 共享类型：packages/shared

建议继续坚持 TypeScript 全栈，不再切换 Java/Vue。原因：

- 当前代码已有 NestJS、React、Prisma 基础。
- 前后端类型可以共享，适合任务状态、积分状态、接口 DTO 的一致性。
- 模块化单体在 NestJS 里边界清晰，后续拆 Worker 也顺。
- H5 首版更重交互和迭代速度，React + Vite 足够。

### 5.2 总体部署结构

```text
Client
  - 微信服务号 H5
  - 浏览器 H5
  - 后续企业微信 H5

API Layer
  - NestJS API / BFF
  - JWT 鉴权
  - RBAC 权限
  - 数据范围过滤
  - 请求限流

Business Modules
  - Task Module
  - Claim Module
  - Submission Module
  - Review Module
  - Account Module
  - Organization Module
  - Points Module
  - Settlement Module
  - Customer Module
  - Dashboard Module
  - Notification Module
  - Audit Module

Worker Layer
  - Import Worker
  - Recall Check Worker
  - Notification Worker
  - Settlement Worker
  - Metrics Worker

Infrastructure
  - MySQL 8
  - Redis
  - OSS/COS/S3
  - Domain Event Table
  - Operation Logs
```

### 5.3 模块化单体边界

| 模块 | 责任 | 不负责 |
| --- | --- | --- |
| `auth` | 登录、JWT、角色、权限上下文 | 具体业务数据过滤 |
| `users` | 用户、实名、联系方式、状态 | 账号画像和积分计算 |
| `organizations` | 组长、组员、组织层级、客户组织 | 任务状态流转 |
| `tasks` | 任务创建、导入、编辑、发布、停用、版本 | 领取后的提交审核细节 |
| `claims` | 领取、放弃、领取频控、领取状态 | 任务原始内容编辑 |
| `submissions` | 链接、截图、文本、文件提交 | 审核结论 |
| `reviews` | 审核通过、驳回、作废、审核记录 | 自动回查采集 |
| `accounts` | 发布账号登记、平台账号画像、等级、黑名单 | 用户登录账号 |
| `matching` | 任务与账号匹配、频控、区域去重 | 实际消息投递 |
| `recall` | 链接回查、屏蔽判定、重试、补发建议 | 人工审核 |
| `points` | 积分规则、冻结、解冻、流水 | 财务打款 |
| `settlements` | 提现、月结、个税、社团赞助 | 任务审核 |
| `customers` | 基金公司、项目、客户视图、报告订阅 | 内部组织管理 |
| `notifications` | 模板消息、站内信、企业微信通知 | 决定业务成功失败 |
| `dashboards` | 查询聚合、看板指标 | 作为业务状态真相 |
| `audit` | 操作日志、状态历史、版本快照 | 业务规则判断 |

## 6. 核心业务流程

### 6.1 任务导入与发布

```text
导入文档/手动创建
  -> 字段映射
  -> 数据校验
  -> 生成任务草稿
  -> 运营编辑确认
  -> 生成版本快照
  -> 发布任务
  -> 触发匹配和通知
```

关键规则：

- 来源文档和导入批次必须保留。
- 每次编辑生成任务版本快照。
- 发布前必须校验截止时间、积分、平台、区域、账号要求和提交要求。
- 已发布任务不允许直接改核心字段，需新版本或下架重发。

### 6.2 领取与执行

```text
兼职人员打开任务大厅
  -> 系统按账号画像和频控过滤可领任务
  -> 用户领取
  -> 创建领取记录
  -> 冻结任务名额
  -> 用户执行
  -> 提交链接 + 截图 + 说明
  -> 进入待回查/待审核
```

领取需要同时检查：

- 任务状态是否已发布。
- 任务是否过期。
- 名额是否充足。
- 用户是否已领取过。
- 用户账号是否匹配平台和等级。
- 当日频次是否超过限制。
- 是否命中黑名单或冷启动保护。

### 6.3 回查与补发

```text
提交完成
  -> 10-30 分钟后进入回查队列
  -> Playwright 访问链接
  -> 判断 HTTP 状态、页面关键词、重定向
  -> 正常：进入待人工确认或自动通过
  -> 屏蔽：标记屏蔽，生成补发任务
  -> 超过 3 次补发：升级人工处理
```

建议第一版先不做全自动补发，只做：

- 人工标记屏蔽。
- 记录屏蔽原因。
- 一键复制生成补发任务。

等屏蔽样本足够后再做自动识别。

### 6.4 积分结算

```text
任务领取
  -> 不产生积分

提交待审核
  -> 生成冻结积分

回查/审核通过
  -> 冻结积分转可用积分

屏蔽/作废/驳回
  -> 冻结积分扣回或继续冻结

月度提现
  -> 提现申请
  -> 审批
  -> 打款
  -> 记录已提现积分
```

积分账户必须用流水驱动，不能只在用户表上维护一个数字。

## 7. 状态机设计

### 7.1 任务状态

```text
DRAFT
  -> PENDING_PUBLISH
  -> PUBLISHED
  -> IN_PROGRESS
  -> PENDING_RECALL
  -> COMPLETED
  -> SETTLED

PUBLISHED / IN_PROGRESS
  -> DISABLED
  -> EXPIRED

PENDING_RECALL
  -> BLOCKED
  -> COMPLETED

BLOCKED
  -> REPUBLISHED
  -> MANUAL_PROCESSING
```

为了兼容当前项目，可以先保留现有枚举，再逐步增加：

- `PENDING_RECALL`
- `BLOCKED`
- `SETTLED`
- `DISABLED`
- `MANUAL_PROCESSING`

### 7.2 领取记录状态

```text
CLAIMED
  -> PENDING_SUBMIT
  -> SUBMITTED
  -> PENDING_RECALL
  -> PENDING_REVIEW
  -> APPROVED
  -> SETTLED

PENDING_REVIEW
  -> REWORKING
  -> INVALIDATED

PENDING_RECALL
  -> BLOCKED
  -> PENDING_REVIEW

CLAIMED / PENDING_SUBMIT / REWORKING
  -> ABANDONED
  -> EXPIRED
```

### 7.3 积分状态

```text
PENDING
  -> FROZEN
  -> AVAILABLE
  -> WITHDRAWING
  -> WITHDRAWN

FROZEN
  -> CANCELED

AVAILABLE
  -> EXPIRED
```

所有状态变化都需要：

- 前状态
- 后状态
- 操作人
- 操作来源
- 原因
- 业务单据 ID
- 时间

## 8. 数据架构

### 8.1 核心实体

```text
客户域
  customers
  customer_projects

组织域
  users
  roles
  permissions
  user_roles
  organizations
  organization_members

账号域
  marketing_accounts
  account_metrics
  account_level_histories
  account_blacklist_records

任务域
  task_import_batches
  task_source_documents
  tasks
  task_versions
  task_claims
  task_submissions
  task_reviews
  task_status_histories

回查域
  recall_jobs
  recall_results
  blocked_records
  republish_tasks

积分结算域
  point_accounts
  point_transactions
  withdrawal_applications
  settlement_batches
  group_bonus_records
  sponsor_settlements

通知审计域
  notifications
  notification_deliveries
  operation_logs
  domain_events
```

### 8.2 建议新增/调整的关键表

#### `task_import_batches`

记录每次导入。

| 字段 | 说明 |
| --- | --- |
| `id` | 导入批次 ID |
| `source_type` | `manual` / `tencent_doc` / `wecom_doc` / `lark_doc` |
| `source_doc_id` | 来源文档 ID |
| `source_name` | 来源名称 |
| `status` | 导入状态 |
| `total_count` | 总行数 |
| `success_count` | 成功数 |
| `failed_count` | 失败数 |
| `error_summary` | 错误摘要 |
| `created_by` | 操作人 |

#### `task_versions`

记录任务版本快照。

| 字段 | 说明 |
| --- | --- |
| `id` | 版本 ID |
| `task_id` | 任务 ID |
| `version` | 版本号 |
| `snapshot` | JSON 快照 |
| `change_reason` | 修改原因 |
| `created_by` | 修改人 |

#### `marketing_accounts`

记录可投放账号。

| 字段 | 说明 |
| --- | --- |
| `id` | 账号 ID |
| `user_id` | 归属兼职人员 |
| `platform` | 平台 |
| `account_name` | 账号昵称 |
| `account_url` | 主页链接 |
| `region` | 区域 |
| `content_tags` | 内容标签 JSON |
| `level` | S/A/B/C |
| `status` | 可用/冻结/黑名单 |
| `daily_limit` | 每日任务上限 |
| `risk_score` | 风险分 |

#### `task_claims`

当前已有表，但需要补充账号维度。

建议增加：

- `marketing_account_id`
- `matched_score`
- `claim_source`
- `frozen_points`
- `blocked_count`

#### `recall_jobs`

记录回查任务。

| 字段 | 说明 |
| --- | --- |
| `id` | 回查任务 ID |
| `task_id` | 任务 ID |
| `claim_id` | 领取 ID |
| `submission_id` | 提交 ID |
| `target_url` | 回查链接 |
| `status` | pending/running/success/failed |
| `scheduled_at` | 计划执行时间 |
| `retry_count` | 重试次数 |
| `result_id` | 回查结果 |

#### `point_transactions`

积分流水。

| 字段 | 说明 |
| --- | --- |
| `id` | 流水 ID |
| `user_id` | 用户 |
| `account_id` | 积分账户 |
| `biz_type` | task/group_bonus/correction/withdraw |
| `biz_id` | 业务 ID |
| `direction` | income/expense/freeze/unfreeze |
| `points` | 积分 |
| `status` | pending/frozen/available/canceled/withdrawn |
| `reason` | 原因 |

### 8.3 数据事实来源

必须明确哪些表是“状态真相”：

- 任务状态：`tasks.status`
- 领取状态：`task_claims.status`
- 审核结论：`task_reviews`
- 提交材料：`task_submissions`
- 回查结果：`recall_results`
- 积分余额：由 `point_transactions` 聚合，`point_accounts` 可做缓存
- 看板数据：可缓存和聚合，但不能作为业务真相

## 9. 集成架构

### 9.1 文档采集

需求文档提出腾讯文档、企业微信文档、飞书文档自动获取。建议按适配器设计：

```text
DocumentImportService
  -> TencentDocAdapter
  -> WeComDocAdapter
  -> LarkDocAdapter
  -> CsvExcelAdapter
```

统一输出：

```ts
interface ImportedTaskRow {
  sourceRowId: string;
  taskName: string;
  content: string;
  platform: string;
  region?: string;
  targetUrl?: string;
  deadline: string;
  points: number;
  priority?: string;
  accountLevelReq?: string;
}
```

第一版建议只做 Excel/CSV 手动导入和后台创建。自动文档采集进入第二阶段。

### 9.2 消息推送

推送通道：

- 站内信：MVP 必做。
- 微信服务号模板消息：第二阶段。
- 企业微信社群 API：第二阶段。
- 短信：可选。

统一通知模型：

```text
业务事件
  -> 通知模板
  -> 生成通知记录
  -> 选择通道
  -> 投递
  -> 回写投递状态
```

业务成功不能依赖通知成功。通知失败只影响触达，不回滚任务状态。

### 9.3 文件存储

提交截图、附件、原始导入文件都不建议放 MySQL BLOB。

建议：

```text
前端申请上传凭证
  -> OSS/COS/S3 上传
  -> 后端保存文件元数据
  -> 提交记录关联 file_id
```

MVP 可以先使用本地文件或简单对象存储接口，但数据库只保存文件元信息。

## 10. 前端架构

### 10.1 应用形态

首版建议一个 H5 应用，根据角色展示不同页面。

```text
apps/web/src
  app/
  pages/
    operator/
    leader/
    worker/
    customer/
  features/
    tasks/
    claims/
    submissions/
    accounts/
    points/
    dashboards/
    notifications/
  shared/
    api/
    ui/
    platform/
```

### 10.2 核心页面

运营端：

- 工作台
- 任务导入
- 任务列表
- 任务详情
- 审核台
- 回查异常
- 积分结算
- 账号管理
- 看板

组长端：

- 组内任务
- 组员列表
- 组员完成情况
- 组内积分
- 异常任务

兼职端：

- 任务大厅
- 任务详情
- 我的任务
- 提交任务
- 积分中心
- 消息中心
- 我的账号

客户端：

- 任务总览
- 任务详情
- 账号看板
- 投放效果
- 报告导出

### 10.3 移动端设计原则

- 首屏展示待处理事项，不做营销式首页。
- 任务卡片展示状态、截止时间、积分、平台、剩余名额。
- 审核台支持快速切换通过、驳回、作废。
- 提交页必须支持弱网暂存。
- 错误状态必须可见，不允许接口失败后页面静默空白。
- 所有关键按钮需要二次确认或结果提示。

## 11. 后端目录建议

```text
apps/api/src/
  modules/
    auth/
    users/
    roles/
    organizations/
    customers/
    tasks/
    claims/
    submissions/
    reviews/
    accounts/
    matching/
    recall/
    points/
    settlements/
    notifications/
    dashboards/
    files/
    audit/
    health/
  common/
    response.ts
    pagination.ts
    errors.ts
    guards/
    decorators/
    events/
  workers/
    import.worker.ts
    recall.worker.ts
    notification.worker.ts
    settlement.worker.ts
    metrics.worker.ts
```

当前项目已有：

- `tasks`
- `dashboard`
- `health`
- `prisma`

后续建议按优先级补：

1. `users`
2. `auth`
3. `organizations`
4. `claims`
5. `submissions`
6. `reviews`
7. `points`
8. `accounts`

## 12. 事件与异步任务

建议保留 `domain_events` 表。

事件类型：

| 事件 | 触发时机 | 消费方 |
| --- | --- | --- |
| `TaskImported` | 任务导入完成 | 通知、看板 |
| `TaskPublished` | 任务发布 | 匹配、通知 |
| `TaskClaimed` | 用户领取 | 通知、看板 |
| `TaskSubmitted` | 用户提交 | 回查、审核通知 |
| `RecallPassed` | 回查通过 | 积分、审核 |
| `RecallBlocked` | 回查屏蔽 | 补发、风控 |
| `ReviewApproved` | 审核通过 | 积分解冻、通知 |
| `ReviewRejected` | 审核驳回 | 通知 |
| `PointsAvailable` | 积分可用 | 通知 |
| `WithdrawalApproved` | 提现通过 | 财务处理 |

MVP 可使用数据库轮询 Worker：

```text
domain_events.status = pending
  -> Worker 拉取
  -> 执行业务
  -> done / failed
  -> 失败按 retry_count 重试
```

## 13. 看板指标

### 13.1 运营看板

- 今日新增任务
- 已发布任务
- 已领取任务
- 待提交任务
- 待审核提交
- 回查异常
- 屏蔽率
- 完成率
- 待结算积分

### 13.2 组长看板

- 直属组员数
- 组内领取数
- 组内提交数
- 组内通过数
- 组员排行
- 异常任务
- 管理加成积分

### 13.3 兼职人员看板

- 可领取任务
- 待提交任务
- 待审核任务
- 返工任务
- 已完成任务
- 可用积分
- 冻结积分
- 已提现积分

### 13.4 客户看板

- 本公司任务总量
- 任务完成进度
- 账号资源分布
- 发布平台分布
- 屏蔽率
- 阅读/互动趋势
- 数据导出

## 14. 安全、合规与风控

### 14.1 内容合规

- 基金营销内容必须保留素材来源。
- 不得承诺收益。
- 不得伪造持仓和收益。
- 内容中涉及观点时需要合规提示。
- 审核记录必须留痕。

### 14.2 数据合规

- 仅采集公开数据。
- 用户手机号、支付宝账号等敏感信息需要脱敏展示。
- 客户数据按客户 ID 隔离。
- 导出数据需要记录操作日志。
- 上传截图需要访问权限控制。

### 14.3 账号风控

- 单账号每日上限。
- 发布间隔控制。
- 新账号冷启动保护。
- 屏蔽率阈值预警。
- 黑名单机制。
- 平台维度频控。

## 15. 分阶段落地路线

### 阶段 0：修正现有基础

目标：让现有 H5 + API 稳定可打开、可诊断。

- 健康检查
- 错误兜底
- 空数据提示
- `.env` 端口配置
- MySQL 连接诊断

### 阶段 1：MVP 任务闭环

目标：完成最小业务链路。

- 用户和角色
- 机构和客户
- 任务创建/发布
- 任务大厅
- 领取任务
- 提交链接/截图
- 人工审核
- 状态历史
- 基础看板

### 阶段 2：账号与积分

目标：让任务执行和激励可运营。

- 发布账号登记
- 账号等级
- 领取匹配
- 频控
- 积分规则
- 冻结/解冻积分
- 提现申请
- 组长直属成员管理

### 阶段 3：回查与补发

目标：提升质量闭环。

- 回查任务队列
- 链接状态检测
- 屏蔽原因记录
- 人工补发
- 自动补发建议
- 风控看板

### 阶段 4：自动导入与客户看板

目标：提升规模化运营能力。

- Excel/CSV 导入
- 腾讯/企微/飞书文档适配
- 客户端任务总览
- 账号看板
- 报告订阅
- 数据导出

### 阶段 5：高级运营

目标：形成账号护城河和效果归因。

- 账号养成任务
- 达人监控
- 社团赞助核算
- ROI 归因
- 自动匹配策略优化

## 16. 主要风险与建议

### 风险 1：需求范围过大

文档覆盖 8 大模块、33 项完善内容，若一次性建设会很容易失控。

建议：先围绕“任务发布 -> 领取 -> 提交 -> 审核 -> 积分”闭环交付。

### 风险 2：自动采集和回查不确定性高

腾讯文档、企微文档、飞书文档、各发布平台链接回查都依赖外部平台规则，稳定性不完全可控。

建议：采集和回查作为独立 Worker，失败不影响主业务；先人工导入和人工回查，再自动化。

### 风险 3：金融营销合规风险高

基金营销内容、收益展示、账号水贴、达人监控都存在合规边界。

建议：内容审核、操作日志、数据脱敏、导出审计必须前置。

### 风险 4：积分结算涉及财务和税务

个人提现、组长加成、社团赞助、个税代扣都不是简单字段。

建议：积分先做账户和流水，不急着自动打款；提现先走人工审批。

### 风险 5：组织层级容易复杂化

L0-L3 多层组织、管理加成、身份重叠会让权限和结算复杂度快速上升。

建议：首版只做兼职人员和直属组长，区域负责人和城市负责人后置。

## 17. 第一版建议表结构优先级

第一批：

- `users`
- `roles`
- `user_roles`
- `organizations`
- `organization_members`
- `customers`
- `tasks`
- `task_claims`
- `task_submissions`
- `task_reviews`
- `task_status_histories`
- `operation_logs`

第二批：

- `marketing_accounts`
- `account_metrics`
- `point_accounts`
- `point_transactions`
- `notifications`
- `domain_events`

第三批：

- `task_import_batches`
- `task_versions`
- `recall_jobs`
- `recall_results`
- `blocked_records`
- `withdrawal_applications`
- `settlement_batches`
- `group_bonus_records`

## 18. 与当前项目的下一步对齐

当前代码已经具备：

- H5 工作台雏形
- NestJS API
- Prisma + MySQL
- 任务表基础模型
- Dashboard 基础接口
- Health 健康检查

建议下一步开发顺序：

1. 补用户、角色、机构、客户基础表。
2. 拆分任务领取、提交、审核模块。
3. 完善任务状态机，所有状态变更写历史。
4. 增加任务大厅、我的任务、审核台三个核心页面。
5. 增加积分账户和冻结积分流水。
6. 再做账号登记与匹配规则。

这条路线能把需求文档里的完整平台逐步落地，而不会一开始就被自动采集、微服务、结算和达人监控拖散。
