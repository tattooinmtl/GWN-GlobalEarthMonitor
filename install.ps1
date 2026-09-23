# GWN - Global Earth Monitor 1.1.0
# Windows installer entry point for a website link or a local PowerShell session.
#
# Paste into PowerShell to download this script and run the v1.1.0 release installer:
#   irm https://raw.githubusercontent.com/tattooinmtl/GWN-GlobalEarthMonitor/main/install.ps1 | iex
#
# Build from the GitHub source, then run the setup exe that build produces:
#   $env:GWN_INSTALL_MODE = 'source'; irm https://raw.githubusercontent.com/tattooinmtl/GWN-GlobalEarthMonitor/main/install.ps1 | iex
#
# Run dialog or Command Prompt (release installer):
#   powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/tattooinmtl/GWN-GlobalEarthMonitor/main/install.ps1 | iex"
#
# Local repository:
#   .\install.ps1
#   .\install.ps1 -Source
#   .\install.ps1 -Installer .\release\GWN-Setup-1.1.0.exe
#   .\install.ps1 -Silent
#   .\install.ps1 -InstallDir D:\GWN
#
# Environment overrides (useful for the website one-liner, because irm | iex
# cannot pass switches):
#   GWN_INSTALL_MODE=release|source
#   GWN_INSTALL_VERSION=1.1.0
#   GWN_INSTALLER=C:\path\setup.exe
#   GWN_INSTALL_DIR=C:\path
#   GWN_INSTALL_SILENT=1
#   GWN_INSTALL_ALLOW_OLDER=1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
}

$Repo = 'tattooinmtl/GWN-GlobalEarthMonitor'
$RepoWeb = "https://github.com/$Repo"
$UserAgent = 'GWN-GlobalEarthMonitor-Installer'

$Mode = 'release'
$Version = '1.1.0'
$Installer = $null
$InstallDir = $null
$Silent = $false
$AllowOlder = $false
$WhatIf = $false
$ShowHelp = $false

if ($env:GWN_INSTALL_MODE) { $Mode = $env:GWN_INSTALL_MODE.Trim().ToLowerInvariant() }
if ($env:GWN_INSTALL_VERSION) { $Version = $env:GWN_INSTALL_VERSION.Trim() }
if ($env:GWN_INSTALLER) { $Installer = $env:GWN_INSTALLER.Trim() }
if ($env:GWN_INSTALL_DIR) { $InstallDir = $env:GWN_INSTALL_DIR.Trim() }
if ($env:GWN_INSTALL_SILENT -match '^(1|true|yes)$') { $Silent = $true }
if ($env:GWN_INSTALL_ALLOW_OLDER -match '^(1|true|yes)$') { $AllowOlder = $true }

function Show-Usage {
  Write-Host @"
GWN - Global Earth Monitor $Version

  .\install.ps1
      Download the v$Version GitHub release setup exe and run it.

  .\install.ps1 -Source
      Download the GitHub source (or use this folder when package.json is here),
      build the Windows setup exe, then run it. Requires Node.js 18+ and npm.

  .\install.ps1 -Installer .\release\GWN-Setup-$Version.exe
      Run a setup exe you already have.

  .\install.ps1 -Silent
      NSIS silent install (/S). Optional -InstallDir sets the folder.
      With NSIS, /D= must be the last argument; this script does that.

  .\install.ps1 -AllowOlder
      If v$Version has no release exe yet, use the newest published setup exe.

  .\install.ps1 -WhatIf
      Print the chosen mode without downloading or installing.
"@
}

