# scan-crypto-assets.ps1
#
# Read-only forensic-style scan of C:\ and D:\ for crypto-related assets
# belonging to the operator of this machine. Looks for:
#
#   - Ethereum keystore files (UTC--* JSON wallets)
#   - Hardhat / Foundry deployment artifacts (deployed contract addresses)
#   - .env files containing PRIVATE_KEY / MNEMONIC / SEED
#   - MetaMask vault data (browser extension storage)
#   - wallet.dat (Bitcoin Core / Litecoin / Dogecoin)
#   - Grant / funding / sponsor documents (markdown, pdf, docx)
#   - References to mainnet addresses, miners, faucets, pools
#   - WinSCP stored sessions (so you can audit which servers it touches)
#
# Output: one consolidated report at $PSScriptRoot\crypto-asset-scan.txt
# Does NOT print private keys or seed phrases - only file paths + line numbers.
# Skips Windows\, Program Files, ProgramData\Package Cache, node_modules,
# .git, browser cache, and other high-noise paths.
#
# Run:
#   powershell -ExecutionPolicy Bypass -File scan-crypto-assets.ps1

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'

$report = Join-Path $PSScriptRoot 'crypto-asset-scan.txt'
"" | Out-File -FilePath $report -Encoding utf8
function W($s) { Add-Content -Path $report -Value $s; Write-Host $s }

W "=========================================================="
W "  SpiralCoin Crypto Asset Scan"
W "  Host : $env:COMPUTERNAME"
W "  User : $env:USERNAME"
W "  When : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W "=========================================================="
W ""

# ---- drives ----
$drives = @()
foreach ($letter in 'C','D') {
    $root = $letter + ':\'
    if (Test-Path $root) { $drives += $root }
}
W "Drives to scan: $($drives -join ', ')"
W ""

# Paths inside each drive we deliberately skip (high noise, system, caches).
$skipPatterns = @(
    '\Windows\',
    '\Program Files\',
    '\Program Files (x86)\',
    '\ProgramData\Package Cache\',
    '\$Recycle.Bin\',
    '\System Volume Information\',
    '\AppData\Local\Microsoft\',
    '\AppData\Local\Packages\',
    '\AppData\LocalLow\',
    '\AppData\Local\Temp\',
    '\node_modules\',
    '\.git\objects\',
    '\.cache\',
    '\.vscode-server\',
    '\Cache_Data\',
    '\Code Cache\',
    '\BrowserMetrics\',
    '\IndexedDB\',
    '\Service Worker\'
)
function IsSkipped([string]$p) {
    foreach ($s in $skipPatterns) { if ($p -like "*$s*") { return $true } }
    return $false
}

# ---------- 1. Ethereum keystore files (UTC--*) ----------
W "[1] ETHEREUM KEYSTORE FILES (UTC--*.json)"
W "----------------------------------------------------------"
$ksCount = 0
foreach ($d in $drives) {
    Get-ChildItem -Path $d -Recurse -Force -Filter 'UTC--*' -File -ErrorAction SilentlyContinue |
      Where-Object { -not (IsSkipped $_.FullName) } |
      ForEach-Object {
        W ("  " + $_.FullName + "    (" + $_.Length + " bytes, " + $_.LastWriteTime + ")")
        $ksCount++
      }
}
W "  Total keystore files: $ksCount"
W ""

# ---------- 2. wallet.dat (Bitcoin/Litecoin/Doge Core) ----------
W "[2] wallet.dat (Bitcoin Core / Litecoin / Doge)"
W "----------------------------------------------------------"
$walletCount = 0
foreach ($d in $drives) {
    Get-ChildItem -Path $d -Recurse -Force -Filter 'wallet.dat' -File -ErrorAction SilentlyContinue |
      Where-Object { -not (IsSkipped $_.FullName) } |
      ForEach-Object {
        W ("  " + $_.FullName + "    (" + $_.Length + " bytes, " + $_.LastWriteTime + ")")
        $walletCount++
      }
}
W "  Total wallet.dat files: $walletCount"
W ""

