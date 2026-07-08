# Lance le site en mode production locale contre la base Docker de test.
# Prérequis : containers satoriviz-pg / satoriviz-redis démarrés et `pnpm build` fait.
$env:DATABASE_URL = "postgres://postgres:pass@127.0.0.1:5544/satori"
$env:REDIS_URL = "redis://127.0.0.1:59998"
$env:LIVECOINWATCH_API_KEY = "dummy"
Set-Location "$PSScriptRoot\.."
pnpm exec next start -p 3000
