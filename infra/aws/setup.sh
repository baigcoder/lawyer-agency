#!/bin/bash
# One-time setup for the Wakeel backend on a fresh Ubuntu 24.04 EC2 instance.
# Run from the repo root on the instance:
#
#   sudo bash infra/aws/setup.sh <api-domain> <dashboard-url>
#   e.g. sudo bash infra/aws/setup.sh wakeel-api.duckdns.org https://lawyer-agency-web.vercel.app
#
# Idempotent: re-running keeps existing secrets and only fills what is missing.
# Guide: docs/infrastructure/AWS_FREE_TIER.md
set -euo pipefail

API_DOMAIN="${1:?usage: setup.sh <api-domain> <dashboard-url>}"
APP_PUBLIC_URL="${2:?usage: setup.sh <api-domain> <dashboard-url>}"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo." >&2
  exit 1
fi

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y docker.io docker-compose-v2
  systemctl enable --now docker
fi
if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "$SUDO_USER"
fi

echo "==> Adding 4 GB swap (the stack is tight on a 2 GB instance)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-wakeel-swap.conf
fi

# Hex secrets only: they are embedded in connection URLs unescaped.
secret() { openssl rand -hex "$1"; }

# Sets KEY=VALUE in FILE only when KEY is missing or empty.
fill() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=." "$file"; then
    return
  fi
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

echo "==> Writing .env (infra secrets)"
touch .env
chmod 600 .env
fill .env API_DOMAIN "$API_DOMAIN"
fill .env APP_PUBLIC_URL "$APP_PUBLIC_URL"
fill .env POSTGRES_PASSWORD "$(secret 24)"
fill .env APP_USER_PASSWORD "$(secret 24)"
fill .env EVOLUTION_DB_PASSWORD "$(secret 24)"
fill .env EVOLUTION_API_KEY "$(secret 24)"

echo "==> Writing .env.app (app config)"
[ -f .env.app ] || cp infra/aws/env.app.example .env.app
chmod 600 .env.app
fill .env.app MASTER_ENCRYPTION_KEY "$(secret 32)"
fill .env.app EVOLUTION_WEBHOOK_SECRET "$(secret 24)"
if ! grep -q '^VAPID_PUBLIC_KEY=.' .env.app; then
  vapid="$(docker run --rm node:22-alpine npx -y web-push generate-vapid-keys --json)"
  fill .env.app VAPID_PUBLIC_KEY "$(echo "$vapid" | sed -E 's/.*"publicKey":"([^"]+)".*/\1/')"
  fill .env.app VAPID_PRIVATE_KEY "$(echo "$vapid" | sed -E 's/.*"privateKey":"([^"]+)".*/\1/')"
fi
if [ -n "${SUDO_USER:-}" ]; then
  chown "$SUDO_USER" .env .env.app
fi

missing=""
for key in CLERK_SECRET_KEY VAPID_SUBJECT EMAIL_FROM; do
  if ! grep -q "^${key}=." .env.app || grep -q "^${key}=.*example\.com" .env.app; then
    missing="$missing $key"
  fi
done

echo
if [ -n "$missing" ]; then
  echo "Almost done. Edit .env.app and set:$missing (plus an AI provider key),"
  echo "then start the stack:"
else
  echo "Setup complete. Start the stack:"
fi
echo
echo "  docker compose -f docker-compose.aws.yml up -d --build"
echo
echo "Log out and back in first if 'docker' needs sudo (docker group was just added)."
