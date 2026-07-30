$ver = 'v=20260526b'
$pattern = '(?<path>/(?:assets/spiralcoin-mark\.svg|spiralcoin_logo\.png|spiralcoin_og_1200x630\.png|apple-touch-icon\.png|brand/splc-[a-z0-9-]+\.png|assets/galaxy-bg\.(?:css|js)))(?:\?v=[0-9a-zA-Z]+)?'
$files = Get-ChildItem -Path . -Filter *.html -File
$changed = @()
foreach ($f in $files) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName
  if ($null -eq $orig) { continue }
  $new = [regex]::Replace($orig, $pattern, { param($m) $m.Groups['path'].Value + '?' + $ver })
  if ($new -ne $orig) {
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    $changed += $f.Name
  }
}
"Updated $($changed.Count) files:"
$changed
