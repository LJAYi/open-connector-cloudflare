# OpenConnector for Cloudflare

An unofficial, community-maintained one-click Cloudflare deployment template for
[oomol-lab/open-connector](https://github.com/oomol-lab/open-connector).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LJAYi/open-connector-cloudflare)

This repository follows stable OpenConnector releases and packages them for Cloudflare Workers.
It is not affiliated with or endorsed by OOMOL.

## What the deployment creates

Clicking the button asks Cloudflare to:

1. Create a new copy of this repository in your GitHub or GitLab account.
2. Create and bind a D1 database as `DB`.
3. Create and bind an R2 bucket as `TRANSIT_FILES`.
4. Ask you for the two required Worker secrets listed below.
5. Apply the D1 migrations, build the Web Console, and deploy the Worker.
6. Connect the new repository to Workers Builds for future deployments.

The generated repository belongs to you. It is a standalone copy rather than a GitHub fork.

## Required secrets

Generate two different long random values and save them in a password manager:

| Secret                         | Purpose                                                               |
| ------------------------------ | --------------------------------------------------------------------- |
| `OOMOL_CONNECT_ADMIN_TOKEN`    | Signs in to the Web Console and authenticates the admin API.          |
| `OOMOL_CONNECT_ENCRYPTION_KEY` | Encrypts stored credentials and OAuth client configuration inside D1. |

Do not reuse one value for both secrets. If the encryption key is lost or changed, existing
encrypted credentials cannot be recovered.

`OOMOL_CONNECT_RUNTIME_TOKEN` is optional. You can create runtime tokens later from the Web
Console, so the one-click deployment does not request it.

## Automatic updates

The included GitHub Actions workflow checks the latest stable upstream Release every day at
04:02 Beijing time (20:02 UTC). When a new release is available, it:

1. Replaces the application source with the immutable upstream Release.
2. Restores this template's Cloudflare configuration and update workflow.
3. Installs dependencies and runs lint, formatting, type checks, tests, the Web Console build, and
   a Wrangler dry run.
4. Pushes the verified update to `main`.
5. Lets Cloudflare Workers Builds deploy the new commit and apply pending D1 migrations.

If validation fails, no commit is pushed and the currently deployed version keeps running.
Code-only updates do not delete D1 data, R2 objects, custom domains, or Worker secrets.

The sync also reserves headroom below Cloudflare Free plan hard limits. It stops before updating
`main` if the Worker gzip size exceeds 2.7 MiB, an individual static asset exceeds 23 MiB, or the
build contains more than 18,000 static assets. The workflow log identifies the exceeded guard so a
release that has outgrown the Free plan is not deployed automatically.

The workflow intentionally restores upstream application files on every release. Keep deployment
customizations in Cloudflare settings or in separate branches; custom changes to tracked
application files on `main` may be replaced by the next automatic update.

You can also run the update immediately from **Actions → Sync latest upstream release → Run
workflow**.

## Manual deployment

The Deploy to Cloudflare button is recommended. For a manual deployment:

```bash
npm install
npx wrangler login
npx wrangler secret put OOMOL_CONNECT_ADMIN_TOKEN
npx wrangler secret put OOMOL_CONNECT_ENCRYPTION_KEY
npm run deploy
```

The deployment command generates the provider catalog, builds the Web Console, applies D1
migrations, and deploys the Worker.

## Storage choice

This template uses R2 for temporary transit files so it supports files larger than Workers KV's
per-value limit. Depending on your Cloudflare account, enabling R2 may require a payment method,
even when usage stays within the free allowance. OpenConnector also supports KV when configured
manually; see the
[upstream Cloudflare guide](https://github.com/oomol-lab/open-connector/blob/main/docs/cloudflare.md).

## Upstream and support

- OpenConnector source and documentation:
  [oomol-lab/open-connector](https://github.com/oomol-lab/open-connector)
- Template deployment issues:
  [LJAYi/open-connector-cloudflare/issues](https://github.com/LJAYi/open-connector-cloudflare/issues)
- Cloudflare Deploy Button documentation:
  [Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)

OpenConnector is licensed under the Apache License, Version 2.0. The upstream license and notices
are preserved in [LICENSE.txt](LICENSE.txt) and [NOTICE.md](NOTICE.md).

---

## 中文说明

这是 [oomol-lab/open-connector](https://github.com/oomol-lab/open-connector) 的非官方
Cloudflare 一键部署模板，由社区维护，并非 OOMOL 官方项目。

点击上方按钮后，Cloudflare 会在你的 GitHub 或 GitLab 账户中创建一个独立的新仓库，
自动创建并绑定 D1 和 R2，要求填写管理员 Token 与加密密钥，然后完成数据库迁移、前端
构建和 Worker 部署。它不会要求你预先 Fork 上游仓库。

部署完成后，新仓库的 `main` 每次产生提交，Cloudflare Workers Builds 都会自动构建和
部署。仓库内置的 GitHub Actions 会在北京时间每天凌晨 04:02 检查上游正式 Release；
只有在完整验证通过后才更新 `main`。代码更新不会删除 D1、R2、域名或 Worker Secrets。

同步流程还会预留 Cloudflare 免费计划的安全余量：Worker gzip 超过 2.7 MiB、单个静态
资源超过 23 MiB，或者静态资源超过 18,000 个时停止更新 `main`，避免自动部署已经不再
适合免费计划的上游版本。

必须妥善保存并使用两个不同的随机值：

- `OOMOL_CONNECT_ADMIN_TOKEN`：登录 Web Console 和调用管理接口。
- `OOMOL_CONNECT_ENCRYPTION_KEY`：加密 D1 中保存的凭据和 OAuth 配置；丢失后无法解密
  已有数据。

Runtime Token 无需在首次部署时创建，之后可以在 Web Console 中按需创建多个。
