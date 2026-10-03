$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$reviewDir = $PSScriptRoot
$reference = [System.Drawing.Bitmap]::FromFile((Join-Path $reviewDir '../nox-introduction/reference-panel-2.png'))
$approved = [System.Drawing.Bitmap]::FromFile((Join-Path $reviewDir '../nox-introduction/browser-pass-5.jpg'))
$capture = [System.Drawing.Bitmap]::FromFile((Join-Path $reviewDir 'browser-final.jpg'))
$font = [System.Drawing.Font]::new('Arial', 12)
$brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235,225,238))
try {
  $canvas = [System.Drawing.Bitmap]::new(1046,557)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.Clear([System.Drawing.Color]::FromArgb(8,10,20))
  $g.DrawString('Panel 2 reference (storyboard caption retained)', $font, $brush, 10, 9)
  $g.DrawString('Browser: environment + integrated lighting', $font, $brush, 529, 9)
  $g.DrawImage($reference,[System.Drawing.Rectangle]::new(10,38,507,505))
  $g.DrawImage($capture,[System.Drawing.Rectangle]::new(529,38,507,505))
  $canvas.Save((Join-Path $reviewDir 'comparison.png'),[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $canvas.Dispose()

  $canvas = [System.Drawing.Bitmap]::new(1272,394)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.Clear([System.Drawing.Color]::FromArgb(8,10,20))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawString('Approved geometry: browser pass 5', $font, $brush, 10, 9)
  $g.DrawString('Same geometry: integrated lighting', $font, $brush, 642, 9)
  $srcRect = [System.Drawing.Rectangle]::new(35,220,430,240)
  $g.DrawImage($approved,[System.Drawing.Rectangle]::new(10,40,620,346),$srcRect,[System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawImage($capture,[System.Drawing.Rectangle]::new(642,40,620,346),$srcRect,[System.Drawing.GraphicsUnit]::Pixel)
  $canvas.Save((Join-Path $reviewDir 'character-lighting-comparison.png'),[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $canvas.Dispose()
} finally {
  $reference.Dispose(); $approved.Dispose(); $capture.Dispose(); $font.Dispose(); $brush.Dispose()
}
