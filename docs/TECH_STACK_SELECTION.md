# xlyq-fund-relay 技术选型建议

> 日期：2026-08-06  
> 目标：首版以移动端 H5 交付，同时为后续迁移到 App WebView、小程序、企业微信、飞书等容器保留空间。

## 1. 总体结论

推荐采用：

```text
前端：H5 first
  TypeScript + Vite + React 或 Vue
  移动端组件库：antd-mobile 或 Vant
  状态管理：TanStack Query + 轻量本地 store

后端：模块化单体
  TypeScript + NestJS
  MySQL
  Redis
  S3 兼容对象存储
  数据库事件表 + Worker

接口：稳定 REST API
  OpenAPI 描述
  DTO 类型生成
  前端只依赖 API contract，不依赖后端内部实现
```

首版不建议直接上“全端一套代码”框架作为默认方案。原因是当前核心诉求是手机端 H5 的业务闭环，过早引入多端约束会牺牲 H5 交互、组件选择和工程简单度。

更推荐的策略是：**H5 先做干净，迁移能力通过架构边界保证，而不是通过一开始押注某个跨端框架保证。**

## 2. “以后可以任意迁移”的现实边界

严格意义上，页面不可能完全任意迁移。不同运行环境有不同限制：

| 目标环境 | 可复用内容 | 需要适配或重写 |
| --- | --- | --- |
| 普通浏览器 H5 | 全部前端代码 | 无 |
| App WebView | 大部分 H5 页面 | 登录、分享、文件上传、相机、推送等桥接能力 |
| 企业微信/飞书 H5 容器 | 大部分 H5 页面 | 登录鉴权、组织身份、上传下载、消息跳转 |
| 微信小程序 | 业务模型、接口、部分状态逻辑 | 页面层、组件层、路由、上传、权限 API |
| 原生 App | 业务模型、接口、设计规范 | UI 页面、导航、原生能力 |

所以迁移性的核心不是“一个页面到处跑”，而是：

- 业务规则在后端领域层。
- 接口协议稳定。
- 前端业务逻辑和 UI 组件解耦。
- 平台能力通过 adapter 包装。
- 页面不直接依赖浏览器或某个容器的私有 API。

## 3. 前端选型

### 3.1 推荐路线 A：React H5

```text
React + TypeScript + Vite
antd-mobile
TanStack Query
Zustand
React Hook Form + Zod
```

适合情况：

- 团队熟悉 React。
- 后续可能接入更复杂的状态、表单、审核台和看板。
- 希望与后端 TypeScript 共享 DTO 类型。
- 后续也可能转 React Native，但不是短期目标。

优点：

- 生态成熟，工程化自由度高。
- `antd-mobile` 适合后台类、任务类移动 H5。
- `TanStack Query` 很适合列表、详情、审核队列这类服务端状态。
- 与 NestJS 同为 TypeScript，类型协作顺。

风险：

- 表单和移动端交互需要建立统一规范，否则容易每页风格不同。
- React Native 迁移不是直接复用 H5 页面，只能复用部分逻辑和类型。

### 3.2 推荐路线 B：Vue H5

```text
Vue 3 + TypeScript + Vite
Vant
Pinia
Vue Query
VeeValidate 或 FormKit
```

适合情况：

- 团队更熟悉 Vue。
- 主要交付传统移动端 H5。
- 希望快速搭建表单、列表、弹窗和上传交互。
- 后续更可能考虑 uni-app。

优点：

- `Vant` 在国内移动 H5 场景非常成熟。
- Vue 模板对业务页面开发友好。
- 与 uni-app 的团队心智更接近。

风险：

- 如果后续想迁移 React Native，复用路径不如 React 顺。
- TypeScript 复杂类型体验通常不如 React 直观。

### 3.3 跨端框架路线：Taro / uni-app

不建议首版默认使用，但可以作为明确要做小程序时的备选。

适合情况：

- 小程序不是“以后可能”，而是 1-2 个版本内就要上线。
- H5、小程序需要长期并行维护。
- 团队能接受跨端组件、样式和 API 的约束。

优点：

- 小程序迁移成本更低。
- 一套业务代码覆盖 H5 + 小程序的概率更高。

风险：

- H5 体验和组件选择会被跨端框架限制。
- 文件上传、预览、路由、权限等仍然要写平台差异代码。
- 后台型移动 H5 的细节打磨不如纯 H5 自由。

## 4. 前端最终建议

如果没有强团队偏好，推荐：

```text
React + TypeScript + Vite + antd-mobile + TanStack Query + Zustand
```

理由：

- 和后端 NestJS 都是 TypeScript，接口类型可以统一生成。
- 对任务管理、审核队列、看板这类服务端状态非常合适。
- H5 首屏、列表缓存、详情刷新、审核提交都比较好控制。
- 后续迁移到 App WebView 或企业容器时基本不用重写。
- 后续迁移到小程序时，至少能复用 API client、类型、业务常量和状态机定义。

如果团队 Vue 更强，推荐等价替换为：

```text
Vue 3 + TypeScript + Vite + Vant + Pinia + Vue Query
```

这两条路线都比一开始直接上跨端框架更稳。

## 5. 前端架构约束

为了保证迁移能力，前端目录建议这样拆：

```text
src/
  app/
    routes/
    providers/
  pages/
    operator/
    organization/
    user/
  features/
    tasks/
      api.ts
      model.ts
      hooks.ts
      components/
    claims/
    reviews/
    dashboards/
    notifications/
  shared/
    api/
      client.ts
      errors.ts
    platform/
      index.ts
      browser.ts
      feishu.ts
      wecom.ts
      app-webview.ts
    ui/
    utils/
```

关键原则：

