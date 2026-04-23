$ErrorActionPreference = "Stop"

$root = $PSScriptRoot

Set-Location $root
& npm.cmd run build
& pm2.cmd start ecosystem.config.cjs --update-env
& pm2.cmd status
