@echo off
cd /d "%~dp0"
echo Pushing FlowWallet to https://github.com/wiguclub/mnapp.git ...
git branch -M main
git push -u origin main
echo.
echo Done! Now go back to Vercel and click Deploy again.
pause
