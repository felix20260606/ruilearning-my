#!/bin/sh
# 🛡 本机跑代码检查（和自动测试同一套）：第一次会把 eslint 装到 tools/node_modules（不进 git）
cd "$(dirname "$0")/.." || exit 1
[ -x tools/node_modules/.bin/eslint ] || npm install --no-save --no-audit --no-fund --prefix tools eslint@10.13.0 globals@17.13.0 >/dev/null || exit 1
tools/node_modules/.bin/eslint -c tools/eslint.config.mjs "web/*.js" && echo "✓ 代码检查通过"
