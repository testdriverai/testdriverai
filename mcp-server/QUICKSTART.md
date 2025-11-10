# TestDriver MCP Server - Quick Reference

## Key Features

✅ **Spawn VMs** - Start Windows sandbox with live debugger UI  
✅ **Watch Live** - View VM screen in browser at localhost:3000  
✅ **Build Tests** - Create YAML or JavaScript tests incrementally  
✅ **Track Actions** - Automatically record all commands performed  
✅ **Generate Tests** - Convert action history to reusable test files  
✅ **Run Tests** - Execute saved test files in the sandbox  

---

## Essential Commands

### Start VM with Debugger
```
Connect to TestDriver with debugger enabled
```
Returns: `http://localhost:3000` (open in browser to watch)

### Build Test Step-by-Step
```
For each action, append it to tests/my-test.yaml:
- [describe action]
- [describe action]
```

### Generate Test from History
```
Create a test file from all actions at tests/generated.yaml
```

### Run a Test File
```
Run the test file at tests/my-test.yaml
```

---

## Common Workflows

### 1️⃣ Interactive Development
```
1. Start VM with debugger
2. Perform action
3. Append to test file
4. Take screenshot
5. Repeat
```

### 2️⃣ Record & Replay
```
1. Connect
2. Perform complete flow
3. Generate test from history
4. Run the generated test
```

### 3️⃣ TDD Style
```
1. Create empty test file
2. Add one command
3. Run it
4. Verify with screenshot
5. Add next command
```

---

## Tool Reference

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `testdriver_connect` | Start VM | Beginning of session |
| `testdriver_getDebuggerUrl` | Get UI URL | To watch VM live |
| `testdriver_writeTestFile` | Create test | Save actions to file |
| `testdriver_appendYamlCommand` | Add command | Build test incrementally |
| `testdriver_createTestFromActions` | Generate test | Convert history to file |
| `testdriver_runTestFile` | Execute test | Run saved test |
| `testdriver_getScreenshot` | Capture screen | Verify current state |
| `testdriver_disconnect` | Stop VM | End of session |

---

## Action Tracking

The MCP server automatically tracks every command you perform:

```javascript
// These actions are tracked:
testdriver_hoverText
testdriver_type
testdriver_pressKeys
testdriver_scroll
testdriver_waitForText
testdriver_assert
// ... and all other commands
```

**Access the history:**
```
Create a test from all actions I've performed
```

**Clear the history:**
```
Disconnect and reconnect
```

---

## File Formats

### YAML Test
```yaml
name: Login Test
description: Test user login flow
commands:
  - command: hover-text
    text: Username
    action: click
  - command: type
    text: standard_user
  - command: press-keys
    keys: [enter]
```

### JavaScript Test
```javascript
import { createTestClient } from './setup/testHelpers.mjs';

it('should login', async () => {
  const client = createTestClient();
  await client.hoverText('Username', '', 'click');
  await client.type('standard_user');
  await client.pressKeys(['enter']);
});
```

---

## Debugger UI

When you connect with debugger enabled:

- **URL**: `http://localhost:3000`
- **Features**:
  - Live VM screen
  - Real-time updates
  - Event log
  - Screenshot capture
  - Command history

**Pro Tip**: Keep the debugger open in a browser tab while building tests!

---

## Best Practices

### ✅ DO
- Start with debugger to see what's happening
- Build tests incrementally 
- Take screenshots frequently
- Save to file after each major action
- Use descriptive file names
- Generate both YAML and JS versions

### ❌ DON'T
- Forget to disconnect (wastes VM time)
- Build entire test in memory without saving
- Use generic file names like test1.yaml
- Skip screenshot verification
- Ignore the debugger URL

---

## Example Prompts

### Get Started
```
Connect to TestDriver with debugger and give me the URL
```

### Build Test
```
Create tests/login.yaml and append these commands:
1. Wait for login page
2. Click username field
3. Type "test_user"
4. Submit form
```

### Generate from Actions
```
I've performed several actions. Create a test file at 
tests/recorded-session.yaml from everything I did.
```

### Run Test
```
Run the test at tests/login.yaml and show me results
```

---

## Troubleshooting

**Q: Can't see the debugger?**  
A: Make sure you used `Connect to TestDriver with debugger enabled`

**Q: Actions not being saved?**  
A: Use `testdriver_writeTestFile` or `testdriver_appendYamlCommand`

**Q: Lost my action history?**  
A: History clears on disconnect. Save frequently!

**Q: Test file not found?**  
A: Use paths relative to project root or absolute paths

**Q: Want to start over?**  
A: Disconnect and reconnect to clear history

---

## Quick Tips

💡 **Watch the VM**: Always open the debugger URL  
💡 **Save Often**: Append to file after each action  
💡 **Use Screenshots**: Verify before continuing  
💡 **Track History**: Generate tests from actions  
💡 **Both Formats**: Create YAML and JavaScript versions  

---

## Need More Help?

- Full examples: [VM_EXAMPLES.md](./VM_EXAMPLES.md)
- All prompts: [EXAMPLES.md](./EXAMPLES.md)
- Complete docs: [README.md](./README.md)

---

**Ready to start?** Try this:

```
Claude, connect to TestDriver with the debugger enabled, 
give me the URL, and help me build my first test!
```
