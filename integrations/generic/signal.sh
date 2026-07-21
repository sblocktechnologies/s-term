#!/bin/sh

state="${1:-idle}"
agent="${2:-generic}"

case "$state" in
  idle|working|attention|complete|error) ;;
  *) exit 2 ;;
esac

agent=$(printf '%s' "$agent" | tr -cd 'A-Za-z0-9._-' | cut -c1-32)
[ -n "$agent" ] || agent="generic"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if command -v node >/dev/null 2>&1 && [ -f "$script_dir/telemetry.cjs" ]; then
  exec node "$script_dir/telemetry.cjs" hook "$state" "$agent"
fi

sequence=$(printf '\033]777;sterm;v=1;state=%s;agent=%s\007' "$state" "$agent")
if ! printf '%s' "$sequence" 2>/dev/null > /dev/tty; then
  printf '%s' "$sequence" >&2
fi
