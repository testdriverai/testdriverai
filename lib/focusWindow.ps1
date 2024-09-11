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
        [DllImport("user32.dll")]
        public static extern bool IsZoomed(IntPtr hWnd);
    }
"@

function Control-Window {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProcessName,

        [Parameter(Mandatory=$true)]
        [ValidateSet("Minimize", "Restore", "Focus")]
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

        switch ($Action) {
            "Minimize" {
                # Minimize the window
                [User32]::ShowWindowAsync($hwnd, 6) | Out-Null # 6 is SW_MINIMIZE
                Write-Host "Minimized '$($proc.MainWindowTitle)'."
            }
            "Restore" {
                # Restore the window if minimized
                if ([User32]::IsIconic($hwnd)) {
                    [User32]::ShowWindowAsync($hwnd, 9) | Out-Null # 9 is SW_RESTORE
                }
                # Bring the window to the foreground
                [User32]::SetForegroundWindow($hwnd) | Out-Null
                Write-Host "Restored and brought '$($proc.MainWindowTitle)' to the foreground."
            }
            "Focus" {
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
}

# Script entry point
if ($args.Length -eq 2) {
    $processName = $args[0]
    $action = $args[1]

    # Validate action parameter
    if ($action -notin @("Minimize", "Restore", "Focus")) {
        Write-Host "Invalid action. Valid actions are: Minimize, Restore, Focus."
        exit 1
    }

    # Call the Control-Window function with command-line arguments
    Control-Window -ProcessName $processName -Action $action
} else {
    Write-Host "Usage: .\ControlWindow.ps1 <ProcessName> <Action>"
    Write-Host "Actions: Minimize, Restore, Focus"
}
