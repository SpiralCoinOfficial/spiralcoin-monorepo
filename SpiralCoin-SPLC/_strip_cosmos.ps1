$files = Get-ChildItem -Path . -Filter *.html -File
$changed = @()

# Block A — procedural canvas (HTML comment + style#splc-cosmos-style + IIFE script)
$rxA = '(?s)<!--\s*SPLC_COSMOS_INLINE_v3\s*-->\s*<style[^>]*id="splc-cosmos-style"[^>]*>.*?</style>\s*<script>.*?</script>\s*'

# Block B — single-image Ken-Burns (style#splc-cosmos-photoreal + IIFE w/ __SPLC_COSMOS_PHOTOREAL__)
$rxB = '(?s)<style[^>]*id="splc-cosmos-photoreal"[^>]*>.*?</style>\s*<script>\s*\(function\(\)\{\s*if\s*\(window\.__SPLC_COSMOS_PHOTOREAL__.*?</script>\s*'

foreach ($f in $files) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName
  if ($null -eq $orig) { continue }
  $new = [regex]::Replace($orig, $rxA, '')
  $new = [regex]::Replace($new,  $rxB, '')
  if ($new -ne $orig) {
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    $changed += $f.Name
  }
}
"Cleaned $($changed.Count) files:"
$changed
