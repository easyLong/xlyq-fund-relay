# 当前实现状态

更新时间：2026-08-14

## 1. 产品定位

本项目是手机端 Web 公募基金营销任务管理平台，面向三类使用者：

- 运营人员：创建、发布、下架、提醒和审核任务
- 兼职人员：领取任务、查看基金原文、发布内容、提交链接和截图
- 基金公司：维护对应基金的帖子原文，查看任务进度

## 2. 当前业务闭环

```text
基金公司维护基金帖子
        ↓
运营选择帖子并创建营销任务
        ↓
任务发布到兼职任务市场
        ↓
兼职领取任务并查看标题、正文和原文
        ↓
兼职发布内容并提交链接、正文和截图
        ↓
运营查看提交详情
        ↓
审核通过或退回修改
        ↓
积分记录和任务进度更新
```

## 3. 账号与数据权限

| 账号 | 数据范围 | 关键能力 |
| --- | --- | --- |
| `admin` | 全部机构和任务 | 运营工作台、审核、任务管理 |
| `staff1` | 自己领取的任务 | 任务市场、提交材料、积分 |
| `staff2` | 自己领取的任务 | 任务市场、提交材料、积分 |
| `staff3` | 自己领取的任务 | 任务市场、提交材料、积分 |
| `fund1` | `fundProductId = 1` | 红土基金帖子和进度 |

基金账号通过 `users.fund_product_id` 关联 `fund_products.id`。当前 `fund1` 对应：

```text
基金名称：红土基金
基金产品 ID：1
基金产品编码：DEMO-FUND-001
```

基金角色访问帖子、进度和创建接口时，API 会校验登录账号的基金绑定，不能通过修改请求参数读取其他基金数据。

## 4. 数据表分层

### 业务主表

- `organizations`
- `users`
- `fund_products`
- `tasks`
- `task_claims`
- `task_submissions`

### 账号和专项业务表

- `executor_accounts`
- `fund_task_posts`
- `fund_tasks`
- `task_reminders`
- `user_point_accounts`
- `point_ledgers`

### 流程治理表

- `task_status_history`
- `claim_status_history`
- `task_reviews`
- `notifications`
- `audit_logs`
- `domain_events`

### 暂缓表

- `task_attachments` / `file_assets`：文件上传和对象存储，按当前范围暂不建立
- `task_comments`：任务协作评论，待协作场景明确后建立
- `task_metric_daily`：数据量增长后用于报表聚合
- `user_roles`：当前单角色使用 `users.role`，出现多角色和组织权限后再拆分

## 5. 迁移记录

本轮新增或补齐：

| 文件 | 作用 |
| --- | --- |
| `20260814_fund_account_scope.sql` | 给用户增加基金产品绑定，并建立外键 |
| `20260814_workflow_foundation.sql` | 补齐流程历史、审核、通知、审计和领域事件表 |

`workflow_foundation.sql` 使用 `CREATE TABLE IF NOT EXISTS`，兼容已经由历史初始化脚本创建过这些表的数据库环境。

## 6. 已完成验证

- Prisma schema 校验通过
- Prisma Client 生成通过
- 六张流程表均可通过 Prisma 查询
- `npm run typecheck` 通过
- `npm run build` 通过
- API 健康检查通过，数据库状态为 `ok`
- `fund1 / 123456` 登录返回基金角色和 `fundProductId = 1`

## 7. 下一阶段建议

1. 将任务状态、领取状态、审核和关键编辑动作写入历史表。
2. 基于 `domain_events` 增加通知 worker，实现任务发布、提交和审核结果通知。
3. 增加运营审核队列和通知中心页面。
4. 增加文件上传表和对象存储适配，支持截图真实上传。
5. 增加日报聚合表和运营效果分析。
