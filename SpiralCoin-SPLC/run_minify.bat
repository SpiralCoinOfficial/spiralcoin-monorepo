@echo off
cd /d "%~dp0"
echo Minifying SpiralCoin platform HTML...
python minify_splc.py
echo.
echo Done! File saved as: spiralcoin_oneliner.html
pause
