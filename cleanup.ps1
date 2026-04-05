$files = @(
    "app-final.zip", "app-new.zip", "app-with-db.zip", "app.zip",
    "apikey.txt", "binance-testnet-apikey.txt", "binance-config.json",
    "fix.js", "fix2.js", "fix3.js", "fix4.js",
    "migrate-final.js", "migrateToJsonToSqlite.js",
    "test-packages.mjs", "test-sqlite.mjs",
    "cleanup_bots.mjs", "clear_all_bots.mjs", "clear_trigger.js", "check_status.js",
    "server-crash.log", "b.symbol", "console.error(e))"
)
foreach ($f in $files) {
    if (Test-Path $f) {
        Remove-Item -Path $f -Force -Verbose
    }
}
