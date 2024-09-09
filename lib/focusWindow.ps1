Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class User32 {
        [DllImport("user32.dll")]
        public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool IsIconic(IntPtr hWnd);
    }
"@

function Control-Window {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProcessName,

        [Parameter(Mandatory=$true)]
        [ValidateSet("Minimize", "Show")]
        [string]$Action
    )

    $processes = Get-Process | Where-Object {
        $_.MainWindowTitle -and ($_.ProcessName -like "*$ProcessName*" -or $_.MainWindowTitle -like "*$ProcessName*")
    }

    if (-not $processes) {
        Write-Host "No window found with the name containing '$ProcessName'"
        return
    }

    foreach ($proc in $processes) {
        $hwnd = $proc.MainWindowHandle

        if ($Action -eq "Minimize") {
            # Minimize the window
            [User32]::ShowWindowAsync($hwnd, 6) | Out-Null # 6 is SW_MINIMIZE
            Write-Host "Minimized '$($proc.MainWindowTitle)'."
        }
        elseif ($Action -eq "Show") {
            # Check if the window is minimized
            if ([User32]::IsIconic($hwnd)) {
                # If minimized, restore the window
                [User32]::ShowWindowAsync($hwnd, 9) | Out-Null # 9 is SW_RESTORE
            }

            # Bring the window to the foreground
            [User32]::SetForegroundWindow($hwnd) | Out-Null
            Write-Host "Brought '$($proc.MainWindowTitle)' to the foreground."
        }
    }
}

# Usage example:
# Control-Window -ProcessName "notepad" -Action "Minimize"
# Control-Window -ProcessName "notepad" -Action "Show"
