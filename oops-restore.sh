#!/usr/bin/env bash
# Undo the string replacement of the `oops` branch: turn every
# __will_be_noop*__ placeholder back into the name it stands for, so a checkout
# of oops matches main byte for byte.
#
# Usage: oops-restore.sh [--check] [DIR]
#   DIR      checkout to restore (default: current directory). When DIR is the
#            top of a git checkout, only tracked files are touched; otherwise
#            every regular file under DIR except .git/.
#   --check  list the files that would change, change nothing.
#
# Runs on macOS (bash 3.2, BSD grep/find/xargs) and Linux (GNU tools). Needs
# bash, perl, grep, find, xargs; git only for the tracked-files mode.
# Symlinks are skipped: perl -i would replace them with regular files.
#
# The original names are built from pieces on purpose: this file must not
# contain them, so it can travel through the company mirror. Keep the table
# in sync with REPLACEMENTS in oops-gate.sh.
set -euo pipefail
export LC_ALL=C # byte semantics: grep must not skip files it thinks are not text

usage() { sed -n '6,10p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

check=0
case "${1:-}" in
	--check) check=1; shift ;;
	-h | --help) usage ;;
	-*) echo "unknown option: $1" >&2; usage ;;
esac
[ $# -le 1 ] || usage
cd "${1:-.}"
for tool in perl grep find xargs; do
	command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 2; }
done

# placeholder                         original
MAP=(
	'__will_be_noop__'                  'Bun.''spawn'
	'__will_be_noop_subprocess__'       'child_''process'
	'__will_be_noop_compile__('         'comp''ile('
	'__will_be_noop_run_sync__'         'spa''wnSync'
	'__will_be_noop_run__'              'spa''wn'
	'__will_be_noop_run_file_sync__'    'exec''FileSync'
	'__will_be_noop_run_file__'         'exec''File'
)

# Physical absolute path, without `realpath` or `readlink -f` (missing on older macOS).
abspath() { (cd "$(dirname "$1")" && printf '%s/%s\n' "$(pwd -P)" "$(basename "$1")"); }
self=$(abspath "${BASH_SOURCE[0]}")
here=$(pwd -P)

top=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -n "$top" ] && [ "$(cd "$top" && pwd -P)" = "$here" ]; then
	mode="tracked files of the git checkout"
	list() { git ls-files -z; }
else
	mode="regular files under the directory"
	list() { find . -path ./.git -prune -o -type f -print0; }
fi

files=()
while IFS= read -r -d '' f; do
	[ -L "$f" ] && continue
	[ "$(abspath "$f")" = "$self" ] && continue
	files+=("$f")
done < <(list | xargs -0 grep -lF --null '__will_be_noop' -- 2>/dev/null || true)

if [ ${#files[@]} -eq 0 ]; then echo "no placeholders found in $here ($mode)"; exit 0; fi

if [ $check = 1 ]; then
	printf '%s\n' "${files[@]}"
	echo "${#files[@]} files would be restored in $here ($mode)"
	exit 0
fi

# Bash strings cannot hold NUL, so the pairs are joined with the unit separator.
# One pass, longest placeholder first, so no placeholder is matched inside another.
pairs=$(printf '%s\037' "${MAP[@]}")
PAIRS="$pairs" perl -pi -e '
	BEGIN {
		%m = split /\x1f/, $ENV{PAIRS};
		$re = join "|", map { quotemeta } sort { length($b) <=> length($a) } keys %m;
	}
	s/($re)/$m{$1}/g;
' "${files[@]}"

left=$(printf '%s\0' "${files[@]}" | xargs -0 grep -nF '__will_be_noop' -- 2>/dev/null || true)
if [ -n "$left" ]; then
	echo "FAIL unknown placeholders left:" >&2; printf '%s\n' "$left" | head -5 >&2; exit 1
fi
echo "restored ${#files[@]} files in $here ($mode)"
