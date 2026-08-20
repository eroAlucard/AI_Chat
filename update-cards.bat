@echo off
REM 自动生成卡片元数据脚本
REM 用法: 双击运行，或在添加/删除 cards/ 目录下的 PNG 后手动执行

echo 🔍 正在扫描 cards/ 目录...
python tmp\generate-card-metadata.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ 元数据生成成功！
    echo 💡 提示: 已将 pre-commit hook 安装到 .git/hooks/pre-commit
    echo    以后提交时会自动更新，无需手动运行此脚本
) else (
    echo.
    echo ❌ 元数据生成失败，请检查错误信息
)

pause
