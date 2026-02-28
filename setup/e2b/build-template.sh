#!/usr/bin/env bash
set -euo pipefail

# ─── build-template.sh ───────────────────────────────────────────────────────
# Build an E2B sandbox template from the Dockerfile in this directory.
#
# Prerequisites:
#   - E2B CLI: npm install -g @e2b/cli
#   - E2B_API_KEY set in environment
#
# Usage:
#   ./build-template.sh              # builds with default alias "testdriver-v7"
#   ./build-template.sh my-alias     # builds with custom alias
# ─────────────────────────────────────────────────────────────────────────────

: "${E2B_API_KEY:?Set E2B_API_KEY — get yours at https://e2b.dev}"

ALIAS="${1:-testdriver-v7}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔═══════════════════════════════════════════════════╗"
echo "║  TestDriver — E2B Template Builder                ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "  Alias:      $ALIAS"
echo "  Dockerfile: $SCRIPT_DIR/Dockerfile"
echo "  Config:     $SCRIPT_DIR/e2b.toml"
echo ""

# Verify e2b CLI is installed
if ! command -v e2b &> /dev/null; then
  echo "ERROR: e2b CLI not found. Install with:"
  echo "  npm install -g @e2b/cli"
  exit 1
fi

# Build the template
cd "$SCRIPT_DIR"
echo "Building E2B template..."
e2b template build --name "$ALIAS" --dockerfile Dockerfile

echo ""
echo "✓ Template built successfully!"
echo ""
echo "Next steps:"
echo "  1. Note the template ID from the output above"
echo "  2. Set it in your API config: E2B_TEMPLATE_ID=<template-id>"
echo "  3. Or launch directly: ./spawn-sandbox.sh"
