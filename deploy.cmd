@echo off
rem ============================================
rem  One-click deploy: vibe_coding -> CloudBase
rem  Usage: double-click this file
rem ============================================
cd /d %~dp0

echo [1/2] Copying website files to dist\ ...
if exist dist rmdir /s /q dist
mkdir dist
copy index.html dist\ >nul
copy share.html dist\ >nul
copy work.html dist\ >nul
copy login.html dist\ >nul
copy style.css dist\ >nul
copy data.js dist\ >nul
copy img-avatar.jpg dist\ >nul
copy img-bg-mv.png dist\ >nul
copy img-chongya.jpg dist\ >nul
copy img-dog-line.jpg dist\ >nul
copy img-doodle-math.jpg dist\ >nul
copy img-hand.jpg dist\ >nul
copy img-hornet.png dist\ >nul
copy img-seal.png dist\ >nul

echo [2/2] Deploying to CloudBase (env: changda-vibecoding-d8c0v64bdbf7c) ...
"C:\Users\Changda\.workbuddy\binaries\node\versions\22.22.2-5\node.exe" "C:\Users\Changda\.workbuddy\binaries\node\versions\22.22.2-5\node_modules\@cloudbase\cli\bin\tcb" hosting deploy dist -e changda-vibecoding-d8c0v64bdbf7c --verify

echo.
echo ============================================
echo  Done! Visit:
echo  https://changda-vibecoding-d8c0v64bdbf7c-1500185360.tcloudbaseapp.com
echo  (If page not updated: CDN cache, wait a few
echo   minutes or open in incognito window)
echo ============================================
pause
