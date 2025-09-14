#!/bin/bash

# UI Component Generator Script
# This script generates HTML UI components based on user input and serves them locally

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v claude &> /dev/null; then
        print_error "Claude CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install it first: brew install jq"
        exit 1
    fi
    
    if ! command -v npx &> /dev/null; then
        print_error "npx is not installed. Please install Node.js first."
        exit 1
    fi
    
    print_success "All dependencies are available"
}

# Create output directory
setup_output_directory() {
    local output_dir="./generated-ui"
    
    print_info "Setting up output directory: $output_dir"
    
    if [ ! -d "$output_dir" ]; then
        mkdir -p "$output_dir"
        print_success "Created output directory: $output_dir"
    else
        print_info "Output directory already exists: $output_dir"
    fi
    
    echo "$output_dir"
}

# Get UI description from command line argument
get_user_input() {
    local ui_description="$1"
    
    print_info "Processing user input..."
    
    if [ -z "$ui_description" ]; then
        print_error "Usage: $0 \"<UI description>\""
        print_info "Example: $0 \"A responsive login form with email and password fields, a remember me checkbox, and a blue submit button\""
        exit 1
    fi
    
    print_info "Generating UI component: $ui_description"
    echo "$ui_description"
}

# Generate HTML using Claude
generate_html() {
    local ui_description="$1"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    
    print_info "Starting HTML generation for: $ui_description"
    print_info "Generating HTML component..."
    
    # Create a detailed prompt for Claude
    local prompt="Generate a complete, modern HTML page with the following UI component: '$ui_description'

Requirements:
- Create a complete HTML5 document with proper DOCTYPE, head, and body tags
- Include modern CSS styling (you can use inline styles or embedded CSS)
- Make it responsive and visually appealing
- Use semantic HTML elements
- Include any necessary JavaScript for interactivity if relevant
- Add some sample content/placeholder text where appropriate
- Use modern design principles with good typography, spacing, and colors
- Make it production-ready and functional

The component should be self-contained and ready to run in a browser."

    # Call Claude CLI to generate the HTML
    local result
    if ! result=$(claude -p "$prompt" --output-format json 2>/dev/null); then
        print_error "Failed to generate HTML using Claude CLI"
        exit 1
    fi
    
    # Extract the HTML code from the JSON response
    local html_code
    if ! html_code=$(echo "$result" | jq -r '.result' 2>/dev/null); then
        print_error "Failed to parse Claude CLI response"
        exit 1
    fi
    
    if [ -z "$html_code" ] || [ "$html_code" = "null" ]; then
        print_error "No HTML code generated"
        exit 1
    fi
    
    # Extract cost information if available
    local cost
    cost=$(echo "$result" | jq -r '.cost_usd // "N/A"' 2>/dev/null)
    
    print_success "HTML generated successfully (Cost: \$${cost})"
    
    echo "$html_code"
}

# Save HTML to file
save_html() {
    local html_content="$1"
    local output_dir="$2"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local filename="ui-component-${timestamp}.html"
    local filepath="${output_dir}/${filename}"
    
    echo "$html_content" > "$filepath"
    print_success "HTML saved to: $filepath"
    
    echo "$filepath"
}

# Serve the UI component
serve_ui() {
    local filepath="$1"
    local output_dir="$2"
    
    print_info "Starting local server..."
    
    # Change to output directory and start server
    cd "$output_dir"
    
    print_success "Server started! Your UI component is available at:"
    print_success "http://localhost:3000/$(basename "$filepath")"
    print_info "Press Ctrl+C to stop the server"
    
    # Start the server (this will block)
    npx serve -p 3000 .
}

# Main function
main() {
    print_info "Starting UI Component Generator..."
    
    # Check if all required tools are available
    check_dependencies
    
    # Set up output directory
    output_dir=$(setup_output_directory)
    
    # Get user input from command line argument
    ui_description=$(get_user_input "$1")
    
    # Generate HTML
    html_content=$(generate_html "$ui_description")
    
    # Save to file
    filepath=$(save_html "$html_content" "$output_dir")
    
    # Serve the component
    serve_ui "$filepath" "$output_dir"
}

# Run main function
main "$@"
