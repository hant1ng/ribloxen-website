# RIBLOXEN 官网

昆山日不落自动化设备有限公司中文官网。Astro、TypeScript、Content Collections、原生 CSS，静态 HTML 部署到 Cloudflare Pages。询价 API 使用独立 Pages Functions。

## 本地

Node 22.12+，pnpm 10.18.3。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

`dist` 为静态产物。`functions` 必须保留在仓库根目录，由 Cloudflare Pages Git 集成部署。Astro 本地服务器不运行 Functions，因此本地询价显示未启用是预期行为。

## Cloudflare Pages Git 部署

1. Workers & Pages → Create application → Pages → Connect to Git。
2. 选择 `hant1ng/ribloxen-website`，生产分支 `main`。
3. 框架 Astro，构建命令 `pnpm build`，输出目录 `dist`，根目录留空。
4. 环境变量 `NODE_VERSION=22`、`PNPM_VERSION=10.18.3`。
5. 保存部署，等待成功后检查首页、产品详情、搜索、询价与 404。
6. 在 Custom domains 中绑定 `ribloxen.com` 和 `www.ribloxen.com`。按 Cloudflare 实际提示配置 DNS。保持原有 MX、邮件相关 TXT 记录不变。
7. 仅在主域名已能正确访问后，设置 `CANONICAL_REDIRECT_ENABLED=true` 并重新部署。这启用 www 和默认生产 pages.dev 到主域名的 301。若实际 Pages 项目名不同，修改 `functions/_middleware.ts` 内生产别名。预览域名保留 noindex，不重定向。

官方文档：
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/functions/bindings/#d1-databases

## 启用真实询价接收

默认关闭，页面会明确提示，绝不伪造成功。

1. 创建 D1 数据库，仅绑定在本项目生产环境，变量名 `RFQ_DB`。
2. 在 D1 控制台执行 `schema.sql`。
3. 为 Pages 配置至少 32 字符的随机密钥 `RFQ_HASH_SALT`。不要写入 GitHub。
4. 配置已确认可公开的 `PUBLIC_CONTACT_EMAIL` 和 1 至 365 的 `RFQ_RETENTION_DAYS`。公开邮箱同时供构建与 Functions 使用；保留期限也需同步到隐私说明。
5. 重新部署，用本人控制的测试信息验证成功响应及 D1 中记录，然后删除测试记录。
6. 接收的数据存于 D1，可在 Cloudflare 控制台查询。当前未配置邮件通知，也没有后台管理页。运营方须安排定期查看，确定回应和删除流程后再启用。

请求受同源、格式、20KB 大小、必填项、蜜罐、填写时间和每 IP 每小时最多 5 次限制。限流用按小时轮换的加盐摘要，不保存原始 IP。询价按配置保留期限随请求清理；如要求严格按时清理，另配定时任务。没有附件上传功能，不接受敏感图纸。


## 内部报价库

内部入口为 `/office`，用于手机和电脑查询料号、参数、供应渠道、历史供应商报价、实际采购记录和客户报价。页面设置为 `noindex`，API 返回 `no-store`，成本和客户数据不会进入静态 HTML。

启用步骤：

1. 确保 Pages 已绑定 D1，变量名继续使用 `RFQ_DB`。
2. 确保生产环境已有至少 32 字符的 `RFQ_HASH_SALT`。
3. 在 Cloudflare Pages 的生产环境新增加密变量 `OFFICE_PASSWORD`，长度至少 12 位。
4. 重新部署后打开 `https://ribloxen.com/office`。首次成功登录时会自动创建 `office_* ` 数据表，无需手工执行迁移。
5. 每个供应商询价、采购和销售报价都单独新增历史记录。不要覆盖旧价格。

登录使用 HttpOnly、Secure、SameSite=Strict 会话 Cookie，有效期 7 天；登录尝试按来源 IP 的加盐摘要限频。密码只保存在 Cloudflare 环境变量，不写入仓库或 D1。

## 内容维护

- 品牌及分类：`src/data/site.ts`
- 产品选型页：`src/content/products/*.md`
- 技术文章：`src/content/knowledge/*.md`
- 品牌样式：`src/styles/global.css`
- 公司及服务页：`src/pages/[page].astro`

当前品牌蓝取自已提供展示板 `#005BAC`，未声称已完成 ShinMaywa 官方品牌色取样。文字字标为网页文字实现，保留原展示板设计，不修改源素材。当前无经核实的产品图片、库存、型号性能表、客户案例、授权证书或工厂实拍，未编造这些内容。

## SEO 与上线边界

所有正文在静态 HTML 中输出。独立标题/描述、唯一 H1、canonical、面包屑、Organization JSON-LD、站点地图和 robots 已生成。搜索和 404 为 noindex；pages.dev 由中间件 noindex。无 Google Fonts、外部 CDN、外部 JS 或验证码依赖。产品页无价格、评分、库存等虚假结构化数据。

中文产品分类及选型文章可供搜索引擎抓取。排名和中国大陆网络速度无法由代码保证。上线后需用真实大陆网络实测，并在相应站长平台完成域名验证与提交；未擅自填入站长凭据、备案号或承诺收录。

当前上线前仍需：确认可公开联系方式、启用并验证询价接收、完成 Cloudflare 域名绑定与大陆实测。商业主体信息由用户提供，未进行独立工商核验。
