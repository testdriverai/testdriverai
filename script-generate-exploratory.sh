#!/bin/bash

# generate-demo.sh
# A script to clone testdriver example platforms to the testdriver folder

set -e  # Exit on any error

# Default values
PLATFORM=""
RUN_ONLY=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLES_DIR="$SCRIPT_DIR/testdriver/examples"
TARGET_DIR="$SCRIPT_DIR/testdriver"

# Function to display usage
usage() {
    echo "Usage: $0 [--platform <platform_name>] [--run-only]"
    echo ""
    echo "Options:"
    echo "  --platform   Platform name from testdriver/examples folder"
    echo "  --run-only   Skip generation and only run parallel tests"
    echo ""
    echo "Available platforms:"
    for dir in "$EXAMPLES_DIR"/*; do
        if [ -d "$dir" ]; then
            echo "  - $(basename "$dir")"
        fi
    done
    echo ""
    echo "Examples:"
    echo "  $0 --platform web"
    echo "  $0 --run-only"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --run-only)
            RUN_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required parameters
if [ -z "$PLATFORM" ]; then
    echo "Error: --platform parameter is required"
    usage
fi

# Validate that the platform exists
PLATFORM_SOURCE="$EXAMPLES_DIR/$PLATFORM"
if [ ! -d "$PLATFORM_SOURCE" ]; then
    echo "Error: Platform '$PLATFORM' does not exist in testdriver/examples"
    echo ""
    echo "Available platforms:"
    for dir in "$EXAMPLES_DIR"/*; do
        if [ -d "$dir" ]; then
            echo "  - $(basename "$dir")"
        fi
    done
    exit 1
fi

echo "Cloning platform '$PLATFORM' to testdriver folder..."

# Copy the platform directory contents to the testdriver directory
cp -r "$PLATFORM_SOURCE"/* "$TARGET_DIR/"

echo "Successfully cloned '$PLATFORM' platform to testdriver folder"

echo ""
echo "Running testdriverai generate..."

# Run testdriverai generate from the root directory so it can find .env
cd "$SCRIPT_DIR"
"$SCRIPT_DIR/bin/testdriverai.js" generate

echo ""
echo "Running parallel processes for each test file..."

# Function to run testdriverai for a specific file
run_test_file() {
    local file="$1"
    local filename=$(basename "$file")
    echo "Running testdriverai for $filename"
    bin/testdriverai.js run "$file"
    echo "Completed $filename"
}

echo ""
echo "Demo generation complete!"
