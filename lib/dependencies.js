const { execSync } = require("child_process");
const os = require("os");

let missing = [];
let installCommands = [];

// Function to run a command safely and return output
const runCommand = (cmd) => {
    try {
        return execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim();
    } catch {
        return null;
    }
};

// 1️⃣ Check Python 3 (any version)
const pythonVersion = runCommand("python3 --version || python --version");
if (pythonVersion && pythonVersion.startsWith("Python 3")) {
    console.log(`✅ Python version detected: ${pythonVersion}`);
} else {
    console.log("❌ Python 3 is not detected.");
    missing.push("Python 3 is required.");
    installCommands.push(
        os.platform() === "win32"
            ? 'winget install "Python.Python.3" -h'
            : "brew install python"
    );
}

// 2️⃣ Check Node.js 18+
const nodeVersion = runCommand("node -v");
if (nodeVersion) {
    const majorVersion = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
    if (majorVersion >= 18) {
        console.log(`✅ Node.js version detected: ${nodeVersion}`);
    } else {
        console.log(`⚠️ Node.js version is outdated: ${nodeVersion} (18+ required).`);
        missing.push(`Node.js 18 or higher is required. Current version: ${nodeVersion}`);
        installCommands.push(
            os.platform() === "win32"
                ? 'winget install "OpenJS.NodeJS.LTS" -h'
                : "brew install node@18"
        );
    }
} else {
    console.log("❌ Node.js is not installed.");
    missing.push("Node.js 18 or higher is required.");
    installCommands.push(
        os.platform() === "win32"
            ? 'winget install "OpenJS.NodeJS.LTS" -h'
            : "brew install node@18"
    );
}

// Windows-only checks
if (os.platform() === "win32") {
    // 3️⃣ Check Visual Studio 2022 with Native Desktop workload
    const vsCheck = runCommand('reg query "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\22.0" /s');
    if (vsCheck && vsCheck.includes("Visual Studio")) {
        console.log("✅ Visual Studio 2022 detected.");
    } else {
        console.log("⚠️ Visual Studio 2022 with NativeDesktop workload is not detected.");
        missing.push("Visual Studio 2022 with NativeDesktop workload is recommended.");
        installCommands.push(
            'winget install "Microsoft.VisualStudio.2022.Enterprise" -h --override "--add Microsoft.VisualStudio.Workload.NativeDesktop"'
        );
    }

    // 4️⃣ Check PowerShell Execution Policy
    const executionPolicy = runCommand("powershell -Command Get-ExecutionPolicy -Scope CurrentUser");
    if (executionPolicy) {
        if (executionPolicy.trim() === "RemoteSigned") {
            console.log(`✅ PowerShell Execution Policy: ${executionPolicy}`);
        } else {
            console.log(`⚠️ PowerShell Execution Policy is not 'RemoteSigned' (current: ${executionPolicy}).`);
            missing.push(`PowerShell Execution Policy should be 'RemoteSigned'. Current: ${executionPolicy}`);
            installCommands.push("powershell -Command Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force");
        }
    } else {
        console.log("⚠️ Unable to determine PowerShell Execution Policy.");
    }
}

// Output results
console.log("\n🔍 Dependency Check Summary:");
if (missing.length > 0) {
    console.log("\n🔴 Missing or Outdated Dependencies:\n");
    missing.forEach((msg) => console.log(`  ❌ ${msg}`));

    console.log("\n⚡ To fix, run the following commands:\n");
    installCommands.forEach((cmd) => console.log(`  ➤ ${cmd}`));

    console.log("\nAfter installing the dependencies, please restart the script.\n");
    process.exit(1);
} else {
    console.log("\n✅ All dependencies meet the required versions.\n");
}
