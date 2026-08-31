# 正式环境部署文档

适用于当前版本：NestJS API、Vite 手机 H5、MySQL 8。

## 1. 部署架构

生产环境建议使用 Nginx 承载 H5 静态文件，并将 `/api` 反向代理到本机 API；API 使用 PM2 保活，3100 端口不对公网开放。

```text
浏览器 → Nginx（HTTPS/H5） → /api → NestJS API → MySQL 8
```

建议环境：Linux、Node.js 20 LTS、MySQL 8、Nginx、PM2。

## 2. 上线前准备

- 准备正式域名和 HTTPS 证书。
- 准备 MySQL 8 数据库及最小权限账号。
- 确认安全组只开放 80/443，3100 仅允许本机访问。
- 备份数据库后再执行迁移。
- 不要提交 `.env`、数据库密码、会话密钥和加密密钥。

## 3. 拉取代码和安装依赖

```bash
sudo apt update
sudo apt install -y nginx git
sudo mkdir -p /srv/xlyq-fund-relay
sudo chown -R "$USER":"$USER" /srv/xlyq-fund-relay
git clone https://github.com/easyLong/xlyq-fund-relay.git /srv/xlyq-fund-relay
cd /srv/xlyq-fund-relay
npm ci
npm run prisma:generate
```

后续更新使用：

```bash
cd /srv/xlyq-fund-relay
git pull --ff-only origin main
npm ci
npm run prisma:generate
```

## 4. 配置生产环境变量

在 `/srv/xlyq-fund-relay/.env` 写入正式值：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=fund_relay_app
MYSQL_PASSWORD=替换为随机强密码
MYSQL_DATABASE=fund_relay
API_PORT=3100
WEB_PORT=5173
WEB_ORIGIN=https://relay.example.com
AUTH_SESSION_SECRET=至少32位随机字符串
EXECUTOR_ACCOUNT_ENCRYPTION_KEY=至少32位随机字符串
ENABLE_DEMO_BOOTSTRAP=false
```

生成随机密钥：

```bash
openssl rand -base64 48
chmod 600 /srv/xlyq-fund-relay/.env
```

`AUTH_SESSION_SECRET` 发布后必须保持不变，否则现有登录会话会失效。`EXECUTOR_ACCOUNT_ENCRYPTION_KEY` 变更后历史账号密码无法解密。

项目 API 启动脚本会读取根目录 `.env`，并根据 `MYSQL_*` 自动生成 `DATABASE_URL`。

## 5. 初始化数据库和执行迁移

先用管理员账号创建数据库和应用账号：

```sql
CREATE DATABASE fund_relay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fund_relay_app'@'127.0.0.1' IDENTIFIED BY '替换为随机强密码';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON fund_relay.* TO 'fund_relay_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

项目使用增量 SQL 迁移，不要对已有正式库执行 `prisma db push`。首次部署可按文件名顺序执行：

```bash
cd /srv/xlyq-fund-relay/apps/api
for file in prisma/migrations/*.sql; do
  echo "Applying $file"
  node scripts/with-database-url.mjs prisma db execute \
    --schema prisma/schema.prisma \
    --file "$file" || exit 1
done
```

如果数据库已经执行过部分迁移，不要重复执行；先由 DBA 核对数据库结构和已执行记录。

## 6. 构建和健康检查

```bash
cd /srv/xlyq-fund-relay
npm run typecheck
npm run build
```

构建产物：`apps/web/dist` 是 H5，`apps/api/dist` 是 API。

临时启动 API：

```bash
npm run start -w @xlyq/api
curl -i http://127.0.0.1:3100/api/v1/health
```

健康检查应返回 HTTP 200 且数据库状态正常。确认后按 Ctrl+C 停止临时进程。

## 7. 使用 PM2 运行 API

```bash
sudo npm install -g pm2
cd /srv/xlyq-fund-relay
pm2 start npm --name xlyq-fund-relay-api -- run start -w @xlyq/api
pm2 save
pm2 startup
```

执行 `pm2 startup` 后，复制执行它输出的 `sudo` 命令。常用命令：

```bash
pm2 status
pm2 logs xlyq-fund-relay-api
pm2 restart xlyq-fund-relay-api --update-env
```

## 8. 配置 Nginx

创建 `/etc/nginx/sites-available/xlyq-fund-relay`：

```nginx
server {
    listen 80;
    server_name relay.example.com;
    root /srv/xlyq-fund-relay/apps/web/dist;
    index index.html;
    client_max_body_size 15m;

    location /api/ {
        proxy_pass http://127.0.0.1:3100/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用并检查：

```bash
sudo ln -s /etc/nginx/sites-available/xlyq-fund-relay /etc/nginx/sites-enabled/xlyq-fund-relay
sudo nginx -t
sudo systemctl reload nginx
```

然后使用 Certbot 或现有证书配置 HTTPS，并确认 `.env` 的 `WEB_ORIGIN` 使用真实 HTTPS 地址：

```bash
pm2 restart xlyq-fund-relay-api --update-env
```

## 9. 上线验收

1. 访问正式域名，确认手机 H5 正常打开。
2. 运营登录，导入小规模 Excel，确认相同业务键重复导入会更新。
3. 兼职登录，确认先看详情再领取，多个账号对应帖子逐条分开。
4. 每条帖子分别提交链接和截图，运营审核队列应显示帖子标题和执行账号。
5. 基金公司登录，确认只能看到所属公司范围内的任务和进度。
6. 确认待提交、待审核、待补充、已通过统计互不混淆。
7. 检查 `pm2 status`、API 健康检查和 Nginx 日志。

## 10. 版本更新

```bash
cd /srv/xlyq-fund-relay
git pull --ff-only origin main
npm ci
npm run prisma:generate
npm run typecheck
npm run build
pm2 restart xlyq-fund-relay-api --update-env
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://relay.example.com/api/v1/health
```

若本次版本新增 SQL，先执行尚未执行的迁移，再重启 API。更新异常时查看：

```bash
pm2 logs xlyq-fund-relay-api --lines 200
sudo journalctl -u nginx -n 100 --no-pager
```

## 11. 当前版本边界

- 截图目前以压缩 data URL 存储在提交数据中，应持续监控数据库容量，后续建议接入对象存储。
- 正式环境必须关闭 `/api/v1/demo/bootstrap`，演示账号仅用于开发和验收。
- 后续上线前建议补充正式账号初始化、密码重置、备份恢复演练和告警。
