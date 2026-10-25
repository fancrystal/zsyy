#!/usr/bin/env bash
set -euo pipefail

# Run as root on the production host. It creates only zsyy-owned resources.
readonly APP_USER=zsyy
readonly APP_GROUP=zsyy
readonly APP_ROOT=/opt/zsyy
readonly PUBLIC_ROOT=/var/www/zsyy
readonly ENV_DIR=/etc/zsyy
readonly ENV_FILE=/etc/zsyy/zsyy.env
readonly CREDENTIALS_FILE=/root/zsyy-initial-accounts.txt
readonly DATABASE_NAME=zsyy_prod
readonly DATABASE_USER=zsyy_prod

[[ "$(id -u)" -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
command -v mysql >/dev/null
command -v openssl >/dev/null

if ! getent group "$APP_GROUP" >/dev/null; then
  groupadd --system "$APP_GROUP"
fi
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --gid "$APP_GROUP" --home-dir "$APP_ROOT" --shell /sbin/nologin "$APP_USER"
fi

install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$APP_ROOT" "$APP_ROOT/releases"
install -d -o root -g root -m 0755 "$PUBLIC_ROOT" "$PUBLIC_ROOT/releases"
install -d -o root -g "$APP_GROUP" -m 0750 "$ENV_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  db_password="$(openssl rand -hex 32)"
  jwt_user_secret="$(openssl rand -hex 48)"
  jwt_admin_secret="$(openssl rand -hex 48)"
  admin_password="$(openssl rand -hex 16)"
  root_password="$(openssl rand -hex 16)"

  umask 027
  {
    printf 'NODE_ENV=production\n'
    printf 'PORT=3020\n'
    printf 'DB_HOST=127.0.0.1\n'
    printf 'DB_PORT=3306\n'
    printf 'DB_NAME=%s\n' "$DATABASE_NAME"
    printf 'TEST_DB_NAME=zsyy_test_unused\n'
    printf 'DB_USER=%s\n' "$DATABASE_USER"
    printf 'DB_PASSWORD=%s\n' "$db_password"
    printf 'JWT_USER_SECRET=%s\n' "$jwt_user_secret"
    printf 'JWT_ADMIN_SECRET=%s\n' "$jwt_admin_secret"
    printf 'INIT_ADMIN_USERNAME=admin\n'
    printf 'INIT_ADMIN_PASSWORD=%s\n' "$admin_password"
    printf 'INIT_ROOT_USERNAME=root\n'
    printf 'INIT_ROOT_PASSWORD=%s\n' "$root_password"
  } > "$ENV_FILE"
  chown root:"$APP_GROUP" "$ENV_FILE"
  chmod 0640 "$ENV_FILE"

  {
    printf 'Zsyy initial administrator credentials (keep this file private)\n'
    printf 'Admin URL: https://adminzsyy.maishikeji.com.cn/\n'
    printf 'Username: admin\nPassword: %s\n\n' "$admin_password"
    printf 'Initial root user\nUsername: root\nPassword: %s\n' "$root_password"
  } > "$CREDENTIALS_FILE"
  chmod 0600 "$CREDENTIALS_FILE"
fi

set -a
. "$ENV_FILE"
set +a
zsyy_database_password="$DB_PASSWORD"

mysql_command=(mysql --protocol=socket)
if ! "${mysql_command[@]}" -e 'SELECT 1' >/dev/null 2>&1; then
  : "${MYSQL_ADMIN_ENV_FILE:?Set MYSQL_ADMIN_ENV_FILE to an existing protected MySQL credential file.}"
  [[ -r "$MYSQL_ADMIN_ENV_FILE" ]] || { echo 'MySQL administrator credential file is not readable.' >&2; exit 1; }
  set -a
  . "$MYSQL_ADMIN_ENV_FILE"
  set +a
  : "${DB_HOST:?DB_HOST missing in MYSQL_ADMIN_ENV_FILE}"
  : "${DB_USER:?DB_USER missing in MYSQL_ADMIN_ENV_FILE}"
  : "${DB_PASSWORD:?DB_PASSWORD missing in MYSQL_ADMIN_ENV_FILE}"
  mysql_command=(mysql --protocol=TCP --host="$DB_HOST" --port="${DB_PORT:-3306}" --user="$DB_USER" "--password=$DB_PASSWORD")
fi

"${mysql_command[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DATABASE_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$DATABASE_USER'@'localhost' IDENTIFIED BY '$zsyy_database_password';
ALTER USER '$DATABASE_USER'@'localhost' IDENTIFIED BY '$zsyy_database_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON \`$DATABASE_NAME\`.* TO '$DATABASE_USER'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "Provisioned user $APP_USER and database $DATABASE_NAME. Credentials are stored in $CREDENTIALS_FILE."
