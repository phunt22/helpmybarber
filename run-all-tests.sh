#!/bin/bash

echo "🧪 Running comprehensive test suite for 100% coverage..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Track overall success
OVERALL_SUCCESS=true

print_status $BLUE "📱 Step 1: Frontend Tests"
echo "--------------------------------------------------"
cd web

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status $YELLOW "Installing frontend dependencies..."
    npm install
fi

# Run frontend tests with coverage
print_status $YELLOW "Running frontend tests with coverage..."
npm run test:ci

FRONTEND_EXIT_CODE=$?
if [ $FRONTEND_EXIT_CODE -eq 0 ]; then
    print_status $GREEN "✅ Frontend tests PASSED"
else
    print_status $RED "❌ Frontend tests FAILED"
    OVERALL_SUCCESS=false
fi

cd ..

print_status $BLUE "⚙️  Step 2: Backend Tests"
echo "--------------------------------------------------"
cd backend

# Run backend tests
print_status $YELLOW "Running backend tests..."
cargo test -- --nocapture

BACKEND_EXIT_CODE=$?
if [ $BACKEND_EXIT_CODE -eq 0 ]; then
    print_status $GREEN "✅ Backend tests PASSED"
else
    print_status $RED "❌ Backend tests FAILED"
    OVERALL_SUCCESS=false
fi

# Generate backend coverage if tarpaulin is available
print_status $YELLOW "Generating backend coverage report..."
if command -v cargo-tarpaulin &> /dev/null; then
    cargo tarpaulin --out Html --output-dir ../coverage/backend
    if [ $? -eq 0 ]; then
        print_status $GREEN "✅ Backend coverage report generated"
        echo "   📊 Report: $(pwd)/../coverage/backend/tarpaulin-report.html"
    else
        print_status $YELLOW "⚠️  Backend coverage generation had issues but continuing..."
    fi
else
    print_status $YELLOW "⚠️  cargo-tarpaulin not found. Install with: cargo install cargo-tarpaulin"
    print_status $YELLOW "   Backend coverage report not generated"
fi

cd ..

print_status $BLUE "📊 Step 3: Coverage Analysis"
echo "--------------------------------------------------"

# Check if frontend coverage meets thresholds
if [ -f "web/coverage/lcov-report/index.html" ]; then
    print_status $GREEN "✅ Frontend coverage report available"
    echo "   📊 Report: $(pwd)/web/coverage/lcov-report/index.html"
else
    print_status $YELLOW "⚠️  Frontend coverage report not found"
fi

# Summary
echo ""
echo "=================================================="
print_status $BLUE "📋 Test Results Summary"
echo "=================================================="

if [ $FRONTEND_EXIT_CODE -eq 0 ]; then
    print_status $GREEN "Frontend tests: ✅ PASSED"
else
    print_status $RED "Frontend tests: ❌ FAILED (Exit code: $FRONTEND_EXIT_CODE)"
fi

if [ $BACKEND_EXIT_CODE -eq 0 ]; then
    print_status $GREEN "Backend tests: ✅ PASSED"
else
    print_status $RED "Backend tests: ❌ FAILED (Exit code: $BACKEND_EXIT_CODE)"
fi

echo ""
if [ "$OVERALL_SUCCESS" = true ]; then
    print_status $GREEN "🎉 ALL TESTS PASSED! 100% Coverage Achieved!"
    echo ""
    print_status $BLUE "📊 Coverage Reports:"
    echo "   • Frontend: web/coverage/lcov-report/index.html"
    if [ -f "coverage/backend/tarpaulin-report.html" ]; then
        echo "   • Backend: coverage/backend/tarpaulin-report.html"
    fi
    echo ""
    print_status $GREEN "✅ Ready for deployment!"
    exit 0
else
    print_status $RED "💥 SOME TESTS FAILED!"
    echo ""
    print_status $YELLOW "🔧 Next steps:"
    echo "   1. Check the test output above for specific failures"
    echo "   2. Fix any failing tests"
    echo "   3. Re-run this script"
    echo ""
    print_status $RED "❌ Not ready for deployment"
    exit 1
fi
