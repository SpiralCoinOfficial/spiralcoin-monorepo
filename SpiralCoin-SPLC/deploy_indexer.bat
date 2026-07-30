@echo off
REM ====================================================================
REM SpiralCoin indexer + API SFTP deploy
REM Uploads /indexer and /api folders to IONOS webspace via WinSCP.
REM
REM Requires: WinSCP installed (https://winscp.net) — winscp.com on PATH.
REM
REM After upload, you MUST:
REM   1. SSH or use IONOS File Manager to rename:
REM        /indexer/config.example.php  ->  /indexer/config.php
REM   2. Edit /indexer/config.php and fill in:
REM        - 'password' for both DB connections
REM        - Replace __ALCHEMY_KEY__ placeholders
REM   3. In the IONOS control panel -> Cron Jobs, add:
REM        SPLC_ENV=testnet php /homepages/XX/dXXXXXXXXX/htdocs/indexer/cron.php
REM      Schedule: every 5 minutes.
REM      (Add a second cron with SPLC_ENV=mainnet when ready.)
REM ====================================================================

setlocal
cd /d "%~dp0"

where winscp.com >nul 2>nul
if errorlevel 1 (
  echo [ERROR] winscp.com not found on PATH.
  echo Install WinSCP from https://winscp.net and add its install dir to PATH.
  exit /b 1
)

echo === Uploading indexer + api to IONOS ===
winscp.com /script=_sftp_indexer_deploy.txt /log=_sftp_indexer_log.txt
set RC=%ERRORLEVEL%

echo.
echo === Upload finished with code %RC%. See _sftp_indexer_log.txt for details. ===
exit /b %RC%
