---
name: testdriver:cloud
description: The fastest way to get started with TestDriver. Just set your API key and start testing.
---
<!-- Generated from cloud.mdx. DO NOT EDIT. -->

Cloud pricing is based on **device-seconds**: the amount of time your tests run on **our infrastructure**.

- **Zero Setup** — Start testing immediately. No DevOps required.
- **Free Tier** — Get started with a limited preview at no cost.
- **Pay As You Go** — Only pay for the device-seconds you use.

## Get Started
Cloud is the default when you follow the Quickstart guide. 
<Card
  title="Try the Quickstart"  
  icon="play"
  href="/v7/quickstart"
>
  Set your API key and start testing in minutes.
</Card>

## Parallel Testing Limits

Your account has a set number of **license slots** that determine how many devices can run simultaneously. You can view your available slots in the [TestDriver Dashboard](https://console.testdriver.ai).

<Info>
  **When is a slot in use?** A license slot is occupied when a test client is connected. As soon as your device is destroyed the slot becomes available immediately.
</Info>

## Avoiding Slot Conflicts

To prevent tests from failing due to exceeding your license slot limit, we recommend two key configurations:

<AccordionGroup>
  <Accordion title="Set Maximum Concurrency in Vitest">
    Limit concurrent tests to match your available license slots:

    ```javascript vitest.config.mjs
    import { defineConfig } from 'vitest/config';
    import { TestDriver } from 'testdriverai/vitest';

    export default defineConfig({
      test: {
        testTimeout: 900000,
        hookTimeout: 900000,
        maxConcurrency: 5, // Set to your license slot limit
        reporters: ['default', TestDriver()],
        setupFiles: ['testdriverai/vitest/setup'],
      },
    });
    ```

    <Tip>
      Check your slot count at [console.testdriver.ai](https://console.testdriver.ai) and set `maxConcurrency` to that number or lower.
    </Tip>
  </Accordion>

  <Accordion title="Use GitHub Concurrency Keys">
    Prevent multiple workflow runs from competing for the same slots by using [GitHub's concurrency controls](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs):

    ```yaml .github/workflows/test.yml
    name: Tests

    on:
      push:
        branches: [main]
      pull_request:

    # Prevent concurrent runs from competing for license slots
    concurrency:
      group: ${{ github.workflow }}-${{ github.ref }}
      cancel-in-progress: true

    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          
          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version: '20'
          
          - name: Install dependencies
            run: npm install
          
          - name: Run tests
            run: npx vitest run
            env:
              TD_API_KEY: ${{ secrets.TD_API_KEY }}
    ```

    The `concurrency` block ensures:
    - Only one workflow run per branch runs at a time
    - New pushes cancel in-progress runs on the same branch
    - Different branches/PRs can run in parallel (up to your slot limit)
  </Accordion>
</AccordionGroup>

## When to Consider Self-Hosted

Cloud is perfect for getting started and for teams that want zero infrastructure management. However, you might consider [Self-Hosted](/v7/self-hosted) if you:

- Want to escape per-second billing with a flat license fee
- Require greater concurrency than offered in Cloud plans
- Need full control over your infrastructure and privacy
- Want to use your own AI API keys
- Require custom hardware configurations
- Have high test volumes that make self-hosting more economical

<Card
  title="Explore Self-Hosted"
  icon="server"
  href="/v7/self-hosted"
>
  Learn about self-hosting for unlimited test execution at a flat rate.
</Card>
