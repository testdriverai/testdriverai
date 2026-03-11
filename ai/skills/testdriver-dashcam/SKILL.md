---
name: testdriver:dashcam
description: Record test execution with video and logs
---
<!-- Generated from dashcam.mdx. DO NOT EDIT. -->

## Overview

Dashcam provides automatic video recording and log aggregation for your tests. It captures screen recordings, application logs, and test execution details that can be reviewed later.

## Basic Usage

### With Presets

Most presets automatically include Dashcam:

```javascript
import { test } from 'vitest';
import { chrome } from 'testdriverai/presets';

test('my test', async (context) => {
  const { testdriver, dashcam } = await chrome(context, {
    url: 'https://example.com'
  });
  
  // Test executes with recording automatically
  await testdriver.find('login button').then(el => el.click());
  
  // Dashcam URL available after test
  console.log('Replay:', dashcam.url);
});
```

### Manual Setup

For more control, create a Dashcam instance directly:

```javascript
import TestDriver from 'testdriverai';
import Dashcam from 'testdriverai/lib/core/Dashcam.js';

const client = await TestDriver.create({ os: 'linux' });
const dashcam = new Dashcam(client, {
  apiKey: process.env.DASHCAM_API_KEY
});

await dashcam.auth();
await dashcam.start();

// Run your tests

const url = await dashcam.stop();
console.log('Replay URL:', url);
```

## Constructor

Create a new Dashcam instance:

```javascript
new Dashcam(client, options)
```

### Parameters

<ParamField path="client" type="TestDriver" required>
  TestDriver client instance
</ParamField>

<ParamField path="options" type="object">
  Configuration options

  <Expandable title="options properties">
    <ParamField path="apiKey" type="string" default="4e93d8bf-3886-4d26-a144-116c4063522d">
      Dashcam API key for authentication
    </ParamField>

    <ParamField path="autoStart" type="boolean" default={false}>
      Automatically start recording after authentication
    </ParamField>

    <ParamField path="logs" type="array" default={[]}>
      Log configurations to add automatically
    </ParamField>
  </Expandable>
</ParamField>

## Methods

### auth()

Authenticate with Dashcam service:

```javascript
await dashcam.auth(apiKey)
```

<ParamField path="apiKey" type="string" optional>
  Override the API key set in constructor
</ParamField>

**Returns:** `Promise<void>`

**Example:**
```javascript
await dashcam.auth('your-api-key');
```

### start()

Start recording:

```javascript
await dashcam.start()
```

**Returns:** `Promise<void>`

**Example:**
```javascript
await dashcam.start();
console.log('Recording started');
```

### stop()

Stop recording and retrieve replay URL:

```javascript
await dashcam.stop()
```

**Returns:** `Promise<string|null>` - Replay URL if available

**Example:**
```javascript
const url = await dashcam.stop();
if (url) {
  console.log('Watch replay:', url);
} else {
  console.log('No replay URL available');
}
```

### addFileLog()

Track a log file in the recording:

```javascript
await dashcam.addFileLog(path, name)
```

<ParamField path="path" type="string" required>
  Path to the log file
</ParamField>

<ParamField path="name" type="string" required>
  Display name for the log in Dashcam
</ParamField>

**Returns:** `Promise<void>`

**Example:**
```javascript
// Linux/Mac
await dashcam.addFileLog('/tmp/app.log', 'Application Log');

// Windows
await dashcam.addFileLog('C:\\logs\\app.log', 'Application Log');
```

### addApplicationLog()

Track application-specific logs:

```javascript
await dashcam.addApplicationLog(application, name)
```

<ParamField path="application" type="string" required>
  Application name to track
</ParamField>

<ParamField path="name" type="string" required>
  Display name for the log
</ParamField>

**Returns:** `Promise<void>`

**Example:**
```javascript
await dashcam.addApplicationLog('Google Chrome', 'Browser Logs');
```

### addLog()

Generic method to add any type of log:

```javascript
await dashcam.addLog(config)
```

