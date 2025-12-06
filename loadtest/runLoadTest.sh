#!/bin/bash

# Baroni Backend Load Test Runner
# This script makes it easy to run load tests with different configurations

# Default values
BASE_URL="${API_BASE_URL:-http://localhost:4000}"
CONCURRENT_USERS="${CONCURRENT_USERS:-10}"
REQUESTS_PER_USER="${REQUESTS_PER_USER:-50}"
TEST_DURATION="${TEST_DURATION:-60}"
RAMP_UP_TIME="${RAMP_UP_TIME:-10}"

echo "=========================================="
echo "Baroni Backend Load Test"
echo "=========================================="
echo ""
echo "Configuration:"
echo "  Base URL: $BASE_URL"
echo "  Concurrent Users: $CONCURRENT_USERS"
echo "  Requests Per User: $REQUESTS_PER_USER"
echo "  Test Duration: ${TEST_DURATION}s"
echo "  Ramp Up Time: ${RAMP_UP_TIME}s"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Run the load test
export API_BASE_URL="$BASE_URL"
export CONCURRENT_USERS="$CONCURRENT_USERS"
export REQUESTS_PER_USER="$REQUESTS_PER_USER"
export TEST_DURATION="$TEST_DURATION"
export RAMP_UP_TIME="$RAMP_UP_TIME"

node loadTest.js






