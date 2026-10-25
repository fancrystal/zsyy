# Zsyy Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the zsyy voucher mall independently on the existing Maishikeji ECS, serving its H5 and administrator application over the requested HTTPS domains.

**Architecture:** Nginx terminates TLS for `zsyy.maishikeji.com.cn` and `adminzsyy.maishikeji.com.cn`, serves two independent Vue static builds, and proxies same-origin `/api/` requests to a dedicated Node service at `127.0.0.1:3020`. The service lives in `/opt/zsyy`, runs under a dedicated Unix account, and connects to its own `zsyy_prod` MySQL database; no mskj process, port, files, or tables are shared.

**Tech Stack:** Node.js 24.14.0, pnpm 10.28.2, Express, Vue/Vite, MySQL 8.0, systemd, Nginx 1.20, Certbot, Alibaba Cloud Linux 3.

## Global Constraints

- Server: `47.93.185.61`; all public access through Nginx on ports 80/443.
- Application location: `/opt/zsyy`; API listener: `127.0.0.1:3020`.
- Public domains: `zsyy.maishikeji.com.cn` and `adminzsyy.maishikeji.com.cn`.
- Use a dedicated MySQL database and user named `zsyy_prod`; do not read, write, migrate, or restart `mskj_db` or `mskj-backend`.
- Keep production secrets solely in `/etc/zsyy/zsyy.env`, root-owned and mode `0640`; do not commit them.
- Build locally only after the existing test suite and production build pass; publish static files through versioned release directories and an atomic `current` symlink.
- Back up the targeted Nginx configuration before modification; run `nginx -t` before every reload.

---

### Task 1: Commit isolated production configuration

**Files:**
- Create: `deploy/zsyy.production.conf`
- Create: `deploy/zsyy-api.service`
- Modify: `docs/10-fullstack-guide.md`

- [ ] Confirm both DNS A records resolve to `47.93.185.61`.
- [ ] Add two independent Nginx HTTPS server blocks, both proxying `/api/` to port 3020.
- [ ] Add a systemd unit that uses `/opt/zsyy/current` and `/etc/zsyy/zsyy.env`.
- [ ] Commit after local configuration validation.

### Task 2: Verify and package

**Files:**
- Create: `.release/zsyy-<timestamp>.tar.gz` (local ignored release artifact)

- [ ] Run `node .tools/node_modules/pnpm/bin/pnpm.cjs test` and require zero failures.
- [ ] Run `node .tools/node_modules/pnpm/bin/pnpm.cjs build` and require both production frontend builds to succeed.
- [ ] Archive source excluding `.env`, `.cache`, `.tools`, `node_modules`, `artifacts`, and `.git`.

### Task 3: Provision isolated production runtime

**Files:**
- Create: `/opt/zsyy/releases/<timestamp>/`
- Create: `/opt/zsyy/current` (atomic symlink)
- Create: `/etc/zsyy/zsyy.env`
- Create: `/etc/systemd/system/zsyy-api.service`

- [ ] Back up the current Nginx configuration into root-only storage.
- [ ] Create a `zsyy` system user and `zsyy_prod` MySQL database with a dedicated least-privilege user.
- [ ] Generate unique database, JWT, and initial-account secrets only on the server; never echo them into the local transcript.
- [ ] Upload release; run `pnpm install --prod --frozen-lockfile`; start `zsyy-api.service`.
- [ ] Require `curl -fsS http://127.0.0.1:3020/api/health` to pass before changing Nginx.

### Task 4: Publish HTTPS virtual hosts

**Files:**
- Create: `/etc/nginx/conf.d/zsyy.conf`

- [ ] Install the dedicated virtual host without touching `maishikeji.conf`.
- [ ] Run `nginx -t`, then reload Nginx only on success.
- [ ] Obtain a certificate for exactly both zsyy domains via Certbot; use an approved operational email.
- [ ] Verify HTTP redirect, public HTTPS H5/admin assets, and same-origin `/api/health`.

### Task 5: Acceptance and rollback

**Files:**
- Modify: `docs/10-fullstack-guide.md`

- [ ] Confirm `zsyy-api`, `nginx`, and `mysqld` are active; confirm mskj service remains active.
- [ ] Document URLs, service name, production database name, installed release, verification, and rollback by reverting only the zsyy `current` symlink and restarting only `zsyy-api`.

