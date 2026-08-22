@echo off
chcp 65001 >nul
title AI Chat 启动器

echo.
echo ========================================
echo        AI Chat PWA 本地服务器
echo ========================================
echo.

REM 检查是否已有服务器在运行
netstat -ano | findstr ":1234" >nul
if %errorlevel% equ 0 (
    echo [提示] 服务器已在运行中
    echo.
    echo 正在打开浏览器...
    start http://localhost:1234
    echo.
    echo 浏览器已打开！
    timeout /t 3 >nul
    exit
)

echo [启动] 正在启动服务器...
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

REM 后台启动服务器（最小化窗口）
start "AI Chat Server" /min cmd /c "python -m http.server 1234"

REM 等待服务器启动
timeout /t 2 /nobreak >nul

REM 打开浏览器
start http://localhost:1234

echo [成功] 服务器已启动
echo.
echo 访问地址:
echo   - 本地访问: http://localhost:1234
echo   - 局域网访问: http://你的电脑IP:1234
echo.
echo 浏览器已自动打开，等待 30 秒后会提示安装 PWA
echo.
echo ----------------------------------------
echo 提示：关闭此窗口不会停止服务器
echo 如需停止服务器，请打开任务管理器结束 Python 进程
echo ========================================
echo.
timeout /t 5 >nul
