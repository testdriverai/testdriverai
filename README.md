<div align="center">
  <a href="https://testdriver.ai">
    <img src="https://github.com/dashcamio/testdriver/assets/318295/2a0ad981-8504-46f0-ad97-60cb6c26f1e7" height="200" alt="TestDriver.ai"/>
  </a>
</div>
<h4 align="center">
  Reliably test your most difficult flows. Don't ship bugs because flows are too hard to test.
</h4>

<p align="center">
  TestDriver helps engineering teams easily test, debug, and monitor E2E flows that are hard or impossible to cover with other tools.
</p>

<div align="center">
  
[🚀 **Quick Start**](#-quick-start) • [📖 **Documentation**](https://docs.testdriver.ai) • [💻 **Examples**](https://github.com/testdriverai/testdriverai/tree/main/test/testdriver) • [💬 **Discord**](https://discord.com/invite/cWDFW8DzPm) • [🌐 **Website**](https://testdriver.ai)

</div>

---

## 🎬 What Can You Test?

<div align="center">

**Third-Party Web Apps** • **Desktop Apps** • **VS Code Extensions** • **Chrome Extensions** • **AI Chatbots** • **OAuth Flows** • **PDF Content** • **Spelling & Grammar** • **File System & Uploads** • **OS Accessibility** • **Visual Content** • **`<iframe>`** • **`<canvas>`** • **`<video>`**

</div>

---

## 🎯 Why TestDriver?

TestDriver isn't just another testing framework—it's a **computer-use agent for QA**. Using AI vision and mouse/keyboard emulation, TestDriver can test anything you can see on screen, just like a human QA engineer would.

### The Problem with Traditional Testing

Modern testing tools like Playwright are powerful but limited to selector-based testing in single browser tabs. This breaks down when you need to test:

| Challenge | Traditional Tools | TestDriver |
|-----------|------------------|------------|
| **Dynamic AI Content** | ❌ No selectors for chatbots, images, videos | ✅ AI vision sees everything |
| **Fast-Moving Teams** | ❌ Brittle selectors break constantly | ✅ Natural language adapts to changes |
| **Desktop Applications** | ❌ Web-only tools | ✅ Full OS control |
| **Third-Party Software** | ❌ No access to selectors | ✅ Tests anything visible |
| **Visual States** | ❌ Can't verify layouts, charts, images | ✅ Computer vision validation |
| **Multi-App Workflows** | ❌ Single-app limitation | ✅ Cross-application testing |

### The TestDriver Solution

```javascript
// Instead of fragile selectors...
await page.locator('#user-menu > div.dropdown > button[data-testid="profile-btn"]').click();

// ...use natural language that adapts to UI changes
await testdriver.find('profile button in the top right').click();
```

---

## 🚀 Quick Start

Get your first test running in under 5 minutes:

### Step 1: Create a TestDriver Account

<a href="https://app.testdriver.ai/team"><img src="https://img.shields.io/badge/Sign_Up-Free_Account-blue?style=for-the-badge" alt="Sign Up"/></a>

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

<div align="center">
<a href="https://docs.testdriver.ai/v7/quickstart"><img src="https://img.shields.io/badge/📖_Read_Full_Quickstart-4A90E2?style=for-the-badge" alt="Full Quickstart"/></a>
</div>

---

## �️ Core Concepts

### Real-World Examples

#### Web Applications

```javascript
// Test dynamic AI chatbots (no selectors needed!)
test('chatbot conversation', async (context) => {
  const { testdriver } = await chrome(context, { url: 'https://chatapp.com' });
  
  await testdriver.find('message input').type('What is TestDriver?');
  await testdriver.find('send button').click();
  
  const response = await testdriver.assert('AI response is visible');
  expect(response).toBeTruthy();
});

// Test OAuth flows across multiple domains
test('OAuth login', async (context) => {
  const { testdriver } = await chrome(context, { url: 'https://myapp.com' });
  
  await testdriver.find('Login with Google').click();
  // Handles popup, enters credentials, returns to app
  await testdriver.find('email input').type('user@gmail.com');
  await testdriver.find('password input').type('password');
  await testdriver.find('Sign in').click();
  
  await testdriver.assert('successfully logged into the app');
});
```

#### Desktop Applications

```javascript
// Install and test native desktop apps
test('desktop app', async (context) => {
  const testdriver = TestDriver(context, { os: 'windows' });
  
  await testdriver.provision.installer({
    url: 'https://example.com/MyApp.msi',
    launch: true
  });
  
  await testdriver.find('main window').assert('app launched successfully');
});
```

#### Browser Extensions

```javascript
// Test Chrome extensions from the Web Store
test('chrome extension', async (context) => {
  const { testdriver } = await chrome(context);
  
  await testdriver.provision.chromeExtension({
    extensionId: 'liecbddmkiiihnedobmlmillhodjkdmb' // Loom
  });
  
  const button = await testdriver.find('extension icon in toolbar');
  await button.click();
  
  const panel = await testdriver.find('extension popup');
  expect(panel.found()).toBeTruthy();
});
```

#### Visual Validation

```javascript
// Verify visual states, charts, images
test('dashboard chart', async (context) => {
  const { testdriver } = await chrome(context, { url: 'https://analytics.example.com' });
  
  await testdriver.assert('line chart shows upward trend');
  await testdriver.assert('data points are visible on the graph');
  
  // Extract text from images/PDFs
  const value = await testdriver.extract('the total revenue number');
  console.log('Revenue:', value);
});

// Test spelling and grammar checking
test('content validation', async (context) => {
  const { testdriver } = await chrome(context, { url: 'https://docs.example.com' });
  
  await testdriver.assert('there are no spelling errors on the page');
  await testdriver.assert('all headings use title case');
});

// Test canvas and video elements
test('canvas rendering', async (context) => {
  const { testdriver } = await chrome(context, { url: 'https://canvas-app.com' });
  
  await testdriver.find('draw tool').click();
  await testdriver.assert('canvas shows a red circle');
  
  // Video content validation
  await testdriver.assert('video is playing');
  await testdriver.assert('video progress bar shows 50% complete');
});
```

#### Multi-Application Workflows

```javascript
// Test interactions across multiple apps
test('copy from browser to VS Code', async (context) => {
  const testdriver = TestDriver(context, { os: 'linux' });
  
  await testdriver.provision.chrome({ url: 'https://example.com' });
  await testdriver.find('code snippet').click();
  await testdriver.pressKeys(['ctrl', 'c']);
  
  await testdriver.provision.vscode();
  await testdriver.find('editor').click();
  await testdriver.pressKeys(['ctrl', 'v']);
  
  await testdriver.assert('code is pasted in editor');
});
```

<div align="center">
<a href="https://github.com/testdriverai/testdriverai/tree/main/test/testdriver"><img src="https://img.shields.io/badge/💻_Browse_More_Examples-gray?style=for-the-badge" alt="More Examples"/></a>
</div>
