# Updates hosted Supabase Auth "Site URL" and redirect allow list via Management API (no dashboard clicks).
# Requires a personal access token with Auth config write permission.
#
# 1) Create token: https://supabase.com/dashboard/account/tokens
# 2) $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
# 3) Project ref = subdomain of your project URL (e.g. abcdxyz from https://abcdxyz.supabase.co)
#
# Usage:
#   .\scripts\set-supabase-auth-urls.ps1 -ProjectRef "your-ref" -SiteUrl "https://your-app.vercel.app"

param(
    [Parameter(Mandatory = $true)][string]$ProjectRef,
    [Parameter(Mandatory = $true)][string]$SiteUrl,
    [string]$Token = $env:SUPABASE_ACCESS_TOKEN
)

$ErrorActionPreference = "Stop"
if (-not $Token) {
    Write-Error "Set SUPABASE_ACCESS_TOKEN to a token from https://supabase.com/dashboard/account/tokens"
}

$SiteUrl = $SiteUrl.Trim()
if (-not $SiteUrl.StartsWith("http")) {
    $SiteUrl = "https://$SiteUrl"
}
# Supabase expects Site URL with trailing slash in many templates
if (-not $SiteUrl.EndsWith("/")) {
    $SiteUrl = "$SiteUrl/"
}

# Wildcards: https://supabase.com/docs/guides/auth/redirect-urls
$uriAllowList = @(
    "http://localhost:5173/**"
    "http://127.0.0.1:5173/**"
    "https://*.vercel.app/**"
    "$($SiteUrl.TrimEnd('/'))/**"
) -join "`n"

$bodyObj = [ordered]@{
    site_url       = $SiteUrl
    uri_allow_list = $uriAllowList
}
$body = $bodyObj | ConvertTo-Json -Compress

$headers = @{
    Authorization  = "Bearer $Token"
    "Content-Type" = "application/json"
}

$uri = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"
Invoke-RestMethod -Uri $uri -Method Patch -Headers $headers -Body $body
Write-Host "Updated Auth config for project $ProjectRef (site_url + uri_allow_list)."