- 页面只组合能力，不直接写复杂业务规则。
- `features/*/api.ts` 只调用后端接口，不拼业务状态。
- `shared/platform` 封装登录、上传、预览、分享、跳转、扫码等容器能力。
- 任何页面不直接调用 `window.xxx`、`dd.xxx`、`wx.xxx`、`tt.xxx` 等平台私有对象。
- 状态枚举、错误码、接口 DTO 从 OpenAPI 或共享类型生成。
- 文件上传和预览必须通过统一 adapter。

## 6. 后端选型

推荐：

```text
NestJS + TypeScript
MySQL
Prisma 或 TypeORM
Redis
BullMQ 或自研 DB Worker
S3 兼容对象存储
```

### 6.1 NestJS

适合这个项目的原因：

- 模块化结构清晰，适合任务、审核、机构、通知、看板分模块。
- Guard、Pipe、Interceptor 对鉴权、权限、校验、日志很方便。
- 和前端共用 TypeScript 类型链路更自然。
- 后续从模块化单体拆服务时，模块边界比较好保留。

### 6.2 MySQL

适合原因：

- 任务、领取、审核、历史记录关系明确，关系型数据库更合适。
- MySQL 8 + InnoDB 支持事务和行级锁，领取名额并发控制可靠。
- JSON 字段可以承载提交要求、领取规则、扩展配置。
- 后续统计查询和索引能力足够支撑 MVP 到中期。

MySQL 使用约束：

- 使用 MySQL 8.x。
- 表引擎统一使用 InnoDB。
- 字符集使用 `utf8mb4`。
- 时间字段统一存 UTC 或明确业务时区，后端负责转换展示。
- 领取名额使用事务和条件更新控制，不把名额扣减放到 Redis。
- MySQL 不支持 partial unique index，有效领取唯一性用 `active_flag` 或生成列实现。

### 6.3 Redis

首版使用范围要克制：

- 短期缓存。
- 登录态或验证码。
- 后台任务锁。
- 可选队列。

不要把任务状态真相放到 Redis。任务、领取、审核状态必须以 MySQL 为准。

### 6.4 ORM

推荐优先级：

1. Prisma：类型体验好，迁移清晰，适合 TypeScript 团队。
2. TypeORM：NestJS 生态常见，装饰器写法熟悉。

如果团队没有历史包袱，建议选 Prisma。

## 7. 接口与类型策略

为了迁移能力，接口 contract 比前端框架更重要。

推荐：

```text
后端维护 OpenAPI
  -> 生成前端 TypeScript DTO
  -> 前端 API client 基于生成类型封装
```

约束：

- 状态变更使用动作接口，如 `POST /tasks/:id/publish`。
- 前端不能直接写 `status`。
- 错误码稳定，如 `TASK_QUOTA_EXHAUSTED`、`CLAIM_NOT_SUBMITTABLE`。
- 列表接口统一分页、筛选和排序协议。
- 上传接口统一走文件模块，不把文件细节散落在任务接口里。

## 8. 迁移策略

### 8.1 迁移到 App WebView

优先级最高，也最容易。

可复用：

- 全部 H5 页面。
- 全部 API client。
- 全部业务类型。
- 大部分状态管理。

需要新增：

- App 登录 bridge。
- 文件选择、图片预览 bridge。
- 推送消息跳转协议。
- 返回按钮和导航栏适配。

### 8.2 迁移到企业微信/飞书 H5

可复用：

- 绝大多数页面。
- 接口和业务模型。

需要新增：

- 企业身份登录。
- 组织用户映射。
- 容器 SDK adapter。
- 消息卡片跳转 URL。

### 8.3 迁移到小程序

可复用：

- 接口协议。
- DTO 类型。
- 状态枚举。
- 业务常量。
- 部分纯函数逻辑。

需要重写：

- 页面组件。
- 路由。
- 样式体系。
- 文件上传、预览、授权。
- 部分表单交互。

如果明确要在短期内做小程序，应重新评估是否直接使用 Taro 或 uni-app。

## 9. 不推荐方案

### 9.1 首版直接微前端

不推荐。当前是移动 H5 业务闭环，微前端会增加路由、鉴权、构建、发布复杂度，对 MVP 收益不高。

### 9.2 首版直接微服务

不推荐。任务、领取、审核强一致关系很多，首版拆服务会增加分布式事务和链路排障成本。

### 9.3 首版直接低代码

不推荐作为核心系统。任务状态机、权限、审核和审计都需要比较强的领域控制，低代码可以用于后续内部配置后台，但不适合作为主链路基础。

### 9.4 把跨端框架当作迁移保证

不推荐。跨端框架只能降低某些目标端成本，不能消除平台差异。更可靠的是接口、业务规则、平台 adapter 和模块边界。

## 10. 推荐技术栈版本口径

版本号在开工前需要再按当时最新稳定版确认。当前文档只锁定技术方向，不锁死具体小版本。

建议口径：

```text
Node.js: LTS
TypeScript: stable
Vite: stable
React: stable 或 Vue 3 stable
NestJS: stable
MySQL: 8+
Redis: 7+
Docker: stable
```

## 11. 最终推荐

如果现在就要开工，推荐组合是：

```text
前端：
React + TypeScript + Vite + antd-mobile + TanStack Query + Zustand

后端：
NestJS + TypeScript + Prisma + MySQL + Redis

异步：
数据库事件表 + Worker，后续再升级消息队列

文件：
S3 兼容对象存储

接口：
REST + OpenAPI + 生成 DTO

部署：
Docker Compose 起步，生产环境拆 web / api / worker / db / redis / storage
```

这套方案的核心好处是：首版开发效率高，H5 体验不被跨端框架拖住，后续迁移到 WebView 或企业容器成本低；如果未来要做小程序，也有清晰的可复用边界。
