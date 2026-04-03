$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$frontendDir = Resolve-Path (Join-Path $repoRoot 'frontend')
$publishRoot = Join-Path $scriptDir 'iis-publish'
$nodeDir = 'C:\Program Files\nodejs'
$nodeExe = Join-Path $nodeDir 'node.exe'
$npmCmd = Join-Path $nodeDir 'npm.cmd'
$webConfigSource = Join-Path $scriptDir 'web.config'

if (-not (Test-Path $nodeExe) -or -not (Test-Path $npmCmd)) {
    throw "Node.js 20 is required. Expected files not found under '$nodeDir'."
}

if (-not (Test-Path $webConfigSource)) {
    throw "IIS web.config template not found: $webConfigSource"
}

$env:Path = "$nodeDir;$env:Path"

function Get-EnvMap {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $result = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $trimmed = $line.Trim()
        if ($trimmed.StartsWith('#')) {
            continue
        }

        $parts = $trimmed -split '=', 2
        if ($parts.Count -ne 2) {
            continue
        }

        $result[$parts[0].Trim()] = $parts[1].Trim()
    }

    return $result
}

function Invoke-FrontendBuild {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Mode,
        [Parameter(Mandatory = $true)]
        [string]$EnvFile,
        [Parameter(Mandatory = $true)]
        [string]$PublishName
    )

    $envMap = Get-EnvMap -Path $EnvFile
    foreach ($entry in $envMap.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }

    $publishDir = Join-Path $publishRoot $PublishName
    if (Test-Path $publishDir) {
        Remove-Item -LiteralPath $publishDir -Recurse -Force
    }

    Push-Location $frontendDir
    try {
        & $npmCmd "run" "build:$Mode"
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build:$Mode failed."
        }

        Copy-Item -Recurse -Force (Join-Path $frontendDir 'dist') $publishDir
        Copy-Item -LiteralPath $webConfigSource -Destination (Join-Path $publishDir 'web.config') -Force

        $envMap.GetEnumerator() |
            Sort-Object Name |
            ForEach-Object { "{0}={1}" -f $_.Name, $_.Value } |
            Set-Content -LiteralPath (Join-Path $publishDir 'build.env') -Encoding utf8
    }
    finally {
        Pop-Location
    }
}

if (Test-Path $publishRoot) {
    Remove-Item -LiteralPath $publishRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $publishRoot | Out-Null

Push-Location $frontendDir
try {
    & $npmCmd "ci"
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed."
    }
}
finally {
    Pop-Location
}

Invoke-FrontendBuild -Mode 'bank' -EnvFile (Join-Path $scriptDir '.env.bank') -PublishName 'bank'
Invoke-FrontendBuild -Mode 'admin' -EnvFile (Join-Path $scriptDir '.env.admin') -PublishName 'sys_core'

Compress-Archive -Path (Join-Path $publishRoot 'bank\*') -DestinationPath (Join-Path $publishRoot 'bank.zip') -Force
Compress-Archive -Path (Join-Path $publishRoot 'sys_core\*') -DestinationPath (Join-Path $publishRoot 'sys_core.zip') -Force

Write-Host "Created IIS publish outputs:"
Write-Host " - $publishRoot\\bank"
Write-Host " - $publishRoot\\sys_core"
Write-Host " - $publishRoot\\bank.zip"
Write-Host " - $publishRoot\\sys_core.zip"
