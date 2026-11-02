#!/usr/bin/env bash
# PreToolUse (Bash): before a `git push`, if the app (index.html / ocr/) changed compared with the remote,
# require that APP_VERSION (index.html) and CACHE (sw.js) were changed too —
# otherwise phones keep the old cached app and the header shows the wrong version.
cmd=$(jq -r '.tool_input.command // empty')
echo "$cmd" | grep -qE '(^|[;&|[:space:]])git[[:space:]]+push' || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
branch=$(git rev-parse --abbrev-ref HEAD)
base=$(git rev-parse --verify -q "origin/$branch" || true)
[ -n "$base" ] || exit 0                       # first push of a branch: nothing to compare with
git diff --quiet "$base" HEAD -- index.html ocr/ && exit 0   # app not changed → fine
problems=()
git diff "$base" HEAD -- index.html | grep -qE '^\+.*const APP_VERSION = ' || problems+=("APP_VERSION в index.html (номер версии в шапке)")
git diff "$base" HEAD -- sw.js | grep -qE '^\+.*const CACHE = ' || problems+=("CACHE в sw.js (иначе телефоны не скачают новую версию)")
[ ${#problems[@]} -eq 0 ] && exit 0
{
  echo "Отправка остановлена: приложение изменилось, но не обновлено:"
  for p in "${problems[@]}"; do echo "  - $p"; done
  echo "Поднимите их (навык /release делает это сам), закоммитьте и повторите git push."
} >&2
exit 2
