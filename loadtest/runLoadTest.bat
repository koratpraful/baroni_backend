@echo off
REM Baroni Backend Load Test Runner for Windows
REM This script makes it easy to run load tests with different configurations

REM Default values
if "%API_BASE_URL%"=="" set API_BASE_URL=http://localhost:4000
if "%CONCURRENT_USERS%"=="" set CONCURRENT_USERS=10
if "%REQUESTS_PER_USER%"=="" set REQUESTS_PER_USER=50
if "%TEST_DURATION%"=="" set TEST_DURATION=60
if "%RAMP_UP_TIME%"=="" set RAMP_UP_TIME=10

echo ==========================================
echo Baroni Backend Load Test
echo ==========================================
echo.
echo Configuration:
echo   Base URL: %API_BASE_URL%
echo   Concurrent Users: %CONCURRENT_USERS%
echo   Requests Per User: %REQUESTS_PER_USER%
echo   Test Duration: %TEST_DURATION%s
echo   Ramp Up Time: %RAMP_UP_TIME%s
echo.

REM Check if Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed or not in PATH
    exit /b 1
)

REM Run the load test
node loadTest.js



