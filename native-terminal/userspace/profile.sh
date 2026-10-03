export VSMOBILE_ROOT="${VSMOBILE_ROOT:-$HOME/../}"
export VSMOBILE_HOME="${VSMOBILE_HOME:-$HOME}"
export VSMOBILE_PREFIX="${VSMOBILE_PREFIX:-$VSMOBILE_HOME/prefix}"
export PATH="$VSMOBILE_HOME/bin:$VSMOBILE_PREFIX/bin:/system/bin:/system/xbin"
export TMPDIR="${TMPDIR:-$VSMOBILE_HOME/tmp}"
export PS1="vsmobile:\w$ "
umask 077
