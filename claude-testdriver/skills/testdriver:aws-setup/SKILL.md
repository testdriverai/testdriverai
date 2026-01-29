---
name: testdriver:aws-setup
description: Deploy TestDriver on your AWS infrastructure using CloudFormation
---
<!-- Generated from aws-setup.mdx. DO NOT EDIT. -->

This guide walks you through setting up self-hosted TestDriver instances on AWS. By the end, you'll have fully automated test infrastructure that spawns and terminates instances on-demand.

```mermaid
graph LR
    A[Vitest Test] --> B[setup-aws hook]
    B --> C[Spawns EC2]
    C --> D[Runs Test]
    D --> E[Terminates EC2]
```

## How It Works

TestDriver automatically manages AWS EC2 instances for your tests:

1. **Deploy CloudFormation** — One-time infrastructure setup
2. **Configure Vitest** — Add one line to your config
3. **Run Tests** — Instances spawn automatically, run tests, and terminate

That's it! No manual instance management needed.

# Quickstart

<Steps>
  <Step title="Deploy Infrastructure">
    <Card 
      title="Launch CloudFormation Stack" 
      icon="aws" 
      href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://v7-cloudformation-template.s3.us-east-2.amazonaws.com/cloudformation.yaml" 
      horizontal 
      arrow
    >
      One-click AWS setup
    </Card>
  </Step>
  
  <Step title="Add to Vitest Config">
    ```javascript vitest.config.mjs
    setupFiles: ['testdriverai/vitest/setup', 'testdriverai/vitest/setup-aws']
    ```
  </Step>
  
  <Step title="Run Tests">
    ```bash
    TD_OS=windows AWS_REGION=us-east-2 \
      AWS_LAUNCH_TEMPLATE_ID=lt-xxx AMI_ID=ami-xxx \
      npx vitest run
    ```
  </Step>
</Steps>

## Overview

The setup process is simple:

1. **Deploy CloudFormation** — Creates VPC, security groups, IAM roles, and launch templates
2. **Configure Vitest** — Add `setup-aws` to automatically manage instance lifecycle
3. **Run Tests** — Set `TD_OS=windows` with AWS credentials and instances spawn/terminate automatically


## Prerequisites

Before you begin, ensure you have:

- AWS account with CloudFormation permissions
- [AWS CLI](https://aws.amazon.com/cli/) installed and configured (`aws configure`)
- Access to the TestDriver AMI — [Contact us](http://testdriver.ai/demo) with your AWS region
- A GitHub repository for your tests

<Tip>
  The TestDriver Golden Image AMI ID is `ami-0504bf50fad62f312`. Contact us to get access in your preferred AWS region.
</Tip>

## Step 1: Deploy CloudFormation Stack

Our CloudFormation template creates all the AWS infrastructure you need:

- Dedicated VPC with public subnet
- Security group with required port access
- IAM roles and instance profiles
- EC2 launch template for instance creation

<Tabs>
  <Tab title="GUI">
    Click the button below to launch the CloudFormation stack in your AWS Console:

    <Card 
      title="Launch Stack" 
      icon="aws" 
      href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://v7-cloudformation-template.s3.us-east-2.amazonaws.com/cloudformation.yaml" 
      horizontal 
      arrow
    >
      Deploy TestDriver infrastructure with one click
    </Card>

    Configure the stack parameters:
    - **Stack name**: `testdriver-infrastructure` (or your preferred name)
    - **ProjectTag**: `testdriver`
    - **AllowedIngressCidr**: Your IP range (e.g., `203.0.113.0/24`)
    - **InstanceType**: `c5.xlarge` (recommended)
    - **CreateKeyPair**: `true`

    <Warning>
      **Security**: Replace `AllowedIngressCidr` with your specific IP ranges to restrict VPC access. Avoid using `0.0.0.0/0` in production.
    </Warning>

    ### Get Your Launch Template ID

    After the stack creation completes, navigate to the **Outputs** tab to find your `LaunchTemplateId`:

    ![Launch Template ID](/images/content/self-hosted/launchtemplateid.png)

    <Tip>
      **Save this ID** — you'll need it for spawning instances and CI configuration.
    </Tip>
  </Tab>
  <Tab title="CLI">
    Download the template from the [TestDriver CLI repository](https://github.com/testdriverai/testdriverai/blob/main/setup/aws/cloudformation.yaml), then deploy:

    ```bash
    aws cloudformation deploy \
      --template-file setup/aws/cloudformation.yaml \
      --stack-name testdriver-infrastructure \
      --parameter-overrides \
        ProjectTag=testdriver \
        AllowedIngressCidr=0.0.0.0/0 \
        InstanceType=c5.xlarge \
        CreateKeyPair=true \
      --capabilities CAPABILITY_IAM
    ```

    <Warning>
      **Security**: Replace `AllowedIngressCidr=0.0.0.0/0` with your specific IP ranges to restrict VPC access.
    </Warning>

    ### Get Your Launch Template ID

    After deployment completes, retrieve the launch template ID:

    ```bash
    aws cloudformation describe-stacks \
      --stack-name testdriver-infrastructure \
      --query 'Stacks[0].Outputs[?OutputKey==`LaunchTemplateId`].OutputValue' \
      --output text
    ```

    <Tip>
      **Save this ID** — you'll need it for spawning instances and CI configuration.
    </Tip>
  </Tab>
</Tabs>

## Step 2: Configure Vitest

Add the AWS setup hook to your `vitest.config.mjs`:

```javascript vitest.config.mjs
import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import TestDriver from 'testdriverai/vitest';

config(); // Load .env file

export default defineConfig({
  test: {
    testTimeout: 900000,
    hookTimeout: 900000,
    maxConcurrency: 3,
    reporters: [
      'default',
      TestDriver(),
      ['junit', { outputFile: 'test-report.junit.xml' }]
    ],
    setupFiles: ['testdriverai/vitest/setup', 'testdriverai/vitest/setup-aws'],
  },
});
```

<Note>
  **That's it!** The `setup-aws` hook automatically spawns and terminates instances when `TD_OS=windows` is set. No manual instance management needed.
</Note>

## Step 3: Write Your Tests

Tests should use `context.ip || process.env.TD_IP` for the IP configuration:

```javascript
import { describe, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("My Test", () => {
  it("should run on self-hosted instance", async (context) => {
    const testdriver = TestDriver(context, {
      ip: context.ip || process.env.TD_IP,
    });

    await testdriver.provision.chrome({ url: "https://example.com" });
    // ... your test steps
  });
});
```

<Note>
  **How it works**: When `TD_OS=windows` with AWS credentials, `context.ip` is automatically set by the setup hook. When running without AWS setup (cloud-hosted), both are undefined and TestDriver uses the cloud. When `TD_IP` is provided manually, it takes precedence.
</Note>

## Step 4: Run Tests

### Locally

```bash
TD_OS=windows \
AWS_REGION=us-east-2 \
AWS_LAUNCH_TEMPLATE_ID=lt-xxx \
AMI_ID=ami-0504bf50fad62f312 \
npx vitest run
```

<Note>
  Each test gets its own fresh EC2 instance that's automatically terminated after completion.
</Note>

### In GitHub Actions

Automate testing with self-hosted instances in your CI/CD pipeline. TestDriver automatically spawns a fresh instance for each test, runs the test, and terminates the instance.

```yaml .github/workflows/test.yml
name: TestDriver Self-Hosted Windows Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Windows tests with self-hosted instances
        run: npx vitest run examples/*.test.mjs
        env:
          TD_API_KEY: ${{ secrets.TD_API_KEY }}
          TD_OS: windows
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-2
          AWS_LAUNCH_TEMPLATE_ID: ${{ secrets.AWS_LAUNCH_TEMPLATE_ID }}
          AMI_ID: ${{ secrets.AMI_ID }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-report.junit.xml
```

<Note>
  **Automatic Instance Management**: Setting `TD_OS=windows` with AWS credentials enables automatic instance spawning. Each test gets its own fresh instance that's terminated after the test completes.
</Note>

### Required GitHub Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG...` |
| `AWS_REGION` | AWS region | `us-east-2` |
| `AWS_LAUNCH_TEMPLATE_ID` | From CloudFormation output | `lt-07c53ce8349b958d1` |
| `AMI_ID` | TestDriver AMI ID | `ami-0504bf50fad62f312` |
| `TD_API_KEY` | Your TestDriver API key | From [console.testdriver.ai](https://console.testdriver.ai) |

<Tip>
  Add these as **GitHub Repository Secrets** under Settings → Secrets and variables → Actions
</Tip>

### Example Workflows

For complete production examples, see:
- **[Scheduled Tests](https://github.com/testdriverai/testdriverai/blob/main/.github/workflows/acceptance-windows-scheduled.yaml)** — Daily automated test runs
- **[Reusable Workflow](https://github.com/testdriverai/testdriverai/blob/main/.github/workflows/windows-self-hosted.yaml)** — Shared configuration for PR and scheduled tests

## Advanced Usage

### Using an Existing Instance

If you already have a running instance, you can skip automatic spawning by providing `TD_IP`:

```bash
TD_OS=windows TD_IP=1.2.3.4 npx vitest run
```

The `setup-aws` hook will detect `TD_IP` is already set and skip spawning a new instance.

### Manual Instance Management

For advanced use cases, you can manually spawn instances using the [`spawn-runner.sh`](https://github.com/testdriverai/testdriverai/blob/main/setup/aws/spawn-runner.sh) script:

```bash
AWS_REGION=us-east-2 \
AMI_ID=ami-0504bf50fad62f312 \
AWS_LAUNCH_TEMPLATE_ID=lt-xxx \
bash setup/aws/spawn-runner.sh
```

Output:
```
PUBLIC_IP=1.2.3.4
INSTANCE_ID=i-1234567890abcdef0
AWS_REGION=us-east-2
```

Then manually terminate when done:

```bash
aws ec2 terminate-instances \
  --instance-ids i-1234567890abcdef0 \
  --region us-east-2
```

For complete production examples, see:
- **[Scheduled Tests](https://github.com/testdriverai/testdriverai/blob/main/.github/workflows/acceptance-windows-scheduled.yaml)** — Daily automated test runs
- **[Reusable Workflow](https://github.com/testdriverai/testdriverai/blob/main/.github/workflows/windows-self-hosted.yaml)** — Shared configuration for PR and scheduled tests

### Connecting to an Instance

You can connect to running instances via:
- **RDP** — Use the public IP on port 3389
- **VNC** — Access via web browser at `http://<public-ip>:5900`
- **AWS Console** — Use EC2 Instance Connect or Session Manager

<Note>
  Stopped instances retain their EBS volumes and can be restarted later. Terminated instances are permanently deleted. Always terminate instances when done to avoid storage costs.
</Note>

## AMI Customization

The TestDriver Golden Image comes pre-configured with:

- Windows Server with desktop environment
- VNC + web server for remote access
- Python, Node.js, Git
- TestDriver agent and dependencies

### Creating a Custom AMI

You can customize the AMI to include additional software or configurations:

<Steps>
  <Step title="Connect via RDP">
    Use the default credentials:
    - **Username**: `testdriver`
    - **Password**: `changemeABC123`
  </Step>
  
  <Step title="Change the Password">
    **Critical**: Run the password rotation script immediately:
    ```powershell
    C:\testdriver\RotateLocalPasswords.ps1
    ```
    Save the new password securely.
  </Step>
  
  <Step title="Install Your Software">
    Install any additional dependencies, configure settings, or modify the environment as needed.
  </Step>
  
  <Step title="Create New AMI">
    Use the AWS console or CLI to create an AMI from your modified instance. Update your workflow to use the new AMI ID.
  </Step>
</Steps>

<Warning>
  **Security**: Never use the default password in production. Always rotate passwords before creating custom AMIs.
</Warning>

## Security Best Practices

### Network Security

- **Restrict CIDR blocks** — Only allow access from known IP ranges
- **Use VPC endpoints** — For private AWS service communication
- **Enable VPC Flow Logs** — For network monitoring

### AWS Authentication

Use OIDC instead of long-term credentials for GitHub Actions:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
      aws-region: us-east-2
```

See [GitHub's OIDC documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect) for setup instructions.

### Instance Security

- **Terminate immediately** after tests complete
- **Monitor costs** with AWS billing alerts
- **Use least-privilege IAM roles**
- **Enable CloudTrail** for audit logging

## Troubleshooting

### Instance Not Responding

- **Check security groups** — Verify required ports are open (RDP 3389, VNC 5900, TestDriver ports)
- **Verify status checks** — Ensure instance has passed AWS status checks
- **Check AMI compatibility** — Some instance types don't support certain AMIs

### Connection Timeouts

- Verify network connectivity from CI runner to instance
- Check VPC routing and internet gateway configuration
- Confirm instance is in the correct subnet

### AWS CLI Errors

- Validate credentials and permissions
- Check service quotas and limits
- Verify region consistency across all resources
