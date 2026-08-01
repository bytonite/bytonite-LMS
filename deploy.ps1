# =============================================================================
#  deploy.ps1 — Автоматический деплой в GitHub с версионированием
#  Использование: дважды кликните deploy.bat
# =============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   bytonite-v1  |  GitHub Deploy Script     " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Проверяем что git инициализирован ────────────────────────────────────
if (-not (Test-Path ".git")) {
    Write-Host "[OSHIBKA] .git ne naiden. Inicializirujte repozitorij:" -ForegroundColor Red
    Write-Host "  git init && git remote add origin <URL>" -ForegroundColor Yellow
    exit 1
}

# ─── 2. Читаем текущую версию из README.md ───────────────────────────────────
$readmePath = Join-Path $ProjectRoot "README.md"
$readmeLines = Get-Content $readmePath -Encoding UTF8

$major = $null
$minor = $null
foreach ($line in $readmeLines) {
    # Match lines like "## 🚀 Текущая версия: 1.18" — we look for "## " + any chars + " NUMBER.NUMBER"
    if ($line -match '^## .+ (\d+)\.(\d+)\s*$') {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        break
    }
}

if ($null -eq $major) {
    Write-Host "[OSHIBKA] Versija ne najdena v README.md" -ForegroundColor Red
    Write-Host "  Stroka dolzhna soderzhat': ## emoji Tekushchaja versija: X.Y" -ForegroundColor Yellow
    exit 1
}

$currentVersion = "$major.$minor"
$newMinor = $minor + 1
$newVersion = "$major.$newMinor"

Write-Host "Tekushchaja versija:   $currentVersion" -ForegroundColor White
Write-Host "Novaja versija:        $newVersion" -ForegroundColor Green
Write-Host ""

# ─── 3. Собираем список изменённых файлов ────────────────────────────────────
$gitStatusOutput = git status --short 2>&1
$changedFiles = @()
foreach ($line in $gitStatusOutput) {
    $trimmed = $line.ToString().Trim()
    if ($trimmed.Length -gt 2) {
        $changedFiles += $trimmed.Substring(2).Trim()
    }
}

if ($changedFiles.Count -eq 0) {
    Write-Host "Net izmenenii dlja kommita. Vsyo uzhe otpravleno!" -ForegroundColor Green
    exit 0
}

Write-Host "Izmenennyje fajly:" -ForegroundColor White
foreach ($f in $changedFiles) {
    Write-Host "   * $f" -ForegroundColor Gray
}
Write-Host ""

# ─── 4. Запрашиваем описание изменений ───────────────────────────────────────
Write-Host "Vvedite opisanie izmenenii (Enter posle kazhdogo punkta)." -ForegroundColor Yellow
Write-Host "Pustaja stroka - zakonchit' spisok:" -ForegroundColor Yellow
Write-Host ""

$changesList = @()
$index = 1
while ($true) {
    $item = Read-Host "   $index) "
    if ([string]::IsNullOrWhiteSpace($item)) { break }
    $changesList += $item
    $index++
}

if ($changesList.Count -eq 0) {
    $changesList = @("Obnovlenije koda i ispravlenija")
}

# ─── 5. Формируем текст коммита ──────────────────────────────────────────────
$commitHeader = "v$newVersion`: " + $changesList[0]
$commitLines = @($commitHeader, "")
foreach ($item in $changesList) {
    $commitLines += "- $item"
}
$commitMessage = $commitLines -join "`n"

Write-Host ""
Write-Host "Kommit: $commitHeader" -ForegroundColor Cyan

# ─── 6. Обновляем README.md — версия в шапке ─────────────────────────────────
$readmeContent = Get-Content $readmePath -Raw -Encoding UTF8

# Update version number in header line (pure number replacement, no Cyrillic in regex)
$readmeContent = [regex]::Replace($readmeContent, "(^## .+ )$([regex]::Escape($currentVersion))(\s*$)", "`${1}$newVersion`$2", [System.Text.RegularExpressions.RegexOptions]::Multiline)

