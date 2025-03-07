const { execSync } = require("child_process");
const os = require("os");

let missing = [];
let installCommands = [];

// Function to run a command safely
const runCommand = (cmd) => {
    try {
        return execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim();
    } catch {
        return null;
    }
};

// 1️⃣ Check Python 3 (any version)
const pythonVersion = runCommand("python3 --version || python --version");
if (!pythonVersion || !pythonVersion.startsWith("Python 3")) {
    missing.push("❌ Python 3 is required.");
    installCommands.push(
        os.platform() === "win32"
            ? 'winget install "Python.Python.3" -h'
            : "brew install python"
    );
}

// 2️⃣ Check Node.js 20+
const nodeVersion = runCommand("node -v");
if (nodeVersion) {
    const majorVersion = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
    if (majorVersion < 20) {
        missing.push("❌ Node.js 20 or higher is required.");
        installCommands.push(
            os.platform() === "win32"
                ? 'winget install "OpenJS.NodeJS.LTS" -h'
                : "brew install node@20"
        );
    }
} else {
    missing.push("❌ Node.js is not installed.");
    installCommands.push(
        os.platform() === "win32"
            ? 'winget install "OpenJS.NodeJS.LTS" -h'
            : "brew install node@20"
    );
}

// Windows-only checks
if (os.platform() === "win32") {
    // 3️⃣ Check Visual Studio 2022 with Native Desktop workload
    const vsCheck = runCommand('reg query "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\22.0" /s');
    if (!vsCheck || !vsCheck.includes("Visual Studio")) {
        missing.push("⚠️ Visual Studio 2022 with NativeDesktop workload is recommended.");
        installCommands.push(
            'winget install "Microsoft.VisualStudio.2022.Enterprise" -h --override "--add Microsoft.VisualStudio.Workload.NativeDesktop"'
        );
    }

    // 4️⃣ Check PowerShell Execution Policy
    const executionPolicy = runCommand("powershell -Command Get-ExecutionPolicy -Scope CurrentUser");
    if (executionPolicy && executionPolicy.trim() !== "RemoteSigned") {
        missing.push("⚠️ PowerShell Execution Policy should be 'RemoteSigned'.");
        installCommands.push("powershell -Command Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force");
    }
}

// Output results
if (missing.length > 0) {
    console.log("\n🔴 Missing Dependencies Detected:\n");
    missing.forEach((msg) => console.log(msg));

    console.log("\n⚡ To fix, run the following commands:\n");
    installCommands.forEach((cmd) => console.log(`  ➤ ${cmd}`));

    console.log("\nAfter installing the dependencies, please restart the script.\n");
    process.exit(1);
} else {
    console.log("\n✅ All dependencies are installed.\n");
}
