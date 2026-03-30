@echo off
setlocal
cd /d "C:\Users\X\Desktop\service_outsourcing_site\demo-web"
echo Building Port Smart Management Platform...
npm.cmd run build
if errorlevel 1 (
  echo Build failed. Preview server was not started.
  exit /b 1
)
echo.
echo Starting Port Smart Management Platform preview server...
echo URL: http://127.0.0.1:4173/
echo Route Editor: http://127.0.0.1:4173/route-editor.html
echo.
npm.cmd run preview -- --host 127.0.0.1 --port 4173
endlocal