# Build new version block for history section
$newVersionBlock = "### Versija $newVersion`r`n"
foreach ($item in $changesList) {
    $newVersionBlock += "- $item`r`n"
}
$newVersionBlock += "`r`n"

# Insert after the "## History" heading line (find the line with two ## and digit pattern below it)
# We find the marker "### Versija" pattern and insert before the FIRST occurrence (after the History heading)
# Strategy: find "### Версия X.Y" or "### Versija" first line and insert before it
$readmeContent = [regex]::Replace($readmeContent, "(### .+\r?\n- )", "$newVersionBlock`$1", [System.Text.RegularExpressions.RegexOptions]::None, [System.TimeSpan]::FromSeconds(5))

Set-Content -Path $readmePath -Value $readmeContent -Encoding UTF8 -NoNewline
Write-Host "README.md obnovlen: versija $currentVersion -> $newVersion" -ForegroundColor Green

# ─── 7. Обновляем версию в package.json ──────────────────────────────────────
$pkgPath = Join-Path $ProjectRoot "package.json"
if (Test-Path $pkgPath) {
    $pkg = Get-Content $pkgPath -Raw -Encoding UTF8
    $pkg = [regex]::Replace($pkg, '"version":\s*"[^"]*"', """version"": ""$major.$newMinor.0""")
    
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($pkgPath, $pkg, $utf8NoBom)
    
    Write-Host "package.json obnovlen: versija -> $major.$newMinor.0 (UTF-8 no BOM)" -ForegroundColor Green
}

# ─── 8. Добавляем запись в CHANGELOG.md ──────────────────────────────────────
$changelogPath = Join-Path $ProjectRoot "CHANGELOG.md"
if (Test-Path $changelogPath) {
    $changelog = Get-Content $changelogPath -Raw -Encoding UTF8
    
    # Find highest number in entries like "### 19\."
    $numMatches = [regex]::Matches($changelog, '### (\d+)\\')
    $lastNum = 0
    foreach ($nm in $numMatches) {
        $n = [int]$nm.Groups[1].Value
        if ($n -gt $lastNum) { $lastNum = $n }
    }
    $nextNum = $lastNum + 1
    $dateStr = Get-Date -Format "yyyy-MM-dd"
    
    $changelogEntry = "`r`n### $nextNum\. Reliz versii $newVersion ($dateStr)`r`n`r`n"
    $changelogEntry += "**STATUS:** Uspeshno. **Izmenenija:**`r`n`r`n"
    foreach ($item in $changesList) {
        $changelogEntry += "*   $item`r`n"
    }
    
    $changelog += $changelogEntry
    Set-Content -Path $changelogPath -Value $changelog -Encoding UTF8 -NoNewline
    Write-Host "CHANGELOG.md obnovlen" -ForegroundColor Green
}

# ─── 9. Git: stage + commit + push ───────────────────────────────────────────
Write-Host ""
Write-Host "git add -A ..." -ForegroundColor White
git add -A

Write-Host "git commit ..." -ForegroundColor White
git commit -m $commitMessage

Write-Host "git push ..." -ForegroundColor White
$pushResult = git push 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[OSHIBKA pri push]:" -ForegroundColor Red
    Write-Host $pushResult -ForegroundColor Red
    Write-Host ""
    Write-Host "Vozmozhnye prichiny:" -ForegroundColor Yellow
    Write-Host "  1. Net remote: git remote add origin <URL>" -ForegroundColor Yellow
    Write-Host "  2. Net prav dostupa (proverite token/SSH)" -ForegroundColor Yellow
    Write-Host "  3. Vypolnite: git push --set-upstream origin main" -ForegroundColor Yellow
    exit 1
}

# ─── 10. Финальный отчёт ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   DEPLOY VYPOLNEN USPESHNO!                " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Versija:  $currentVersion -> $newVersion" -ForegroundColor White
Write-Host "  Kommit:   $commitHeader" -ForegroundColor White
Write-Host ""
Write-Host "  Izmenenija:" -ForegroundColor White
foreach ($item in $changesList) {
    Write-Host "    * $item" -ForegroundColor Gray
}
Write-Host ""
