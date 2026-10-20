# Arrête les serveurs et navigateurs de vérification restés ouverts (Windows).
# Cible : le port 3101 (build de test e2e), les `next build`, `playwright` et les Chromium de Playwright.
# Ne touche jamais au serveur de développement de John (port 3000) ni à son arbre de processus.
$projet = (Resolve-Path "$PSScriptRoot\..").Path
$proteges = @{}

$dev = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $dev) {
  $id = $c.OwningProcess
  while ($id -and -not $proteges.ContainsKey($id)) {
    $proteges[$id] = $true
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
    $id = if ($p) { $p.ParentProcessId } else { 0 }
  }
}

$cibles = @{}
foreach ($c in (Get-NetTCPConnection -LocalPort 3101 -ErrorAction SilentlyContinue)) {
  if ($c.OwningProcess -gt 4) { $cibles[[int]$c.OwningProcess] = "port 3101" }
}
foreach ($p in (Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='chrome.exe' OR Name='chrome-headless-shell.exe'")) {
  $cmd = [string]$p.CommandLine
  $ici = $cmd.Contains($projet) -or $cmd -match 'ms-playwright'
  if (-not $ici) { continue }
  if ($cmd -match 'playwright|next[\/]dist[\/]bin[\/]next.* (build|start)|next-server|ms-playwright|\.next-e2e-prod|\.next-build') {
    $cibles[[int]$p.ProcessId] = $p.Name
  }
}

$arretes = 0
foreach ($id in $cibles.Keys) {
  if ($proteges.ContainsKey($id) -or $id -eq $PID) { continue }
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  $arretes++
}
Write-Host "Processus de vérification arrêtés : $arretes (serveur de développement du port 3000 épargné)."