<ParamField path="config" type="object" required>
  Log configuration

  <Expandable title="config properties">
    <ParamField path="name" type="string" required>
      Display name for the log
    </ParamField>

    <ParamField path="type" type="string" required>
      Log type: `'file'`, `'stdout'`, or `'application'`
    </ParamField>

    <ParamField path="path" type="string">
      File path (required for type='file')
    </ParamField>

    <ParamField path="application" type="string">
      Application name (required for type='application')
    </ParamField>
  </Expandable>
</ParamField>

**Returns:** `Promise<void>`

**Example:**
```javascript
await dashcam.addLog({
  name: 'Test Output',
  type: 'file',
  path: '/tmp/test.log'
});

await dashcam.addLog({
  name: 'Chrome Logs',
  type: 'application',
  application: 'Google Chrome'
});
```

### isRecording()

Check if currently recording:

```javascript
await dashcam.isRecording()
```

**Returns:** `Promise<boolean>` - True if recording is active

**Example:**
```javascript
if (await dashcam.isRecording()) {
  console.log('Recording in progress');
}
```

## Properties

### recording

Current recording state:

```javascript
dashcam.recording // boolean
```

### apiKey

Configured API key:

```javascript
dashcam.apiKey // string
```

### client

Associated TestDriver client:

```javascript
dashcam.client // TestDriver instance
```

## Complete Examples

### Basic Recording

```javascript
import { test } from 'vitest';
import TestDriver from 'testdriverai';
import Dashcam from 'testdriverai/lib/core/Dashcam.js';

test('record test execution', async () => {
  const client = await TestDriver.create({ os: 'linux' });
  const dashcam = new Dashcam(client);
  
  await dashcam.auth();
  await dashcam.start();
  
  // Run your test
  await client.find('button').then(el => el.click());
  
  const url = await dashcam.stop();
  console.log('Replay:', url);
  
  await client.cleanup();
});
```

### With Log Tracking

```javascript
test('record with logs', async () => {
  const client = await TestDriver.create({ os: 'linux' });
  const dashcam = new Dashcam(client);
  
  await dashcam.auth();
  
  // Add log files before starting
  await dashcam.addFileLog('/tmp/testdriver.log', 'TestDriver Log');
  await dashcam.addFileLog('/tmp/app.log', 'Application Log');
  
  await dashcam.start();
  
  // Test execution
  await client.find('login button').then(el => el.click());
  
  const url = await dashcam.stop();
  console.log('Replay with logs:', url);
  
  await client.cleanup();
});
```

### Auto-start Configuration

```javascript
test('auto-start recording', async () => {
  const client = await TestDriver.create({ os: 'linux' });
  const dashcam = new Dashcam(client, {
    autoStart: true,
    logs: [
      {
        name: 'App Log',
        type: 'file',
        path: '/tmp/app.log'
      }
    ]
  });
  
  await dashcam.auth(); // Automatically starts recording
  
  // Test execution
  await client.find('submit button').then(el => el.click());
  
  const url = await dashcam.stop();
  console.log('Replay:', url);
  
  await client.cleanup();
});
```

### Using with Presets

```javascript
import { chrome } from 'testdriverai/presets';

test('preset with dashcam', async (context) => {
  const { testdriver, dashcam } = await chrome(context, {
    url: 'https://example.com',
    dashcam: true // Enabled by default
  });
  
  // Test runs with automatic recording
  await testdriver.find('button').then(el => el.click());
  
  // URL automatically available
  console.log('Replay:', dashcam.url);
});
```

### Disabling Dashcam in Presets

```javascript
test('without dashcam', async (context) => {
  const { testdriver } = await chrome(context, {
    url: 'https://example.com',
    dashcam: false // Disable recording
  });
  
  // Test runs without recording (faster)
  await testdriver.find('button').then(el => el.click());
});
```

## Platform Differences

### Windows

On Windows, Dashcam uses PowerShell commands and installs via npm:

```javascript
// Windows-specific paths
await dashcam.addFileLog(
  'C:\\Users\\testdriver\\Documents\\testdriver.log',
  'TestDriver Log'
);
```

### Linux/Mac

On Linux/Mac, Dashcam uses shell commands:

```javascript
// Unix-specific paths
await dashcam.addFileLog('/tmp/testdriver.log', 'TestDriver Log');
```
