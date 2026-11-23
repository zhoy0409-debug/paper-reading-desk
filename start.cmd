@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0runtime\python.exe" (
  "%~dp0runtime\python.exe" "%~dp0portable_launcher.py" %*
  goto done
)
set "tree_python=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%tree_python%" (
  "%tree_python%" preview.py
  goto done
)
py -3 -c "import sys;sys.exit(sys.version_info < (3,8))" >nul 2>&1
if not errorlevel 1 (
  py -3 preview.py
  goto done
)
python -c "import sys;sys.exit(sys.version_info < (3,8))" >nul 2>&1
if errorlevel 1 (
  echo Open the web reader or download the portable Windows edition:
  echo https://zhoy0409-debug.github.io/paper-reading-desk/read/
  echo https://github.com/zhoy0409-debug/paper-reading-desk/releases/latest
  pause
  exit /b 1
)
python preview.py
:done
if errorlevel 1 pause
