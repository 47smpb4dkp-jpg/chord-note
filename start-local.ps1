# コード譜ノート をこのパソコンで開くための簡易サーバー
# 使い方: このファイルを右クリック →「PowerShell で実行」
#          または PowerShell で  .\start-local.ps1

$port = 8777
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch {
    Write-Host "ポート $port が使用中です。他の窓を閉じてから試してください。" -ForegroundColor Red
    Read-Host "Enter で終了"; exit
}

Write-Host ""
Write-Host "  コード譜ノート を起動しました" -ForegroundColor Green
Write-Host "  http://localhost:$port/" -ForegroundColor Yellow
Write-Host ""
Write-Host "  終了するには、この窓で Ctrl+C を押してください"
Write-Host ""

Start-Process "http://localhost:$port/"

$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8';
            '.json'='application/manifest+json; charset=utf-8'; '.png'='image/png';
            '.css'='text/css; charset=utf-8'; '.md'='text/markdown; charset=utf-8' }

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
        if ($path -eq '/') { $path = '/index.html' }
        $file = Join-Path $root ($path.TrimStart('/') -replace '/', '\')

        if (Test-Path $file -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
        }
        $ctx.Response.Close()
    } catch { }
}
