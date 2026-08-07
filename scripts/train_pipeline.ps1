$ErrorActionPreference = "Stop"
$root = "C:\Users\domwipfler\HKA\wels-monorepo"
$log  = "$root\scripts\train_pipeline.log"
$db   = "$root\data\output\duckdb\matches.duckdb"

function Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    "$ts  $msg" | Tee-Object -FilePath $log -Append
}

# Check whether a match_id exists in DuckDB; returns "yes" or "no".
function Test-Match($matchId) {
    $tmp = "$env:TEMP\wels_check_match.py"
    @"
import duckdb, sys
conn = duckdb.connect(sys.argv[1])
r = conn.execute('SELECT 1 FROM matches WHERE match_id = ?', [sys.argv[2]]).fetchone()
print('yes' if r else 'no')
"@ | Set-Content -Path $tmp -Encoding UTF8
    $result = (& uv run python $tmp $db $matchId 2>$null).Trim()
    return $result
}

# Delete all ingestion rows for a match so ingestion can be retried cleanly.
function Remove-Match($matchId) {
    $tmp = "$env:TEMP\wels_remove_match.py"
    @"
import duckdb, sys
conn = duckdb.connect(sys.argv[1])
mid = sys.argv[2]
rows = conn.execute('SELECT 1 FROM matches WHERE match_id = ?', [mid]).fetchone()
if not rows:
    print(f'  {mid}: not in DB, nothing to clean')
    import sys; sys.exit(0)
for t in ('ball', 'players', 'frames', 'matches'):
    n = conn.execute(f'SELECT COUNT(*) FROM {t} WHERE match_id = ?', [mid]).fetchone()[0]
    conn.execute(f'DELETE FROM {t} WHERE match_id = ?', [mid])
    print(f'  deleted {n} rows from {t}')
conn.commit()
conn.close()
print(f'  {mid} cleaned from DB')
"@ | Set-Content -Path $tmp -Encoding UTF8
    uv run python $tmp $db $matchId 2>&1 | Tee-Object -FilePath $log -Append
}

Log "=== START ==="

Set-Location "$root\packages\ingestion"

# -- 1. Ingest Stuttgart-Lemgo ------------------------------------------------
if ((Test-Match "stuttgart_lemgo_2026") -eq "yes") {
    Log "Stuttgart-Lemgo already ingested - skipping."
} else {
    Log "Ingesting stuttgart_lemgo_2026 (stride=50, imgsz=320) ..."
    uv run --extra cv wels-ingest `
        "C:\Users\domwipfler\Downloads\2026-03-29_1284719_Stuttgart_Lemgo.mp4" `
        stuttgart_lemgo_2026 `
        --stride 50 --imgsz 320 --device cpu 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -ne 0) { Log "ERROR: Lemgo ingestion failed (exit $LASTEXITCODE)"; exit 1 }
    Log "Lemgo ingestion done."
}

# -- 2. Ingest Stuttgart-Melsungen --------------------------------------------
# Delete any partial ingestion first (idempotent).
Log "Cleaning up any partial stuttgart_melsungen_2025 data ..."
Remove-Match "stuttgart_melsungen_2025"

Log "Ingesting stuttgart_melsungen_2025 (stride=50, imgsz=320) ..."
uv run --extra cv wels-ingest `
    "C:\Users\domwipfler\Downloads\sl_1284648_2025-10-05_1284648_tvb_stuttgart-mt_melsungen_1080p30_6499kbps.mp4" `
    stuttgart_melsungen_2025 `
    --stride 50 --imgsz 320 --device cpu 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: Melsungen ingestion failed (exit $LASTEXITCODE)"; exit 1 }
Log "Melsungen ingestion done."

# -- 3. Train formation encoder with all 3 matches ---------------------------
Log "Training formation encoder (all 3 matches, 300 epochs) ..."
Set-Location "$root\packages\ml"
uv run wels-formation-train `
    --match-ids stuttgart_loewen_2026 stuttgart_lemgo_2026 stuttgart_melsungen_2025 `
    --epochs 300 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) { Log "ERROR: Formation training failed (exit $LASTEXITCODE)"; exit 1 }
Log "Training done."

# -- 4. Re-score all matches with new encoder ---------------------------------
foreach ($mid in @("testvideo2min", "5f9a0639", "stuttgart_loewen_2026", "stuttgart_lemgo_2026", "stuttgart_melsungen_2025")) {
    Log "Scoring $mid ..."
    uv run wels-score $mid 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -ne 0) { Log "WARNING: scoring failed for $mid - continuing" }
}

Log "=== FERTIG ==="
