# deploy.ps1 - one-command redeploy after a fresh `terraform apply`.
#
# Usage (run from inside the terraform/ folder):
#   .\deploy.ps1                    # uploads .env + builds + runs
#   .\deploy.ps1 -SkipBuild         # uploads .env only, you build manually
#   .\deploy.ps1 -SkipSetup         # skip swap + buildx install (already done)

param(
    [switch]$SkipBuild,
    [switch]$SkipSetup
)

$ErrorActionPreference = "Stop"

Write-Host "==> Reading values from terraform output..." -ForegroundColor Cyan
$ec2 = (..\terraform.exe output -raw ec2_public_ip).Trim()
$db_endpoint = (..\terraform.exe output -raw db_endpoint).Trim()
$db_password = (..\terraform.exe output -raw db_password).Trim()
Write-Host "    EC2:        $ec2"
Write-Host "    DB:         $db_endpoint"

Write-Host "==> Loading local secrets (secrets.local.env)..." -ForegroundColor Cyan
if (-not (Test-Path "secrets.local.env")) {
    Write-Host "ERROR: secrets.local.env not found. Create it with:"
    Write-Host "    JWT_SECRET=<long-hex-string>"
    Write-Host "    GROQ_API_KEY=<your-groq-key>"
    exit 1
}
$secrets = @{}
Get-Content "secrets.local.env" | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.+)$') {
        $secrets[$matches[1]] = $matches[2]
    }
}

Write-Host "==> Building .env content..." -ForegroundColor Cyan
$envContent = @"
DATABASE_URL=postgresql://postgres:$db_password@${db_endpoint}:5432/crashlens
JWT_SECRET=$($secrets['JWT_SECRET'])
CORS_ORIGINS=http://${ec2}:3000
GROQ_API_KEY=$($secrets['GROQ_API_KEY'])
NEXT_PUBLIC_API_URL=http://${ec2}:8000
"@
# Convert to LF line endings (so Linux likes the heredoc), no trailing CR.
$envContent = $envContent -replace "`r", ""
[System.IO.File]::WriteAllText("$PWD\deploy.env", $envContent)

# First-time setup on a fresh EC2 (swap + buildx + clone)
if (-not $SkipSetup) {
    Write-Host "==> Running first-time setup on EC2 (swap, buildx, clone)..." -ForegroundColor Cyan
    $setupScript = @'
set -e

# 1. swap (skip if already present)
if [ ! -f /swapfile ]; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
fi

# 2. buildx (skip if already present)
if [ ! -f /usr/local/lib/docker/cli-plugins/docker-buildx ]; then
  LATEST=$(curl -sI https://github.com/docker/buildx/releases/latest | awk -F'/' '/^[Ll]ocation:/ {print $NF}' | tr -d '\r\n')
  sudo curl -fsSL "https://github.com/docker/buildx/releases/download/${LATEST}/buildx-${LATEST}.linux-amd64" \
    -o /usr/local/lib/docker/cli-plugins/docker-buildx
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
fi

# 3. clone (skip if already cloned)
if [ ! -d ~/CrashLens ]; then
  git clone https://github.com/rifle2115/CrashLens.git
fi
cd ~/CrashLens && git pull
'@
    ssh -i ./crashlens-key.pem -o StrictHostKeyChecking=accept-new ec2-user@$ec2 $setupScript
}

Write-Host "==> Uploading .env to EC2..." -ForegroundColor Cyan
scp -i ./crashlens-key.pem ./deploy.env "ec2-user@${ec2}:/home/ec2-user/CrashLens/.env"
Remove-Item ./deploy.env

if (-not $SkipBuild) {
    Write-Host "==> Building + starting containers on EC2 (this can take ~6 min)..." -ForegroundColor Cyan
    ssh -i ./crashlens-key.pem ec2-user@$ec2 "cd ~/CrashLens && docker compose -f compose.prod.yml up -d --build"
    Write-Host ""
    Write-Host "==> Done. Visit http://${ec2}:3000" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "==> .env uploaded. SSH in and run \`docker compose -f compose.prod.yml up -d --build\` when ready." -ForegroundColor Green
}
