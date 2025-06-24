# Get cumulative total bytes sent and received for each network interface
$networkInterfaces = Get-WmiObject -Query "SELECT Name, BytesReceivedPerSec, BytesSentPerSec FROM Win32_PerfRawData_Tcpip_NetworkInterface"

# Initialize counters
$totalBytesSent = 0
$totalBytesReceived = 0

# Sum up the cumulative bytes sent and received for all interfaces
foreach ($interface in $networkInterfaces) {
    $totalBytesSent += $interface.BytesSentPerSec
    $totalBytesReceived += $interface.BytesReceivedPerSec
}

# Calculate the overall total bytes transferred
$totalNetworkBytes = $totalBytesSent + $totalBytesReceived

# Output results in JSON format for parsing in Node.js
Write-Output "{`"totalBytesSent`": $totalBytesSent, `"totalBytesReceived`": $totalBytesReceived, `"totalNetworkBytes`": $totalNetworkBytes}"
