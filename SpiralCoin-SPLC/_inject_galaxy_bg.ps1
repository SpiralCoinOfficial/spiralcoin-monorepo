$ver = 'v=20260526b'
$inject = "  <link rel=`"stylesheet`" href=`"/assets/galaxy-bg.css?$ver`">`r`n  <script defer src=`"/assets/galaxy-bg.js?$ver`"></script>`r`n</head>"
$files = Get-ChildItem -Path . -Filter *.html -File
$changed = @()
foreach ($f in $files) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName
  if ($null -eq $orig) { continue }
  if ($orig -match 'galaxy-bg\.css') { continue }   # already injected
  if ($orig -notmatch '</head>')     { continue }   # no head tag
  $new = [regex]::Replace($orig, '</head>', $inject, 'IgnoreCase', 1)
  if ($new -ne $orig) {
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    $changed += $f.Name
  }
}
"Injected cosmos background into $($changed.Count) files:"
$changed
