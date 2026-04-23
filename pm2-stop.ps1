$ErrorActionPreference = "Stop"

$root = $PSScriptRoot

Set-Location $root
& pm2.cmd stop ecosystem.config.cjs
