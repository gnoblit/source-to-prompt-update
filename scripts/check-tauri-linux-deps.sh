#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAURI_DIR="$ROOT_DIR/apps/tauri/src-tauri"

if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1090
  . "$HOME/.cargo/env"
fi

is_wsl=0
if grep -qi "microsoft" /proc/version 2>/dev/null; then
  is_wsl=1
fi

echo "Checking Tauri Linux desktop prerequisites..."
echo

if (( is_wsl == 1 )); then
  echo "WSL detected."
  echo "This check validates Linux desktop prerequisites only."
  echo "Native Windows Tauri validation still needs to happen on Windows."
  echo
fi

missing_tools=()
missing_pkg_configs=()

require_tool() {
  local tool="$1"
  if command -v "$tool" >/dev/null 2>&1; then
    printf '  [ok] tool: %s\n' "$tool"
  else
    printf '  [missing] tool: %s\n' "$tool"
    missing_tools+=("$tool")
  fi
}

require_pkg_config() {
  local package="$1"
  if pkg-config --exists "$package"; then
    printf '  [ok] pkg-config: %s\n' "$package"
  else
    printf '  [missing] pkg-config: %s\n' "$package"
    missing_pkg_configs+=("$package")
  fi
}

require_tool bash
require_tool pkg-config
require_tool rustup
require_tool cargo

if command -v pkg-config >/dev/null 2>&1; then
  echo
  require_pkg_config cairo
  require_pkg_config pango
  require_pkg_config atk
  require_pkg_config gdk-3.0
  require_pkg_config gdk-pixbuf-2.0
  require_pkg_config webkit2gtk-4.1
  require_pkg_config javascriptcoregtk-4.1
  require_pkg_config libsoup-3.0
fi

echo
if [[ -d "$TAURI_DIR" ]] && command -v cargo >/dev/null 2>&1; then
  echo "Manifest found: $TAURI_DIR/Cargo.toml"
else
  echo "Tauri manifest not checked because cargo or manifest is missing."
fi

echo
if (( ${#missing_tools[@]} == 0 && ${#missing_pkg_configs[@]} == 0 )); then
  echo "Tauri Linux prerequisites look good."
  exit 0
fi

echo "Missing prerequisites detected."
echo

if (( ${#missing_tools[@]} > 0 )); then
  echo "Missing tools:"
  for tool in "${missing_tools[@]}"; do
    printf '  - %s\n' "$tool"
  done
  echo
fi

if (( ${#missing_pkg_configs[@]} > 0 )); then
  echo "Missing system libraries:"
  for package in "${missing_pkg_configs[@]}"; do
    printf '  - %s\n' "$package"
  done
  echo
fi

cat <<'EOF'
Official Tauri v2 Ubuntu/Debian prerequisites:

  bash scripts/install-tauri-linux-deps.sh

Additional packages commonly needed for local WebDriver and pkg-config discovery:

  included in scripts/install-tauri-linux-deps.sh

After installing packages, rerun:

  npm --workspace @ysp/tauri run doctor:linux
  npm --workspace @ysp/tauri run cargo:check
EOF

exit 1
