#!/bin/bash

# Comprehensive Budibase MCP Server Test Runner
# This script runs the complete test suite with proper setup and cleanup

set -e  # Exit on any error

echo "🧪 Budibase MCP Server - Comprehensive Test Suite"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_RESULTS_DIR="$PROJECT_DIR/test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Function to print colored output
print_status() {
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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        print_error ".env file not found. Please create it with BUDIBASE_URL and BUDIBASE_API_KEY"
        exit 1
    fi
    
    # Check if dist directory exists
    if [ ! -d "$PROJECT_DIR/dist" ]; then
        print_warning "dist directory not found. Building project..."
        npm run build
    fi
    
    print_success "Prerequisites check passed"
}

# Function to setup test environment
setup_test_environment() {
    print_status "Setting up test environment..."
    
    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Create backup of any existing test results
    if [ -f "test-results.json" ]; then
        mv "test-results.json" "$TEST_RESULTS_DIR/test-results-backup-$TIMESTAMP.json"
        print_status "Backed up existing test results"
    fi
    
    print_success "Test environment setup complete"
}

# Function to run the test suite
run_test_suite() {
    print_status "Starting comprehensive test suite..."
    
    # Start time tracking
    START_TIME=$(date +%s)
    
    # Run the main test suite
    if node "$PROJECT_DIR/tests/suite.js"; then
        print_success "Test suite completed successfully"
        TEST_EXIT_CODE=0
    else
        print_error "Test suite completed with failures"
        TEST_EXIT_CODE=1
    fi
    
    # End time tracking
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    print_status "Test suite duration: ${DURATION}s"
    
    return $TEST_EXIT_CODE
}

# Function to generate test report
generate_test_report() {
    print_status "Generating test report..."
    
    if [ -f "test-results.json" ]; then
        # Move results to timestamped file
        cp "test-results.json" "$TEST_RESULTS_DIR/test-results-$TIMESTAMP.json"
        
        # Generate HTML report if possible
        if command -v python3 &> /dev/null; then
            cat << 'EOF' > generate_report.py
import json
import sys
from datetime import datetime

def generate_html_report(results_file, output_file):
    with open(results_file, 'r') as f:
        data = json.load(f)
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Budibase MCP Server Test Results</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #f0f0f0; padding: 20px; border-radius: 5px; }}
        .summary {{ display: flex; gap: 20px; margin: 20px 0; }}
        .stat {{ background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }}
        .passed {{ border-color: #4CAF50; }}
        .failed {{ border-color: #f44336; }}
        .skipped {{ border-color: #ff9800; }}
        .performance {{ margin: 20px 0; }}
        .error-list {{ background: #ffebee; padding: 15px; border-radius: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Budibase MCP Server Test Results</h1>
        <p>Generated: {data['timestamp']}</p>
    </div>
    
    <div class="summary">
        <div class="stat passed">
            <h3>{data['summary']['passed']}</h3>
            <p>Passed</p>
        </div>
        <div class="stat failed">
            <h3>{data['summary']['failed']}</h3>
            <p>Failed</p>
        </div>
        <div class="stat skipped">
            <h3>{data['summary']['skipped']}</h3>
            <p>Skipped</p>
        </div>
    </div>
    
    <div class="performance">
        <h2>Performance Results</h2>
        <table>
            <tr><th>Test</th><th>Duration (ms)</th></tr>
"""
    
    for test, duration in data.get('performance', {}).items():
        html += f"<tr><td>{test}</td><td>{duration:.2f}</td></tr>"
    
    html += """
        </table>
    </div>
    
    <div class="error-list">
        <h2>Failed Tests</h2>
"""
    
    if data['errors']:
        for error in data['errors']:
            html += f"<p><strong>{error['category']} > {error['test']}</strong>: {error['error']}</p>"
    else:
        html += "<p>No failed tests! 🎉</p>"
    
    html += """
    </div>
</body>
</html>
"""
    
    with open(output_file, 'w') as f:
        f.write(html)

if __name__ == "__main__":
    generate_html_report(sys.argv[1], sys.argv[2])
EOF
            
            python3 generate_report.py "test-results.json" "$TEST_RESULTS_DIR/test-report-$TIMESTAMP.html"
            rm generate_report.py
            print_success "HTML report generated: $TEST_RESULTS_DIR/test-report-$TIMESTAMP.html"
        fi
        
        print_success "Test results saved to: $TEST_RESULTS_DIR/test-results-$TIMESTAMP.json"
    else
        print_warning "No test results file found"
    fi
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Remove any temporary files
    rm -f generate_report.py
    
    print_success "Cleanup complete"
}

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -q, --quick    Run quick test suite (limited tests)"
    echo "  -p, --perf     Run performance tests only"
    echo "  -s, --security Run security tests only"
    echo "  --no-cleanup   Skip cleanup phase"
    echo "  --no-report    Skip report generation"
    echo ""
    echo "Examples:"
    echo "  $0                 # Run full test suite"
    echo "  $0 --quick         # Run quick tests only"
    echo "  $0 --perf          # Run performance tests only"
    echo "  $0 --no-cleanup    # Run tests without cleanup"
}

# Parse command line arguments
QUICK_MODE=false
PERF_ONLY=false
SECURITY_ONLY=false
SKIP_CLEANUP=false
SKIP_REPORT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -q|--quick)
            QUICK_MODE=true
            shift
            ;;
        -p|--perf)
            PERF_ONLY=true
            shift
            ;;
        -s|--security)
            SECURITY_ONLY=true
            shift
            ;;
        --no-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --no-report)
            SKIP_REPORT=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_status "Starting Budibase MCP Server Test Suite"
    
    # Trap to ensure cleanup on exit
    trap cleanup EXIT
    
    # Run the test workflow
    check_prerequisites
    setup_test_environment
    
    # Set environment variables for test modes
    if [ "$QUICK_MODE" = true ]; then
        export TEST_MODE="quick"
        print_status "Running in quick mode"
    elif [ "$PERF_ONLY" = true ]; then
        export TEST_MODE="performance"
        print_status "Running performance tests only"
    elif [ "$SECURITY_ONLY" = true ]; then
        export TEST_MODE="security"
        print_status "Running security tests only"
    fi
    
    if [ "$SKIP_CLEANUP" = true ]; then
        export SKIP_CLEANUP="true"
        print_warning "Cleanup will be skipped"
    fi
    
    # Run the actual tests
    if run_test_suite; then
        print_success "All tests completed successfully!"
        EXIT_CODE=0
    else
        print_error "Some tests failed"
        EXIT_CODE=1
    fi
    
    # Generate reports unless skipped
    if [ "$SKIP_REPORT" = false ]; then
        generate_test_report
    fi
    
    # Final summary
    echo ""
    echo "============================================="
    if [ $EXIT_CODE -eq 0 ]; then
        print_success "Test suite completed successfully! 🎉"
    else
        print_error "Test suite completed with failures ❌"
    fi
    echo "============================================="
    
    exit $EXIT_CODE
}

# Run main function
main "$@"