for ($i = 0; $i -lt $args.Count; $i++) {
  $arg = [string]$args[$i]
  switch -Regex ($arg) {
    '^(--help|-h|-Help|/\?)$' { $ShowHelp = $true; continue }
    '^(-WhatIf|--what-if)$' { $WhatIf = $true; continue }
    '^(-Source|--source)$' { $Mode = 'source'; continue }
    '^(-Release|--release)$' { $Mode = 'release'; continue }
    '^(-Silent|--silent)$' { $Silent = $true; continue }
    '^(-AllowOlder|--allow-older)$' { $AllowOlder = $true; continue }
    '^(-Version|--version)$' {
      if (($i + 1) -ge $args.Count) { throw '-Version needs a value, for example 1.0.0' }
      $Version = [string]$args[++$i]
      continue
    }
    '^(-Installer|--installer)$' {
      if (($i + 1) -ge $args.Count) { throw '-Installer needs a path to a setup exe' }
      $Installer = [string]$args[++$i]
      $Mode = 'release'
      continue
    }
    '^(-InstallDir|--install-dir)$' {
      if (($i + 1) -ge $args.Count) { throw '-InstallDir needs a folder path' }
      $InstallDir = [string]$args[++$i]
      continue
    }
    default { throw "Unknown argument: $arg. Run .\install.ps1 -Help" }
  }
}

if ($Mode -ne 'release' -and $Mode -ne 'source') {
  throw "GWN_INSTALL_MODE must be 'release' or 'source'. Got '$Mode'."
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Version must look like 1.0.0. Got '$Version'."
}

function Write-Step {
  param([string]$Message)
  Write-Host $Message
}

function Get-LocalProjectRoot {
  if (-not $PSScriptRoot) { return $null }
  $pkgPath = Join-Path $PSScriptRoot 'package.json'
  if (-not (Test-Path -LiteralPath $pkgPath)) { return $null }
  try {
    $pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
  if ($pkg.name -eq 'gwn' -or $pkg.name -eq 'gwn-global-earth-monitor') { return $PSScriptRoot }
  return $null
}

function Assert-WindowsExe {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Installer not found: $Path"
  }
  $item = Get-Item -LiteralPath $Path
  if ($item.Length -lt 10MB) {
    throw "Installer looks too small ($($item.Length) bytes): $Path"
  }
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
  try {
    $magic = New-Object byte[] 2
    $read = $stream.Read($magic, 0, 2)
    if ($read -ne 2 -or $magic[0] -ne 0x4D -or $magic[1] -ne 0x5A) {
      throw "Downloaded file is not a Windows executable: $Path"
    }
  } finally {
    $stream.Dispose()
  }
}

function Save-Url {
  param(
    [string]$Url,
    [string]$Destination
  )
  $parent = Split-Path -Parent $Destination
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  $partial = "$Destination.download"
  if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force }
  Write-Step "Downloading $Url"
  Invoke-WebRequest -Uri $Url -OutFile $partial -UseBasicParsing -Headers @{ 'User-Agent' = $UserAgent }
  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
  Move-Item -LiteralPath $partial -Destination $Destination
}

function Test-Sha256 {
  param(
    [string]$Path,
    [string]$Digest
  )
  if (-not $Digest) { return }
  if ($Digest -notmatch '^sha256:([a-fA-F0-9]{64})$') { return }
  $expected = $Matches[1].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "SHA256 mismatch for $Path. Expected $expected, got $actual."
  }
  Write-Step "SHA256 verified."
}

function Get-GithubHeaders {
  return @{
    'User-Agent' = $UserAgent
    'Accept' = 'application/vnd.github+json'
  }
}

function Get-SetupAsset {
  param([string]$Tag)
  $uri = "https://api.github.com/repos/$Repo/releases/tags/$Tag"
  try {
    $release = Invoke-RestMethod -Uri $uri -Headers (Get-GithubHeaders)
  } catch {
    return $null
  }
  $asset = @($release.assets) | Where-Object {
    $_.name -like '*.exe' -and $_.name -notlike '*.blockmap' -and $_.name -match 'Setup'
  } | Select-Object -First 1
  if (-not $asset) { return $null }
  return [pscustomobject]@{
    Name = [string]$asset.name
    Url = [string]$asset.browser_download_url
    Digest = [string]$asset.digest
    Tag = $Tag
  }
}