# ---------- 3. .env files (anywhere - likely contain secrets) ----------
W "[3] .env FILES (potential private keys / mnemonics / RPC secrets)"
W "----------------------------------------------------------"
$envHits = @()
foreach ($d in $drives) {
    Get-ChildItem -Path $d -Recurse -Force -Filter '.env*' -File -ErrorAction SilentlyContinue |
      Where-Object { -not (IsSkipped $_.FullName) -and $_.Name -notmatch '\.example$' } |
      ForEach-Object { $envHits += $_ }
}
foreach ($f in $envHits) {
    $hasKey = $false; $hasMnemonic = $false; $hasRpc = $false
    try {
        $content = Get-Content -Path $f.FullName -ErrorAction SilentlyContinue -TotalCount 200
        if ($content -match 'PRIVATE_KEY|PRIV_KEY|PK\s*=') { $hasKey = $true }
        if ($content -match 'MNEMONIC|SEED_PHRASE') { $hasMnemonic = $true }
        if ($content -match 'mainnet|alchemy|infura|RPC_URL') { $hasRpc = $true }
    } catch {}
    $tags = @()
    if ($hasKey)      { $tags += 'PRIVATE_KEY' }
    if ($hasMnemonic) { $tags += 'MNEMONIC' }
    if ($hasRpc)      { $tags += 'RPC' }
    $tagstr = if ($tags.Count) { '  [' + ($tags -join ',') + ']' } else { '' }
    W ("  " + $f.FullName + $tagstr)
}
W "  Total .env files: $($envHits.Count)"
W ""

# ---------- 4. MetaMask vault data ----------
W "[4] METAMASK VAULT (browser extension storage)"
W "----------------------------------------------------------"
$mmPaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Local Extension Settings\nkbihfbeogaeaoehlefnkodbefgpgknn",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Local Extension Settings\ejbalbakoplchlghecdalmeeeajnimhm",
    "$env:APPDATA\Mozilla\Firefox\Profiles"
)
foreach ($p in $mmPaths) {
    if (Test-Path $p) {
        W ("  FOUND  " + $p)
        Get-ChildItem -Path $p -Recurse -File -ErrorAction SilentlyContinue |
          Select-Object -First 10 |
          ForEach-Object { W ("         - " + $_.Name + "  (" + $_.Length + "B)") }
    }
}
W ""

# ---------- 5. WinSCP stored sessions ----------
W "[5] WINSCP STORED SESSIONS"
W "----------------------------------------------------------"
$winscpIni = "$env:APPDATA\WinSCP\WinSCP.ini"
if (Test-Path $winscpIni) {
    W "  Config file: $winscpIni"
    $sections = Select-String -Path $winscpIni -Pattern '^\[Sessions\\(.+)\]$'
    foreach ($s in $sections) {
        $name = [System.Web.HttpUtility]::UrlDecode($s.Matches[0].Groups[1].Value)
        W ("    session: " + $name)
    }
} else {
    W "  No WinSCP.ini at $winscpIni"
}
# Also check registry (WinSCP stores there when "use registry" is selected)
$regSessions = 'HKCU:\Software\Martin Prikryl\WinSCP 2\Sessions'
if (Test-Path $regSessions) {
    Get-ChildItem $regSessions -ErrorAction SilentlyContinue | ForEach-Object {
        $hostName = (Get-ItemProperty -Path $_.PSPath -Name HostName -ErrorAction SilentlyContinue).HostName
        $user     = (Get-ItemProperty -Path $_.PSPath -Name UserName -ErrorAction SilentlyContinue).UserName
        W ("    [registry] " + $_.PSChildName + "  -> " + $user + "@" + $hostName)
    }
}
W ""

