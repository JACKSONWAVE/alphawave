#!/bin/bash
# AlphaWave 一键上传到 GitHub 脚本
# 使用方法：
# 1. 先去 https://github.com/new 创建仓库，名字填 alphawave
# 2. 修改下面的 YOUR_USERNAME 为你的GitHub用户名
# 3. 在终端执行: bash upload-to-github.sh

USERNAME="YOUR_USERNAME"  # <-- 改成你的GitHub用户名
REPO="alphawave"

echo "========================================"
echo "  AlphaWave → GitHub 上传脚本"
echo "========================================"

# 检查 git
if ! command -v git &> /dev/null; then
    echo "❌ 请先安装 Git: https://git-scm.com/downloads"
    exit 1
fi

# 检查 node
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js: https://nodejs.org"
    exit 1
fi

echo ""
echo "步骤1/4: 初始化 git 仓库..."
git init

echo ""
echo "步骤2/4: 添加所有文件..."
git add .

echo ""
echo "步骤3/4: 提交代码..."
git commit -m "AlphaWave v4.2 - 智能波段交易系统"

echo ""
echo "步骤4/4: 推送到 GitHub..."
git branch -M main
git remote add origin "https://github.com/$USERNAME/$REPO.git"
git push -u origin main

echo ""
echo "========================================"
echo "  ✅ 上传完成！"
echo "========================================"
echo ""
echo "代码仓库: https://github.com/$USERNAME/$REPO"
echo ""
echo "下一步 - 开启 GitHub Pages:"
echo "1. 打开 https://github.com/$USERNAME/$REPO/settings/pages"
echo "2. Source 选择 'Deploy from a branch'"
echo "3. Branch 选择 'main'，文件夹选 '/ (root)'"
echo "4. 点击 Save"
echo "5. 等待2-3分钟"
echo ""
echo "访问地址: https://$USERNAME.github.io/$REPO"
echo ""
