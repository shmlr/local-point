$ErrorActionPreference = "Stop"

param(
  [int]$Days = 45,
  [int]$MaxFiles = 500
)

$Needle = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("0KHQvdC10LbQsNC90LA="))
$Cutoff = (Get-Date).AddDays(-[Math]::Abs($Days))

$Roots = @(
  $PSScriptRoot,
  (Join-Path $HOME "Downloads"),
  (Join-Path $HOME "Desktop"),
  (Join-Path $HOME "Documents"),
  "D:\R01-Agent-Workspace"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$Files = @()
foreach ($Root in $Roots) {
  $Files += Get-ChildItem -Path $Root -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object {
      $_.LastWriteTime -ge $Cutoff -and
      $_.Extension.ToLowerInvariant() -in @(".xlsx", ".xls", ".csv")
    }
}

$Files = @($Files | Sort-Object LastWriteTime -Descending, FullName -Unique | Select-Object -First $MaxFiles)

$Results = New-Object System.Collections.Generic.List[object]

foreach ($File in $Files | Where-Object { $_.Extension.ToLowerInvariant() -eq ".csv" }) {
  $Matches = Select-String -Path $File.FullName -Pattern $Needle -SimpleMatch -Encoding UTF8 -ErrorAction SilentlyContinue
  foreach ($Match in $Matches) {
    $Results.Add([pscustomobject]@{
      source_type = "csv"
      file = $File.FullName
      modified_at = $File.LastWriteTime.ToString("o")
      sheet = $null
      row = $Match.LineNumber
      content = $Match.Line
    })
  }
}

$Excel = $null
try {
  $Excel = New-Object -ComObject Excel.Application
  $Excel.Visible = $false
  $Excel.DisplayAlerts = $false

  foreach ($File in $Files | Where-Object { $_.Extension.ToLowerInvariant() -in @(".xlsx", ".xls") }) {
    $Workbook = $null
    try {
      $Workbook = $Excel.Workbooks.Open($File.FullName, 0, $true)
      foreach ($Sheet in @($Workbook.Worksheets)) {
        $Used = $Sheet.UsedRange
        if ($null -eq $Used) { continue }

        $Found = $Used.Find($Needle)
        if ($null -eq $Found) { continue }

        $FirstAddress = $Found.Address()
        $Current = $Found
        $Seen = @{}

        while ($null -ne $Current) {
          $Key = $Current.Address()
          if ($Seen.ContainsKey($Key)) { break }
          $Seen[$Key] = $true

          $RowNumber = [int]$Current.Row
          $FirstColumn = [int]$Used.Column
          $LastColumn = [Math]::Min($FirstColumn + [int]$Used.Columns.Count - 1, $FirstColumn + 49)

          $Cells = New-Object System.Collections.Generic.List[string]
          for ($Col = $FirstColumn; $Col -le $LastColumn; $Col++) {
            $Value = $Sheet.Cells.Item($RowNumber, $Col).Text
            if (-not [string]::IsNullOrWhiteSpace([string]$Value)) {
              $Cells.Add(([string]$Value).Trim())
            }
          }

          $Results.Add([pscustomobject]@{
            source_type = "excel"
            file = $File.FullName
            modified_at = $File.LastWriteTime.ToString("o")
            sheet = $Sheet.Name
            row = $RowNumber
            content = ($Cells -join " | ")
          })

          $Current = $Used.FindNext($Current)
          if ($null -eq $Current -or $Current.Address() -eq $FirstAddress) { break }
        }
      }
    } catch {
      Write-Host ("SCAN_FILE_BLOCKED=" + $File.FullName + " :: " + $_.Exception.Message) -ForegroundColor DarkYellow
    } finally {
      if ($null -ne $Workbook) {
        $Workbook.Close($false)
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($Workbook)
      }
    }
  }
} catch {
  Write-Host "EXCEL_COM_UNAVAILABLE" -ForegroundColor Yellow
  Write-Host $_.Exception.Message
} finally {
  if ($null -ne $Excel) {
    $Excel.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($Excel)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$Results = @($Results | Sort-Object modified_at -Descending)

Write-Host ("PALLETTA_SNEZHANA_SCAN_FILES=" + $Files.Count)
Write-Host ("PALLETTA_SNEZHANA_MATCHES=" + $Results.Count)

if ($Results.Count -eq 0) {
  Write-Host "PALLETTA_SNEZHANA_LOCAL_EVIDENCE=NOT_FOUND" -ForegroundColor Yellow
  exit 3
}

$Results | Format-Table -AutoSize -Wrap
Write-Host "PALLETTA_SNEZHANA_LOCAL_EVIDENCE=CANDIDATES_FOUND" -ForegroundColor Green
Write-Host "IMPORTANT: candidates are not automatically treated as current price or stock."
