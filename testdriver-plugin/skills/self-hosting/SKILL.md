---
name: self-hosting
description: Self-host TestDriver sandboxes. Use when running Windows tests on AWS, configuring custom AMIs, or setting up your own infrastructure.
---

# Self-Hosting

Read: `node_modules/testdriverai/docs/v7/self-hosted.mdx`
Read: `node_modules/testdriverai/docs/v7/aws-setup.mdx`

## When to Self-Host

- **Windows testing** - Required for Windows sandboxes
- **Custom environments** - Special software or configurations
- **Data compliance** - Keep tests in your own infrastructure
- **Performance** - Reduce latency with regional instances

## AWS Setup for Windows

### Prerequisites
1. AWS account with EC2 access
2. TestDriver Windows AMI (contact support)
3. VPC with public subnet

### Required Environment Variables

```bash
TD_API_KEY=your_api_key
TD_OS=windows
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AMI_ID=ami-0dd5fa241273a7d50
AWS_LAUNCH_TEMPLATE_ID=lt-0ef9bf26a945fb442
```

### Launch Template Configuration

Create an EC2 launch template with:
- Instance type: `c5.xlarge` or larger
- AMI: TestDriver Windows AMI
- Security group: Allow RDP (3389) and TestDriver ports
- IAM role: EC2 permissions for your use case

### Running Windows Tests

```bash
TD_OS=windows npx vitest run tests/windows-app.test.mjs
```

## Test Configuration

```javascript
const testdriver = TestDriver(context, {
  os: 'windows',  // Use Windows sandbox
});

await testdriver.provision.chrome({ url: 'https://example.com' });
// or
await testdriver.provision.installer({
  url: 'https://example.com/app.msi',
  launch: true,
});
```

## Windows-Specific Examples

- `node_modules/testdriverai/examples/windows-installer.test.mjs`
- `node_modules/testdriverai/examples/exec-pwsh.test.mjs`

## PowerShell Execution

```javascript
// Run PowerShell commands on Windows
const result = await testdriver.exec("pwsh", "Get-Date", 5000);
const files = await testdriver.exec("pwsh", "Get-ChildItem C:\\", 5000);
```

## Troubleshooting

**Instance not starting?**
- Check AWS credentials and permissions
- Verify launch template exists
- Check AMI is available in your region

**Connection timeout?**
- Security group must allow inbound traffic
- Instance needs public IP or NAT gateway
- Check TestDriver agent is running on AMI
