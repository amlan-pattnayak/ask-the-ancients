#!/usr/bin/env bash
set -euo pipefail

echo "==> Security pre-publish checks"

echo
echo "1) Checking tracked secret-like files..."
git ls-files | rg -n '(^|/)(\.env|\.env\.|\.vercel|secrets?|id_rsa|\.pem|credentials|\.p12|\.key$|\.crt$)' || true

echo
echo "2) Scanning working tree for high-signal secret patterns..."
rg -n --hidden \
  --glob '!.git' \
  --glob '!node_modules' \
  --glob '!.next' \
  --glob '!bun.lock' \
  '(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{20,}|sk_test_[0-9a-zA-Z]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{20,}|AIza[0-9A-Za-z\-_]{35}|-----BEGIN (RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----|sk-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9_-]{20,}|xai-[A-Za-z0-9_-]{20,})' \
  || true

echo
echo "3) Scanning git history for leaked keys..."
git rev-list --all | while read -r c; do
  git grep -nE \
    'AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----|sk-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9_-]{20,}|xai-[A-Za-z0-9_-]{20,}' \
    "$c" -- . ':(exclude)bun.lock' ':(exclude)node_modules' || true
done | head -n 200

echo
echo "4) Running dependency vulnerability audit..."
bun audit || true

echo
echo "Done. Review output above before publishing."
