$NodePath = "C:\Users\TerenceTan\OneDrive - Pepperstone Group Limited\node-v25.2.1-win-x64"
$env:Path = "$NodePath;$env:Path"
Write-Host "Starting CSR Scraper Service..."
npm run dev
