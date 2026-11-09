@echo off
cd /d "%~dp0"
echo ========================================================
echo Pushing FlowWallet to https://wiguclub@github.com/wiguclub/mnapp.git
echo (If a GitHub Sign-In window pops up, please sign in with account: wiguclub)
echo ========================================================
git branch -M main
git push -u origin main
echo.
echo Done! Now go back to Vercel and click Deploy again.
pause
