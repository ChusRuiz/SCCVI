param(
    [Parameter(Mandatory = $true)]
    [string]$BackupDirectory
)

$ErrorActionPreference = 'Stop'
$dumpPath = Join-Path $BackupDirectory 'sccvi_source.dump'
$hashPath = "$dumpPath.sha256"
$manifestPath = Join-Path $BackupDirectory 'manifest.json'

if (-not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) { throw "No se encontró $dumpPath" }
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "No se encontró $manifestPath" }
if (-not (Get-Command 'pg_restore' -ErrorAction SilentlyContinue)) { throw 'No se encontró pg_restore en PATH.' }

$file = Get-Item -LiteralPath $dumpPath
if ($file.Length -lt 1024) { throw 'El archivo parece demasiado pequeño para ser un respaldo completo.' }

Write-Host 'Comprobando que pg_restore pueda leer el índice del archivo...' -ForegroundColor Cyan
$toc = & pg_restore --list $dumpPath
if ($LASTEXITCODE -ne 0 -or -not $toc) { throw 'pg_restore no pudo leer el archivo. No utilices este respaldo.' }

$currentHash = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash
if (Test-Path -LiteralPath $hashPath) {
    $expectedHash = (Get-Content -LiteralPath $hashPath -Raw).Trim()
    if ($currentHash -ne $expectedHash) { throw 'El SHA-256 no coincide. El archivo pudo modificarse o dañarse.' }
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.sha256 -and $manifest.sha256 -ne $currentHash) {
    throw 'El hash del respaldo no coincide con el manifiesto.'
}

Write-Host ''
Write-Host 'VALIDACIÓN BÁSICA DEL RESPALDO: CORRECTA.' -ForegroundColor Green
Write-Host "Tamaño: $($file.Length) bytes"
Write-Host "SHA-256: $currentHash"
Write-Host "Origen: $($manifest.origen_base) en $($manifest.origen_host):$($manifest.origen_puerto)"
Write-Host 'Nota: leer el índice y verificar el hash no sustituye una restauración de ensayo en una base aislada.' -ForegroundColor Yellow
