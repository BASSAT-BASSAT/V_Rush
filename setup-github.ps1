# Creates https://github.com/BASSAT-BASSAT/kernellab and pushes this project.
# Prerequisite (one time): open PowerShell and run:
#   & "C:\Program Files\GitHub CLI\gh.exe" auth login
# Then run this script from the repo root (right-click → Run with PowerShell, or: .\setup-github.ps1)

$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) {
    Write-Host "Install GitHub CLI: winget install GitHub.cli"
    exit 1
}

Set-Location $PSScriptRoot

& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run first:"
    Write-Host '  & "C:\Program Files\GitHub CLI\gh.exe" auth login'
    exit 1
}

$owner = "BASSAT-BASSAT"
$name = "kernellab"

git branch -M main 2>$null

if (git remote get-url origin 2>$null) {
    Write-Host "Remote 'origin' already exists. Pushing..."
    git push -u origin main
    exit $LASTEXITCODE
}

& $gh repo create "$owner/$name" --public --source=. --remote=origin --description "KernelLab - classical computer vision playground" --push
