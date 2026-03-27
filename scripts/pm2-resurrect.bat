@echo off
timeout /t 30 /nobreak >nul
"C:\Users\benelk\AppData\Roaming\npm\pm2.cmd" resurrect >> "%USERPROFILE%\.pm2\resurrect.log" 2>&1
