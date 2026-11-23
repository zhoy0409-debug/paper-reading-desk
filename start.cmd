@echo off
setlocal
cd /d "%~dp0"
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
  echo Python 3.8 or newer is required.
  pause
  exit /b 1
)
python preview.py
:done
if errorlevel 1 pause
