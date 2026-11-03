@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo CONTROL OC D1 - SERVIDOR LOCAL
 echo.
echo Abre automaticamente: http://localhost:5500
 echo.
echo Para detener la aplicacion presiona CTRL + C
 echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5500/"
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 5500 --bind 127.0.0.1
) else (
  python -m http.server 5500 --bind 127.0.0.1
)
endlocal