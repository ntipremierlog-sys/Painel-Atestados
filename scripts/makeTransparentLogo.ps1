Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $scriptDir ".."
$inputPath = [System.IO.Path]::GetFullPath((Join-Path $appDir "public\premier-logo.jpg"))
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $appDir "public\premier-logo-transparent.png"))

Write-Host "Lendo de: $inputPath"

$stream = New-Object System.IO.FileStream($inputPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read)
$origImg = [System.Drawing.Image]::FromStream($stream)
$bmp = New-Object System.Drawing.Bitmap($origImg)
$stream.Close()
$origImg.Dispose()

# Loop por todos os pixels para remover tons de branco e fundo claro (transparência total)
for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $pixel = $bmp.GetPixel($x, $y)
        # Se for branco ou quase branco (> 230 nos três canais RGB), transforma em transparente
        if ($pixel.R -gt 225 -and $pixel.G -gt 225 -and $pixel.B -gt 225) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}

# Encontrar limites dos pixels visíveis para cortar (crop) bordas vazias
$minX = $bmp.Width
$maxX = 0
$minY = $bmp.Height
$maxY = 0

for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $pixel = $bmp.GetPixel($x, $y)
        if ($pixel.A -gt 0) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$cropWidth = [Math]::Max(1, $maxX - $minX + 1)
$cropHeight = [Math]::Max(1, $maxY - $minY + 1)

$rect = New-Object System.Drawing.Rectangle($minX, $minY, $cropWidth, $cropHeight)
$cropped = $bmp.Clone($rect, $bmp.PixelFormat)

$cropped.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$cropped.Dispose()
$bmp.Dispose()

Write-Host "Sucesso! Criado logo transparente em: $outputPath"