function Get-ReleaseInstaller {
  $tags = @("v$Version", $Version)
  foreach ($tag in $tags) {
    $asset = Get-SetupAsset -Tag $tag
    if ($asset) { return $asset }
  }

  $names = @(
    "GWN-Setup-$Version.exe",
    "GWN-GlobalEarthMonitor-Setup-$Version.exe",
    "GWN.-.Global.Earth.Monitor.Setup.$Version.exe"
  )
  foreach ($tag in $tags) {
    foreach ($name in $names) {
      $url = "$RepoWeb/releases/download/$tag/$name"
      try {
        $head = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -MaximumRedirection 5 -Headers @{ 'User-Agent' = $UserAgent }
        if ($head.StatusCode -ge 200 -and $head.StatusCode -lt 400) {
          return [pscustomobject]@{
            Name = $name
            Url = $url
            Digest = $null
            Tag = $tag
          }
        }
      } catch {
      }
    }
  }

  if ($AllowOlder) {
    try {
      $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers (Get-GithubHeaders)
    } catch {
      $latest = $null
    }
    if ($latest) {
      $asset = @($latest.assets) | Where-Object {
        $_.name -like '*.exe' -and $_.name -notlike '*.blockmap' -and $_.name -match 'Setup'
      } | Select-Object -First 1
      if ($asset) {
        return [pscustomobject]@{
          Name = [string]$asset.name
          Url = [string]$asset.browser_download_url
          Digest = [string]$asset.digest
          Tag = [string]$latest.tag_name
        }
      }
    }
  }

  return $null
}

function Start-Setup {
  param([string]$Path)
  Assert-WindowsExe -Path $Path
  Write-Step "Starting installer: $Path"
  $argumentList = New-Object System.Collections.Generic.List[string]
  if ($Silent) {
    [void]$argumentList.Add('/S')
  }
  if ($InstallDir) {
    [void]$argumentList.Add("/D=$InstallDir")
  }
  if ($argumentList.Count -gt 0) {
    $proc = Start-Process -FilePath $Path -ArgumentList $argumentList.ToArray() -Wait -PassThru
  } else {
    $proc = Start-Process -FilePath $Path -Wait -PassThru
  }
  if ($null -ne $proc.ExitCode -and $proc.ExitCode -ne 0) {
    throw "Installer exited with code $($proc.ExitCode)."
  }
  Write-Step "GWN - Global Earth Monitor is installed."
}

function Install-FromRelease {
  if ($Installer) {
    $resolved = $Installer
    if (-not [System.IO.Path]::IsPathRooted($resolved)) {
      $resolved = Join-Path (Get-Location) $resolved
    }
    Write-Step "Using local installer: $resolved"
    if ($WhatIf) { return }
    Start-Setup -Path $resolved
    return
  }

  Write-Step "Looking for the v$Version release installer on $RepoWeb"
  if ($WhatIf) {
    Write-Step "Would query release tags v$Version and $Version for a Setup exe."
    if ($AllowOlder) { Write-Step 'Would fall back to the newest published setup exe.' }
    if ($Silent) { Write-Step 'Would run the installer silently (/S).' }
    if ($InstallDir) { Write-Step "Would install into $InstallDir" }
    Write-Step "Would save it under $env:TEMP\GWN-GlobalEarthMonitor and run it."
    return
  }

  $asset = Get-ReleaseInstaller
  if (-not $asset) {
    throw @"
No v$Version Windows setup exe is published on GitHub yet.
Upload GWN-Setup-$Version.exe to a release tagged v$Version.
Until then, either:
  .\install.ps1 -Source
  .\install.ps1 -Installer C:\path\GWN-Setup-$Version.exe
  .\install.ps1 -AllowOlder
"@
  }

  $destDir = Join-Path $env:TEMP 'GWN-GlobalEarthMonitor'
  $dest = Join-Path $destDir $asset.Name
  Write-Step "Release $($asset.Tag): $($asset.Name)"
  Save-Url -Url $asset.Url -Destination $dest
  Test-Sha256 -Path $dest -Digest $asset.Digest
  Start-Setup -Path $dest
}

