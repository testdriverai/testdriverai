<div align="center">
  <a href="https://testdriver.ai">
    <img width="250" alt="TestDriver.ai Icon" src="https://github.com/user-attachments/assets/c591b39d-6e17-454b-b36d-370ae8618840" />
  </a>
</div>

<h1 align="center">Computer-Use SDK for E2E QA Testing</h1>

<div align="center">The TestDriver SDK is a JS plugin for vitest that makes it easy to spawn ephemeral devices and use vision-based LLMs to construct detemanistic and reliable tests.

<br />
<br />
  
[🚀 **Quick Start**](#-quick-start) • [📖 **Documentation**](https://docs.testdriver.ai) • [💻 **Examples**](https://github.com/testdriverai/testdriverai/tree/main/test/testdriver) • [📖 **Pricing**](https://docs.testdriver.ai) • [💬 **Discord**](https://discord.com/invite/cWDFW8DzPm) • [🌐 **Website**](https://testdriver.ai)

</div>

<img width="1490" height="854" alt="image" src="https://github.com/user-attachments/assets/36e426cc-e740-426f-b9f6-6e8565e66ad6" />

---

## Why TestDriver?

Don't ship bugs because flows are too hard to test. TestDriver helps engineering teams easily test, debug, and monitor E2E flows that are hard or impossible to cover with other tools like:

*Third-Party Web Apps* • *Desktop Apps* • *VS Code Extensions* • *Chrome Extensions* • *AI Chatbots* • *OAuth Flows* • *PDF Content* • *Spelling & Grammar* • *File System & Uploads* • *OS Accessibility* • *Visual Content* • *`<iframe>`* • *`<canvas>`* • *`<video>`*

## Example

```js
// Click on the new text document
await testdriver.find("New text document").mouseDown();

// Drag the "New Text Document" icon to the "Recycle Bin" 
await testdriver.find("Recycle Bin icon").mouseUp();

// Assert "New Text Document" icon is not on the Desktop
const result = await testdriver.assert(
  'the "New Text Document" icon is not visible on the Desktop'
);
expect(result).toBeTruthy();
```

[See Full Example](https://github.com/testdriverai/testdriverai/blob/main/test/testdriver/drag-and-drop.test.mjs) • [Browse All Examples](https://github.com/testdriverai/testdriverai/tree/main/test/testdriver)

---

## 🚀 Quick Start

### Step 1: Create a TestDriver Account

<a href="https://console.testdriver.ai/team"><img src="https://img.shields.io/badge/Sign_Up-Free_Account-blue?style=for-the-badge" alt="Sign Up"/></a>

*No credit card required!*

### Step 2: Initialize Your Project

```bash
npx testdriverai@beta init
```

This will:
- Create a project folder
- Install dependencies (Vitest + TestDriver)
- Set up your API key
- Generate an example test

### Step 3: Run Your First Test

```bash
vitest run
```

Watch as TestDriver:
1. Spawns a cloud sandbox
2. Launches Chrome
3. Runs your test using AI vision
4. Returns results with video replay

<a href="https://docs.testdriver.ai/v7/quickstart"><img src="https://img.shields.io/badge/📖_Read_Full_Quickstart-4A90E2?style=for-the-badge" alt="Full Quickstart"/></a>
