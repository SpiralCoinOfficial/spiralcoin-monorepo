@echo off
REM SpiralCoin — commit all completed files to the worktree branch
REM Double-click this file (or run in Git Bash) to commit and push.

set REPO=C:\Users\Trisha Dreyer\Documents\ionos-migration.worktrees\copilot-worktree-2026-05-17T18-14-55

cd /d "%REPO%"

echo.
echo [1/3] Staging all files...
git add -A

echo.
echo [2/3] Committing...
git commit --no-gpg-sign -m "feat: complete SpiralCoin SPLC platform — trading, ads, SEO, deploy guide, 404"

echo.
echo [3/3] Pushing to origin...
git push origin copilot/worktree-2026-05-17T18-14-55

echo.
echo Done. Check: https://github.com/SpiralCoinOfficial/SpiralCoin-SPLC-/tree/copilot/worktree-2026-05-17T18-14-55
pause
