#!/bin/sh

state="${1:-idle}"
agent="${2:-generic}"

case "$state" in
  idle|working|attention|complete|error) ;;
  *) exit 2 ;;
esac

agent=$(printf '%s' "$agent" | tr -cd 'A-Za-z0-9._-' | cut -c1-32)
[ -n "$agent" ] || agent="generic"
sequence=$(printf '\033]777;sterm;v=1;state=%s;agent=%s\007' "$state" "$agent")

if ! printf '%s' "$sequence" 2>/dev/null > /dev/tty; then
  printf '%s' "$sequence" >&2
fi
