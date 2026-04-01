# Rafraichir le PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Activer Node 18 via nvm-windows (necesaire si 'nvm use' n'a pas ete lance)
$nvmDir = "$env:LOCALAPPDATA\nvm"
if (Test-Path $nvmDir) {
    $node18 = Get-ChildItem $nvmDir -Directory |
        Where-Object { $_.Name -match '^v18\.' } |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($node18) {
        $env:Path = "$($node18.FullName);$env:Path"
        Write-Host "Node actif : $(node --version) ($($node18.Name))" -ForegroundColor Green
    } else {
        Write-Host "AVERTISSEMENT: Node 18 introuvable dans $nvmDir" -ForegroundColor Yellow
    }
}

Write-Host "=== Demarrage du serveur de developpement Superset ===" -ForegroundColor Cyan

# ── Vérification et injection de simulation_stock.db dans Docker ──────────────
$dbLocal = "$PSScriptRoot\simulation_stock.db"
$dbContainer = "/app/simulation_stock.db"
$containerName = "superset_brewery"

$dockerRunning = docker ps --filter "name=$containerName" --filter "status=running" -q 2>$null
if ($dockerRunning) {
    $exists = docker exec $containerName sh -c "test -f $dbContainer && echo yes || echo no" 2>$null
    if ($exists -ne "yes") {
        if (Test-Path $dbLocal) {
            Write-Host "DB manquante dans Docker — injection de simulation_stock.db..." -ForegroundColor Yellow
            docker cp $dbLocal "${containerName}:${dbContainer}"
            Write-Host "  simulation_stock.db injectée dans $containerName" -ForegroundColor Green
        } else {
            Write-Host "AVERTISSEMENT: simulation_stock.db introuvable en local ($dbLocal)" -ForegroundColor Red
        }
    } else {
        Write-Host "simulation_stock.db OK dans $containerName" -ForegroundColor Green
    }
} else {
    Write-Host "AVERTISSEMENT: conteneur $containerName non démarré — DB non vérifiée" -ForegroundColor Yellow
}
# ─────────────────────────────────────────────────────────────────────────────


# Verifier que zstd est disponible
if (-not (Get-Command zstd -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: zstd n'est pas installe. Lance: winget install Meta.Zstandard" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "zstd OK" -ForegroundColor Green

# Verifier que le dossier Superset existe
if (-not (Test-Path "C:\superset\superset-frontend")) {
    Write-Host "ERREUR: C:\superset\superset-frontend introuvable" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "Superset frontend trouve" -ForegroundColor Green

# Tuer tous les processus sur le port 9000
Write-Host "Nettoyage du port 9000..." -ForegroundColor Yellow
$pids = netstat -ano | Select-String ":9000 " | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Sort-Object -Unique
foreach ($pid in $pids) {
    if ($pid -match '^\d+$' -and $pid -ne '0') {
        Write-Host "  Kill PID $pid" -ForegroundColor Yellow
        taskkill /PID $pid /F 2>$null | Out-Null
    }
}
Start-Sleep -Seconds 1
$check = netstat -ano | Select-String ":9000 "
if ($check) {
    Write-Host "  Port 9000 encore occupe, utilisation du port 9001" -ForegroundColor DarkYellow
    $env:DEV_SERVER_PORT = "9001"
    $port = "9001"
} else {
    Write-Host "  Port 9000 libre" -ForegroundColor Green
    $port = "9000"
}

# Aller dans le bon dossier
Set-Location "C:\superset\superset-frontend"
Write-Host "Dossier: $(Get-Location)" -ForegroundColor Yellow

Write-Host ""
Write-Host "Lancement sur le port $port..." -ForegroundColor Cyan
Write-Host "Attends 'webpack compiled successfully' puis ouvre http://localhost:$port" -ForegroundColor Yellow
Write-Host ""

npm run dev-server