function Assert-NodeToolchain {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $nodeCmd -or -not $npmCmd) {
    throw "Building from source needs Node.js 18 or newer and npm. Install Node from https://nodejs.org, or use the release installer: .\install.ps1"
  }
  $raw = (& node -p "process.versions.node").Trim()
  $major = 0
  [void][int]::TryParse(($raw.Split('.')[0]), [ref]$major)
  if ($major -lt 18) {
    throw "Node.js $raw is too old. Install Node.js 18 or newer, or use .\install.ps1 for the release installer."
  }
  Write-Step "Using Node.js $raw"
}

function Get-SourceRoot {
  $local = Get-LocalProjectRoot
  if ($local) {
    Write-Step "Using the source already in $local"
    return $local
  }

  $destRoot = Join-Path $env:LOCALAPPDATA 'GWN-GlobalEarthMonitor\source'
  $zipPath = Join-Path $env:TEMP "GWN-GlobalEarthMonitor-$Version-source.zip"
  $urls = @(
    "$RepoWeb/archive/refs/tags/v$Version.zip",
    "$RepoWeb/archive/refs/tags/$Version.zip",
    "$RepoWeb/archive/refs/heads/main.zip"
  )
  if ($WhatIf) {
    Write-Step "Would download source from:"
    foreach ($url in $urls) { Write-Step "  $url" }
    Write-Step "Would extract to $destRoot, run npm ci, then npm run dist:win."
    return $null
  }

  $downloaded = $false
  foreach ($url in $urls) {
    try {
      Save-Url -Url $url -Destination $zipPath
      $downloaded = $true
      break
    } catch {
      Write-Step "Source archive not at $url"
    }
  }
  if (-not $downloaded) {
    throw "Could not download the GWN source from GitHub."
  }

  if (Test-Path -LiteralPath $destRoot) {
    Remove-Item -LiteralPath $destRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $destRoot -Force
  $nested = Get-ChildItem -LiteralPath $destRoot -Directory | Select-Object -First 1
  if (-not $nested -or -not (Test-Path -LiteralPath (Join-Path $nested.FullName 'package.json'))) {
    throw "The GitHub archive did not contain the GWN project."
  }
  return $nested.FullName
}

function Install-FromSource {
  Assert-NodeToolchain
  $root = Get-SourceRoot
  if ($WhatIf) {
    if ($root) { Write-Step "Would run npm ci and npm run dist:win in $root, then launch the setup exe." }
    return
  }
  Write-Step "Building the Windows installer in $root"
  Push-Location $root
  try {
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    if (Test-Path -LiteralPath (Join-Path $root 'package-lock.json')) {
      & npm ci
    } else {
      & npm install
    }
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed with exit code $LASTEXITCODE."
    }
    & npm run dist:win
    if ($LASTEXITCODE -ne 0) {
      throw "The Windows installer build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  $built = Get-ChildItem -LiteralPath (Join-Path $root 'release') -Filter 'GWN-Setup-*.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $built) {
    $built = Get-ChildItem -LiteralPath (Join-Path $root 'release') -Filter '*Setup*.exe' -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
  }
  if (-not $built) {
    throw "The build finished without writing a setup exe in $(Join-Path $root 'release')."
  }
  Start-Setup -Path $built.FullName
}

if ($ShowHelp) {
  Show-Usage
  return
}

Write-Step "GWN - Global Earth Monitor $Version ($Mode)"
if ($Mode -eq 'source') {
  Install-FromSource
} else {
  Install-FromRelease
}
