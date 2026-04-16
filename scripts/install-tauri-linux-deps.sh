#!/usr/bin/env bash

set -euo pipefail

packages=(
  libwebkit2gtk-4.1-dev
  build-essential
  curl
  wget
  file
  libxdo-dev
  libssl-dev
  libayatana-appindicator3-dev
  librsvg2-dev
  webkit2gtk-driver
  pkg-config
)

echo "Installing Linux desktop prerequisites for the Tauri shell..."
echo
echo "This installs the GTK/WebKit development packages that Linux Tauri needs."
echo "A sudo password may be required."
echo

sudo apt update
sudo apt install -y "${packages[@]}"

echo
echo "Linux Tauri prerequisites installed."
echo "Next steps:"
echo "  npm run tauri:doctor:linux"
echo "  npm run tauri:check"
