param(
    [Parameter(Mandatory = $true)] [string]$SourceHost,
    [Parameter(Mandatory = $true)] [int]$SourcePort,
    [Parameter(Mandatory = $true)] [string]$SourceDatabase,
    [Parameter(Mandatory = $true)] [string]$SourceUser,
    [string]$OutputRoot = "$env:USERPROFILE\SCCVI-backups"
)

$ErrorActionPreference = 'Stop'
$scriptRoot = $PSScriptRoot
$sqlPreflight = Join-Path $scriptRoot 'sql\00_preflight_source.sql'
$sqlCounts = Join-Path $scriptRoot 'sql\03_exact_table_counts.sql'

foreach ($tool in @('pg_dump', 'pg_restore', 'psql')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "No se encontró '$tool'. Instala PostgreSQL 18 client tools y agrega su carpeta bin al PATH."
    }
}
if (-not (Test-Path -LiteralPath $sqlPreflight -PathType Leaf)) {
    throw "No se encontró el SQL preflight: $sqlPreflight"
}
if (-not (Test-Path -LiteralPath $sqlCounts -PathType Leaf)) {
    throw "No se encontró el SQL de conteo exacto: $sqlCounts"
}

$versionText = (& pg_dump --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar la versión de pg_dump.' }
if ($versionText -notmatch '([0-9]+)\.') { throw "No se pudo interpretar la versión: $versionText" }
$clientMajor = [int]$Matches[1]
if ($clientMajor -lt 18) {
    throw "Se requiere pg_dump 18 o superior para exportar PostgreSQL 18. Versión detectada: $versionText"
}

Write-Host "Cliente detectado: $versionText" -ForegroundColor Cyan
Write-Host "Origen: $SourceHost`:$SourcePort / base $SourceDatabase / usuario $SourceUser" -ForegroundColor Cyan
Write-Host 'Se solicitará la contraseña en modo oculto. No se guardará en los archivos.' -ForegroundColor Yellow
$securePassword = Read-Host 'Contraseña PostgreSQL de origen' -AsSecureString
$ptr = [IntPtr]::Zero
$plainPassword = $null
$runDirectory = $null
$completed = $false

try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $env:PGPASSWORD = $plainPassword
    $env:PGCONNECT_TIMEOUT = '15'

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $runDirectory = Join-Path $OutputRoot "SCCVI-$stamp"
    New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null

    $preflightPath = Join-Path $runDirectory 'source_preflight.txt'
    $dumpPath = Join-Path $runDirectory 'sccvi_source.dump'
    $schemaPath = Join-Path $runDirectory 'sccvi_schema.sql'
    $tocPath = Join-Path $runDirectory 'restore_toc.txt'
    $countsPath = Join-Path $runDirectory 'source_exact_table_counts.csv'

    Write-Host "Ejecutando preflight. Reporte: $preflightPath" -ForegroundColor Cyan
    & psql -X --no-password --host=$SourceHost --port=$SourcePort --username=$SourceUser --dbname=$SourceDatabase --set=ON_ERROR_STOP=1 --file=$sqlPreflight --output=$preflightPath
    if ($LASTEXITCODE -ne 0) { throw 'Falló la consulta preflight del origen.' }

    Write-Host 'Contando filas exactas por tabla (puede tardar según el tamaño de la base)...' -ForegroundColor Cyan
    & psql -X --no-password --host=$SourceHost --port=$SourcePort --username=$SourceUser --dbname=$SourceDatabase --set=ON_ERROR_STOP=1 --file=$sqlCounts --output=$countsPath
    if ($LASTEXITCODE -ne 0) { throw 'Falló el conteo exacto de tablas.' }

    Write-Host 'Generando respaldo completo en formato custom...' -ForegroundColor Cyan
    & pg_dump --no-password --host=$SourceHost --port=$SourcePort --username=$SourceUser --dbname=$SourceDatabase --format=custom --compress=6 --no-owner --no-acl --quote-all-identifiers --verbose --file=$dumpPath
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump terminó con error. El respaldo incompleto será eliminado.' }

    Write-Host 'Generando copia de solo estructura...' -ForegroundColor Cyan
    & pg_dump --no-password --host=$SourceHost --port=$SourcePort --username=$SourceUser --dbname=$SourceDatabase --schema-only --no-owner --no-acl --quote-all-identifiers --file=$schemaPath
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el dump de solo estructura.' }

    Write-Host 'Leyendo el índice interno del respaldo...' -ForegroundColor Cyan
    $toc = & pg_restore --list $dumpPath
    if ($LASTEXITCODE -ne 0 -or -not $toc) { throw 'pg_restore no pudo leer el índice del respaldo.' }
    $toc | Set-Content -LiteralPath $tocPath -Encoding UTF8

    $hash = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash
    $hash | Set-Content -LiteralPath (Join-Path $runDirectory 'sccvi_source.dump.sha256') -Encoding ASCII

    $manifest = [ordered]@{
        creado_en_local = (Get-Date).ToString('o')
        origen_host = $SourceHost
        origen_puerto = $SourcePort
        origen_base = $SourceDatabase
        origen_usuario = $SourceUser
        cliente_pg_dump = $versionText
        archivo_respaldo = 'sccvi_source.dump'
        archivo_conteos = 'source_exact_table_counts.csv'
        tamano_bytes = (Get-Item -LiteralPath $dumpPath).Length
        sha256 = $hash
        incluye_propietarios = $false
        incluye_acl = $false
        nota = 'Respaldo lógico completo de una base; no incluye roles globales del clúster.'
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runDirectory 'manifest.json') -Encoding UTF8

    $completed = $true
    Write-Host ''
    Write-Host 'RESPALDO Y PREFLIGHT COMPLETADOS.' -ForegroundColor Green
    Write-Host "Carpeta: $runDirectory" -ForegroundColor Green
    Write-Host "SHA-256: $hash" -ForegroundColor Green
    Write-Host 'Verifica el respaldo con VALIDAR_BACKUP.ps1.' -ForegroundColor Yellow
    Write-Host 'No subas esta carpeta a GitHub, OneDrive ni al chat: puede contener información personal y clínica.' -ForegroundColor Yellow
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
    $plainPassword = $null
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    if (-not $completed -and $runDirectory -and (Test-Path -LiteralPath $runDirectory)) {
        Remove-Item -LiteralPath $runDirectory -Recurse -Force
        Write-Warning 'Se eliminó la carpeta parcial porque el respaldo no terminó correctamente.'
    }
}
