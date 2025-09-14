#!/bin/bash

# run-parallel-tests.sh
# A script to run all test files in the generate directory in parallel

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to display usage
usage() {
    echo "Usage: $0"
    echo ""
    echo "This script runs all .yaml test files in testdriver/generate directory in parallel"
    echo ""
    echo "Example:"
    echo "  $0"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Function to run testdriverai for a specific file
run_test_file() {
    local file="$1"
    local filename=$(basename "$file")
    echo "Running testdriverai for $filename"
    bin/testdriverai.js run "$file" --new --write --heal
    echo "Completed $filename"
}

# Change to script directory so relative paths work
cd "$SCRIPT_DIR"

echo "Running parallel processes for each test file..."

# Get all yaml files from the generate directory
GENERATE_DIR="testdriver/generate"
if [ -d "$GENERATE_DIR" ]; then
    # Store process IDs for cleanup
    PIDS=()
    
    # Count files for better logging
    file_count=0
    for yaml_file in "$GENERATE_DIR"/*.yaml; do
        if [ -f "$yaml_file" ]; then
            ((file_count++))
        fi
    done
    
    if [ $file_count -eq 0 ]; then
        echo "No .yaml files found in $GENERATE_DIR"
        exit 1
    fi
    
    echo "Found $file_count test files. Spawning parallel processes..."
    
    # Loop through each file and spawn one process per file
    for yaml_file in "$GENERATE_DIR"/*.yaml; do
        if [ -f "$yaml_file" ]; then
            filename=$(basename "$yaml_file")
            echo "Spawning process for $filename..."
            
            # Spawn one process per file in parallel
            run_test_file "$yaml_file" &
            PIDS+=($!)
        fi
    done
    
    # Wait for all background processes to complete
    echo "Waiting for all $file_count processes to complete..."
    for pid in "${PIDS[@]}"; do
        wait "$pid"
    done
    
    echo "All parallel processes completed!"
else
    echo "Error: Generate directory not found at $GENERATE_DIR"
    echo "Make sure you have run the generate-demo.sh script first to create test files."
    exit 1
fi

echo ""
echo "Parallel test execution complete!"
