@echo off
chcp 65001 >nul
REM 自动生成卡片元数据脚本
REM 用法: 双击运行，或在添加/删除 cards/ 目录下的 PNG 后手动执行

echo.
echo ================================================
echo   AI Chat 角色卡元数据更新工具
echo ================================================
echo.
echo 🔍 正在扫描 cards/ 目录...
echo.

python tmp\generate-card-metadata.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo   ✅ 元数据生成成功！
    echo ================================================
    echo.
    echo 📋 已生成以下文件：
    echo    - cards/cards-metadata.json
    echo    - js/cards-metadata.js
    echo.
    echo 💡 提示：
    echo    - 刷新浏览器即可看到新卡片
    echo    - 如需自动更新，可配置 git pre-commit hook
    echo.
) else (
    echo.
    echo ================================================
    echo   ❌ 元数据生成失败
    echo ================================================
    echo.
    echo 请检查：
    echo   1. Python 是否已安装
    echo   2. cards/ 目录是否存在
    echo   3. PNG 文件是否为有效的角色卡
    echo.
)

pause
