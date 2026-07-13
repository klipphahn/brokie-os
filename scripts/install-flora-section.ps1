param(
  [Parameter(Mandatory = $true)]
  [string]$ThemePath
)

$resolvedTheme = Resolve-Path -LiteralPath $ThemePath -ErrorAction Stop
$sections = Join-Path $resolvedTheme "sections"
if (-not (Test-Path -LiteralPath $sections -PathType Container)) {
  throw "The selected folder is not a Shopify theme: sections/ was not found."
}

$source = Join-Path $PSScriptRoot "..\shopify-theme\sections\brokie-merch-feed.liquid"
$destination = Join-Path $sections "brokie-merch-feed.liquid"
Copy-Item -LiteralPath $source -Destination $destination -Force

Write-Host "Installed Brokie OS merch feed into $destination" -ForegroundColor Green
Write-Host "Preview the theme, add 'Brokie OS merch feed' to the merch template, then push the duplicate theme." -ForegroundColor Cyan
