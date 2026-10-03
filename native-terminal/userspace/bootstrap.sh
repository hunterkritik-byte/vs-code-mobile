#!/system/bin/sh
set -eu
ROOT="$1"
[ -n "$ROOT" ] || exit 2
mkdir -p "$ROOT/bin" "$ROOT/home" "$ROOT/prefix/bin" "$ROOT/tmp" "$ROOT/workspace"
cat > "$ROOT/home/.profile" <<'PROFILE'
export VSMOBILE_ROOT="$(cd "$HOME/.." && pwd)"
export VSMOBILE_PREFIX="$VSMOBILE_ROOT/prefix"
export PATH="$VSMOBILE_ROOT/bin:$VSMOBILE_PREFIX/bin:/system/bin:/system/xbin"
export TMPDIR="$VSMOBILE_ROOT/tmp"
export PS1="vsmobile:\w$ "
umask 077
PROFILE
chmod 700 "$ROOT/home/.profile"
echo "VS Code Mobile userspace initialized at $ROOT"
