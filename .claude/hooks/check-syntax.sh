#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): after an HTML/JS file is changed, check that its JavaScript still parses.
# All app code lives in inline <script> blocks of index.html — one typo there breaks the whole app on the phone.
# Exit 2 = report the error back to Claude so it fixes it right away.
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$f" ] && [ -f "$f" ] || exit 0
case "$f" in
  */ocr/*) exit 0 ;;                       # vendored engine bundle — not ours to check
  *.html) ;;
  *.js|*.cjs|*.mjs) node --check "$f" 2>&1 >/dev/null | head -20 >&2; [ "${PIPESTATUS[0]}" -eq 0 ] || exit 2; exit 0 ;;
  *) exit 0 ;;
esac
tmp=$(mktemp -d)
node -e '
const fs = require("fs"), html = fs.readFileSync(process.argv[1], "utf8");
const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g; let m, i = 0;
while ((m = re.exec(html))) {
  const line = html.slice(0, m.index).split("\n").length;           // keep line numbers matching the HTML
  const ext = /type=["\x27]module/.test(m[1]) ? ".mjs" : ".js";
  fs.writeFileSync(`${process.argv[2]}/s${i++}${ext}`, "\n".repeat(line - 1) + m[2]);
}' "$f" "$tmp"
rc=0
for s in "$tmp"/*; do
  [ -e "$s" ] || continue
  if ! out=$(node --check "$s" 2>&1); then
    echo "Синтаксическая ошибка JavaScript в $f (номера строк совпадают с HTML):" >&2
    echo "$out" | sed "s#$s#$f#g" | head -15 >&2
    rc=2
  fi
done
rm -rf "$tmp"
exit $rc
