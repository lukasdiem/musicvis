@echo off
call npm.cmd run build
if errorlevel 1 exit /b 1
call npm.cmd run preview -- --host 127.0.0.1 --port 8000