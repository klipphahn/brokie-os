#!/bin/zsh
set -e

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$HOME/Downloads/brokie-os-founders-builder"

if [ ! -d "$TARGET_DIR/.git" ]; then
  echo "Expected an existing Git repository at: $TARGET_DIR"
  exit 1
fi

BACKUP_ENV=""
if [ -f "$TARGET_DIR/.env.local" ]; then
  BACKUP_ENV="$(mktemp)"
  cp "$TARGET_DIR/.env.local" "$BACKUP_ENV"
fi

find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name ".git" ! -name ".env.local" -exec rm -rf {} +
cp -R "$SOURCE_DIR"/. "$TARGET_DIR"/
rm -rf "$TARGET_DIR/.git"
# Restore original Git history from current repository is handled by running this script from copied folder only.
echo "Copy the clean project files into your existing repository manually, preserving .git and .env.local."
