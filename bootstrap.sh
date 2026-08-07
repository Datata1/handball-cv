#!/usr/bin/env sh
# bootstrap.sh — run once on a fresh Linux/WSL machine before 'make setup'.
# Does not require make, uv, or xz to already be installed.
set -e

if [ "$(uname -s)" != "Linux" ]; then
  echo "This script is for Linux/WSL only."
  echo "macOS: install uv from https://docs.astral.sh/uv/getting-started/installation/"
  exit 0
fi

# ── make ────────────────────────────────────────────────────────────────────
if ! command -v make > /dev/null 2>&1; then
  echo "Installing make..."
  if command -v apt-get > /dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y make
  elif command -v dnf > /dev/null 2>&1; then
    sudo dnf install -y make
  elif command -v pacman > /dev/null 2>&1; then
    sudo pacman -S --noconfirm make
  else
    echo "ERROR: cannot detect package manager. Install 'make' manually." && exit 1
  fi
fi

# ── xz-utils (needed to unpack the moon binary) ─────────────────────────────
if ! command -v xz > /dev/null 2>&1; then
  echo "Installing xz-utils..."
  if command -v apt-get > /dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y xz-utils
  elif command -v dnf > /dev/null 2>&1; then
    sudo dnf install -y xz
  elif command -v pacman > /dev/null 2>&1; then
    sudo pacman -S --noconfirm xz
  else
    echo "ERROR: cannot detect package manager. Install 'xz-utils' manually." && exit 1
  fi
fi

# ── uv ──────────────────────────────────────────────────────────────────────
if ! command -v uv > /dev/null 2>&1; then
  echo "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  # shellcheck source=/dev/null
  . "$HOME/.local/bin/env"
  echo ""
  echo "uv installed and activated for this shell session."
fi

# ── Python 3.12 (via uv — no system Python needed) ─────────────────────────
echo "Installing Python 3.12 via uv..."
uv python install 3.12

echo ""
echo "All prerequisites satisfied. Run: make setup"