# ---------- 6. Hardhat / Foundry deployment artifacts ----------
W "[6] HARDHAT / FOUNDRY DEPLOYMENT ARTIFACTS"
W "----------------------------------------------------------"
$artCount = 0
foreach ($d in $drives) {
    Get-ChildItem -Path $d -Recurse -Force -Directory -ErrorAction SilentlyContinue `
        -Include 'deployments','broadcast','artifacts' |
      Where-Object { -not (IsSkipped $_.FullName) -and $_.FullName -notlike '*\node_modules\*' } |
      Select-Object -First 100 |
      ForEach-Object {
        W ("  " + $_.FullName)
        $artCount++
      }
}
W "  Total dirs: $artCount"
W ""

# ---------- 7. Grant / funding / sponsor docs ----------
W "[7] GRANT / FUNDING / SPONSOR / TOKENOMICS DOCUMENTS"
W "----------------------------------------------------------"
$docPatterns = @('*grant*','*funding*','*sponsor*','*tokenomics*','*whitepaper*','*airdrop*')
$docCount = 0
foreach ($d in $drives) {
    foreach ($pat in $docPatterns) {
        Get-ChildItem -Path $d -Recurse -Force -File -Filter $pat -ErrorAction SilentlyContinue |
          Where-Object {
              -not (IsSkipped $_.FullName) -and
              $_.Extension -match '^\.(md|txt|pdf|docx|doc|html|json)$'
          } |
          ForEach-Object {
            W ("  " + $_.FullName)
            $docCount++
          }
    }
}
W "  Total docs: $docCount"
W ""

# ---------- 8. Miners / pools / faucets (filename heuristic) ----------
W "[8] MINER / POOL / FAUCET FILES (filename heuristic)"
W "----------------------------------------------------------"
$minerPatterns = @('*miner*','*xmrig*','*nbminer*','*nicehash*','*phoenixminer*','*t-rex*','*lolminer*','*pool*config*','*faucet*')
$minerCount = 0
foreach ($d in $drives) {
    foreach ($pat in $minerPatterns) {
        Get-ChildItem -Path $d -Recurse -Force -File -Filter $pat -ErrorAction SilentlyContinue |
          Where-Object {
              -not (IsSkipped $_.FullName) -and
              $_.Extension -match '^\.(exe|bat|cmd|ps1|sh|conf|json|yaml|yml|md|txt|cfg|ini)$'
          } |
          Select-Object -First 200 |
          ForEach-Object {
            W ("  " + $_.FullName)
            $minerCount++
          }
    }
}
W "  Total miner/pool/faucet files: $minerCount"
W ""

# ---------- 9. Content scan for mainnet contract addresses / mnemonics ----------
W "[9] CONTENT SCAN - mainnet refs, mnemonics in source files"
W "----------------------------------------------------------"
$contentDirs = @()
foreach ($d in $drives) {
    Get-ChildItem -Path $d -Force -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -in @('Users','Documents','Source','Projects','dev','Workspace','SpiralCoin','ionos-migration') } |
      ForEach-Object { $contentDirs += $_.FullName }
    $usersRoot = Join-Path $d 'Users'
    Get-ChildItem -Path $usersRoot -Force -Directory -ErrorAction SilentlyContinue |
      ForEach-Object {
          $u = $_.FullName
          if (Test-Path (Join-Path $u 'Documents')) { $contentDirs += (Join-Path $u 'Documents') }
          if (Test-Path (Join-Path $u 'Desktop'))   { $contentDirs += (Join-Path $u 'Desktop') }
          if (Test-Path (Join-Path $u 'source'))    { $contentDirs += (Join-Path $u 'source') }
      }
}
$contentDirs = $contentDirs | Sort-Object -Unique
$rx = 'mainnet|0x[a-fA-F0-9]{40}|BEGIN MNEMONIC|seed_phrase|priv(ate)?_?key|alchemy\.com|infura\.io'
$contentHits = 0
foreach ($d in $contentDirs) {
    Get-ChildItem -Path $d -Recurse -Force -File -ErrorAction SilentlyContinue `
        -Include '*.md','*.txt','*.json','*.js','*.ts','*.sol','*.env','*.yaml','*.yml' |
      Where-Object {
          -not (IsSkipped $_.FullName) -and
          $_.Length -lt 2MB
      } |
      ForEach-Object {
        $m = Select-String -Path $_.FullName -Pattern $rx -List -ErrorAction SilentlyContinue
        if ($m) {
            $tag = $m.Matches[0].Value
            if ($tag.Length -gt 30) { $tag = $tag.Substring(0,30) + '...' }
            W ("  " + $_.FullName + "    [" + $tag + "]")
            $contentHits++
        }
      }
}
W "  Total source files with crypto refs: $contentHits"
W ""

W "=========================================================="
W "  Scan complete."
W "  Full report: $report"
W "=========================================================="
