@echo off
echo ========================================
echo   GFV Platform - Local Development Server
echo ========================================
echo.
echo Avvio server HTTP su porta 8000...
echo.
echo Per accedere alle pagine:
echo   http://localhost:8000/core/terreni-standalone.html
echo   http://localhost:8000/core/admin/impostazioni-standalone.html
echo.
echo Premi CTRL+C per fermare il server
echo.
npx http-server -p 8000 -c-1







