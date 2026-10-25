# Zsyy Production Deployment Record

Deployment date: 2026-10-25 (Asia/Shanghai)

## Public entry points

| Purpose | URL |
| --- | --- |
| User H5 mall | https://zsyy.maishikeji.com.cn/ |
| Administration | https://adminzsyy.maishikeji.com.cn/ |
| Health check | https://zsyy.maishikeji.com.cn/api/health |

## Installed topology

- Host: `47.93.185.61`
- Private API listener: `127.0.0.1:3020`
- Service: `zsyy-api.service`, runs as Unix account `zsyy`
- Source release: `/opt/zsyy/releases/20261025112026`
- Current source symlink: `/opt/zsyy/current`
- Public static release: `/var/www/zsyy/releases/20261025112026`
- Current static symlink: `/var/www/zsyy/current`
- MySQL schema: `zsyy_prod`; dedicated user: `zsyy_prod@localhost`
- Runtime environment: `/etc/zsyy/zsyy.env`, mode `0640`, owned by `root:zsyy`
- Initial administrator/root application credentials: `/root/zsyy-initial-accounts.txt`, mode `0600`

The application source and database are isolated from `/opt/mskj`, `mskj_db`, port 3000, and `mskj-backend.service`.

## TLS and Nginx

- Dedicated configuration: `/etc/nginx/conf.d/zsyy.conf`
- Certificate: `/etc/letsencrypt/live/zsyy.maishikeji.com.cn/`
- Certificate SANs: `zsyy.maishikeji.com.cn`, `adminzsyy.maishikeji.com.cn`
- Certificate expiry: 2027-01-23
- HTTP requests redirect to HTTPS; ACME HTTP-01 files remain served from `/var/www/zsyy-acme`.
- Certbot scheduled renewal is enabled. The certificate was issued without a notification email at the owner's request; monitor the renewal timer and certificate expiry.

Port 3020 is loopback-only. Although the cloud security group permits 3021 and 3022, zsyy does not use or listen on them: Nginx serves both public frontends over 443 and proxies same-origin `/api/` to 3020.

## Verification evidence

On 2026-10-25:

- Full local suite: 48 tests passed.
- Production H5 and admin builds completed.
- External `/api/health`: JSON response with `status: ok` and `database: connected`.
- External H5 and administrator roots: HTTP 200.
- External HTTP request: HTTP 301 to HTTPS.
- `zsyy-api`, `nginx`, `mysqld`, and `mskj-backend`: all active.

## Release procedure

1. Run the local test suite and build.
2. Upload a source archive excluding `.env`, local caches, dependencies, build artifacts not intended for release, and Git metadata.
3. Extract to a new `/opt/zsyy/releases/<release-id>` directory and run `pnpm install --prod --frozen-lockfile`.
4. Copy H5 and admin `dist` trees to `/var/www/zsyy/releases/<release-id>/mobile` and `/var/www/zsyy/releases/<release-id>/admin`.
5. Atomically switch both `current` symlinks, then restart only `zsyy-api`.
6. Run `nginx -t`; reload Nginx only on success.
7. Verify both pages and the API health endpoint.

## Rollback

Choose the previous release id and switch only zsyy symlinks:

```bash
ln -sfn /opt/zsyy/releases/<previous-release-id> /opt/zsyy/current
ln -sfn /var/www/zsyy/releases/<previous-release-id> /var/www/zsyy/current
systemctl restart zsyy-api
nginx -t && systemctl reload nginx
```

Do not restart, modify, or migrate mskj during a zsyy rollback.

