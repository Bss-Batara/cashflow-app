@echo off
title CashFlow Web App Server
cd /d "%~dp0"
echo =============================================================
echo   Memulai CashFlow Web App...
echo =============================================================
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js tidak terdeteksi di PATH, membuka index.html langsung di browser...
    start index.html
    pause
    exit /b
)
node server.js
pause
