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

function Bring-WindowToFront {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProcessName
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

        # Check if the window is minimized
        if ([User32]::IsIconic($hwnd)) {
            # If minimized, restore the window
            [User32]::ShowWindowAsync($hwnd, 9) | Out-Null
        }

        # Bring the window to the foreground
        [User32]::SetForegroundWindow($hwnd) | Out-Null

        Write-Host "Brought '$($proc.MainWindowTitle)' to the foreground."
    }
}

# Usage example:
Bring-WindowToFront -ProcessName $args[0]