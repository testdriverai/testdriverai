---
name: testdriver:ci-cd
description: Run TestDriver tests in CI/CD with parallel execution and cross-platform support
---
<!-- Generated from ci-cd.mdx. DO NOT EDIT. -->

TestDriver integrates seamlessly with popular CI providers, enabling automated end-to-end testing on every push and pull request.

## Adding Your API Key

TestDriver requires an API key to authenticate with the TestDriver cloud. Store this securely as a secret in your CI provider.

<Steps>
  <Step title="Get Your API Key">
    Go to [console.testdriver.ai/team](https://console.testdriver.ai/team) and copy your team's API key
  </Step>
  <Step title="Add Secret to Your CI Provider">
    Add `TD_API_KEY` as a secret environment variable in your CI provider's settings.
  </Step>
</Steps>

<Note>
  Never commit your API key directly in code. Always use your CI provider's secrets management.
</Note>

## CI Provider Examples

<Tabs>
  <Tab title="GitHub Actions">
    ### Adding Secrets
    
    1. Navigate to your GitHub repository
    2. Go to **Settings** → **Secrets and variables** → **Actions**
    3. Click **New repository secret**
    4. Name: `TD_API_KEY`, Value: your API key
    5. Click **Add secret**

    ### Basic Workflow

    Create `.github/workflows/testdriver.yml`:

    ```yaml .github/workflows/testdriver.yml
    name: TestDriver Tests

    on:
      push:
        branches: [main]
      pull_request:
        branches: [main]

    jobs:
      test:
        runs-on: ubuntu-latest
        
        steps:
          - uses: actions/checkout@v4
          
          - uses: actions/setup-node@v4
            with:
              node-version: '20'
              cache: 'npm'
          
          - run: npm ci
          
          - name: Run TestDriver tests
            env:
              TD_API_KEY: ${{ secrets.TD_API_KEY }}
            run: npx vitest --run
    ```

    ### Parallel Execution

    Use matrix strategy to run tests in parallel:

    ```yaml .github/workflows/testdriver-parallel.yml
    name: TestDriver Tests (Parallel)

    on: [push, pull_request]

    jobs:
      test:
        runs-on: ubuntu-latest
        strategy:
          fail-fast: false
          matrix:
            shard: [1, 2, 3, 4]
        
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with:
              node-version: '20'
              cache: 'npm'
          - run: npm ci
          - name: Run tests (shard ${{ matrix.shard }}/4)
            env:
              TD_API_KEY: ${{ secrets.TD_API_KEY }}
            run: npx vitest --run --shard=${{ matrix.shard }}/4
    ```

    ### Multi-Platform Testing

    ```yaml .github/workflows/testdriver-multiplatform.yml
    name: TestDriver Tests (Multi-Platform)

    on: [push, pull_request]

    jobs:
      test:
        runs-on: ubuntu-latest
        strategy:
          fail-fast: false
          matrix:
            td-os: [linux, windows]
        
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with:
              node-version: '20'
              cache: 'npm'
          - run: npm ci
          - name: Run tests on ${{ matrix.td-os }}
            env:
              TD_API_KEY: ${{ secrets.TD_API_KEY }}
              TD_OS: ${{ matrix.td-os }}
            run: npx vitest --run
    ```
  </Tab>

  <Tab title="GitLab CI">
    ### Adding Secrets
    
    1. Go to your GitLab project
    2. Navigate to **Settings** → **CI/CD** → **Variables**
    3. Click **Add variable**
    4. Key: `TD_API_KEY`, Value: your API key
    5. Check **Mask variable** and click **Add variable**

    ### Basic Pipeline

    Create `.gitlab-ci.yml`:

    ```yaml .gitlab-ci.yml
    stages:
      - test

    testdriver:
      stage: test
      image: node:20
      cache:
        paths:
          - node_modules/
      script:
        - npm ci
        - npx vitest --run
      variables:
        TD_API_KEY: $TD_API_KEY
    ```

    ### Parallel Execution

    ```yaml .gitlab-ci.yml
    stages:
      - test

    .testdriver-base:
      stage: test
      image: node:20
      cache:
        paths:
          - node_modules/
      before_script:
        - npm ci
      variables:
        TD_API_KEY: $TD_API_KEY

    testdriver-shard-1:
      extends: .testdriver-base
      script:
        - npx vitest --run --shard=1/4

    testdriver-shard-2:
      extends: .testdriver-base
      script:
        - npx vitest --run --shard=2/4

    testdriver-shard-3:
      extends: .testdriver-base
      script:
        - npx vitest --run --shard=3/4

    testdriver-shard-4:
      extends: .testdriver-base
      script:
        - npx vitest --run --shard=4/4
    ```

    ### Multi-Platform Testing

    ```yaml .gitlab-ci.yml
    stages:
      - test

    .testdriver-base:
      stage: test
      image: node:20
      cache:
        paths:
          - node_modules/
      before_script:
        - npm ci
      variables:
        TD_API_KEY: $TD_API_KEY

    testdriver-linux:
      extends: .testdriver-base
      variables:
        TD_OS: linux
      script:
        - npx vitest --run

    testdriver-windows:
      extends: .testdriver-base
      variables:
        TD_OS: windows
      script:
        - npx vitest --run
    ```
  </Tab>

  <Tab title="CircleCI">
    ### Adding Secrets
    
    1. Go to your CircleCI project
    2. Click **Project Settings** → **Environment Variables**
    3. Click **Add Environment Variable**
    4. Name: `TD_API_KEY`, Value: your API key

    ### Basic Config

    Create `.circleci/config.yml`:

    ```yaml .circleci/config.yml
    version: 2.1

    jobs:
      test:
        docker:
          - image: cimg/node:20.0
        steps:
          - checkout
          - restore_cache:
              keys:
                - npm-deps-{{ checksum "package-lock.json" }}
          - run: npm ci
          - save_cache:
              key: npm-deps-{{ checksum "package-lock.json" }}
              paths:
                - node_modules
          - run:
              name: Run TestDriver tests
              command: npx vitest --run
              environment:
                TD_API_KEY: ${TD_API_KEY}

    workflows:
      test:
        jobs:
          - test
    ```

    ### Parallel Execution

    ```yaml .circleci/config.yml
    version: 2.1

    jobs:
      test:
        docker:
          - image: cimg/node:20.0
        parallelism: 4
        steps:
          - checkout
          - restore_cache:
              keys:
                - npm-deps-{{ checksum "package-lock.json" }}
          - run: npm ci
          - save_cache:
              key: npm-deps-{{ checksum "package-lock.json" }}
              paths:
                - node_modules
          - run:
              name: Run TestDriver tests
              command: |
                npx vitest --run --shard=$((CIRCLE_NODE_INDEX + 1))/$CIRCLE_NODE_TOTAL
              environment:
                TD_API_KEY: ${TD_API_KEY}

    workflows:
      test:
        jobs:
          - test
    ```

    ### Multi-Platform Testing

    ```yaml .circleci/config.yml
    version: 2.1

    jobs:
      test:
        docker:
          - image: cimg/node:20.0
        parameters:
          td-os:
            type: string
        steps:
          - checkout
          - run: npm ci
          - run:
              name: Run TestDriver tests on << parameters.td-os >>
              command: npx vitest --run
              environment:
                TD_API_KEY: ${TD_API_KEY}
                TD_OS: << parameters.td-os >>

    workflows:
      test:
        jobs:
          - test:
              td-os: linux
          - test:
              td-os: windows
    ```
  </Tab>

  <Tab title="Azure Pipelines">
    ### Adding Secrets
    
    1. Go to your Azure DevOps project
    2. Navigate to **Pipelines** → **Library** → **Variable groups**
    3. Create a new variable group or edit existing
    4. Add variable: `TD_API_KEY` with your API key
    5. Click the lock icon to make it secret

    ### Basic Pipeline

    Create `azure-pipelines.yml`:

    ```yaml azure-pipelines.yml
    trigger:
      - main

    pool:
      vmImage: 'ubuntu-latest'

    steps:
      - task: NodeTool@0
        inputs:
          versionSpec: '20.x'
        displayName: 'Setup Node.js'

      - script: npm ci
        displayName: 'Install dependencies'

      - script: npx vitest --run
        displayName: 'Run TestDriver tests'
        env:
          TD_API_KEY: $(TD_API_KEY)
    ```

    ### Parallel Execution

    ```yaml azure-pipelines.yml
    trigger:
      - main

    pool:
      vmImage: 'ubuntu-latest'

    strategy:
      matrix:
        shard1:
          SHARD: '1/4'
        shard2:
          SHARD: '2/4'
        shard3:
          SHARD: '3/4'
        shard4:
          SHARD: '4/4'

    steps:
      - task: NodeTool@0
        inputs:
          versionSpec: '20.x'

      - script: npm ci
        displayName: 'Install dependencies'

      - script: npx vitest --run --shard=$(SHARD)
        displayName: 'Run TestDriver tests'
        env:
          TD_API_KEY: $(TD_API_KEY)
    ```

    ### Multi-Platform Testing

    ```yaml azure-pipelines.yml
    trigger:
      - main

    pool:
      vmImage: 'ubuntu-latest'

    strategy:
      matrix:
        linux:
          TD_OS: 'linux'
        windows:
          TD_OS: 'windows'

    steps:
      - task: NodeTool@0
        inputs:
          versionSpec: '20.x'

      - script: npm ci
        displayName: 'Install dependencies'

      - script: npx vitest --run
        displayName: 'Run TestDriver tests on $(TD_OS)'
        env:
          TD_API_KEY: $(TD_API_KEY)
          TD_OS: $(TD_OS)
    ```
  </Tab>

  <Tab title="Jenkins">
    ### Adding Secrets
    
    1. Go to **Manage Jenkins** → **Credentials**
    2. Select the appropriate domain
    3. Click **Add Credentials**
    4. Kind: **Secret text**
    5. ID: `td-api-key`, Secret: your API key

    ### Basic Pipeline

    Create `Jenkinsfile`:

    ```groovy Jenkinsfile
    pipeline {
        agent {
            docker {
                image 'node:20'
            }
        }
        
        environment {
            TD_API_KEY = credentials('td-api-key')
        }
        
        stages {
            stage('Install') {
                steps {
                    sh 'npm ci'
                }
            }
            
            stage('Test') {
                steps {
                    sh 'npx vitest --run'
                }
            }
        }
    }
    ```

    ### Parallel Execution

    ```groovy Jenkinsfile
    pipeline {
        agent none
        
        environment {
            TD_API_KEY = credentials('td-api-key')
        }
        
        stages {
            stage('Test') {
                parallel {
                    stage('Shard 1') {
                        agent { docker { image 'node:20' } }
                        steps {
                            sh 'npm ci'
                            sh 'npx vitest --run --shard=1/4'
                        }
                    }
                    stage('Shard 2') {
                        agent { docker { image 'node:20' } }
                        steps {
                            sh 'npm ci'
                            sh 'npx vitest --run --shard=2/4'
                        }
                    }
                    stage('Shard 3') {
                        agent { docker { image 'node:20' } }
                        steps {
                            sh 'npm ci'
                            sh 'npx vitest --run --shard=3/4'
                        }
                    }
                    stage('Shard 4') {
                        agent { docker { image 'node:20' } }
                        steps {
                            sh 'npm ci'
                            sh 'npx vitest --run --shard=4/4'
                        }
                    }
                }
            }
        }
    }
    ```

    ### Multi-Platform Testing

    ```groovy Jenkinsfile
    pipeline {
        agent none
        
        environment {
            TD_API_KEY = credentials('td-api-key')
        }
        
        stages {
            stage('Test') {
                parallel {
                    stage('Linux') {
                        agent { docker { image 'node:20' } }
                        environment {
                            TD_OS = 'linux'
                        }
                        steps {
                            sh 'npm ci'
                            sh 'npx vitest --run'
                        }
                    }
                    stage('Windows') {
                        agent { docker { image 'node:20' } }
                        environment {
                            TD_OS = 'windows'
                        }
                        steps {
                            sh 'npm ci'
                            sh 'npx vitest --run'
                        }
                    }
                }
            }
        }
    }
    ```
  </Tab>
</Tabs>

## Reading Platform in Tests

When using multi-platform testing, read the `TD_OS` environment variable in your test:

```javascript tests/cross-platform.test.mjs
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Cross-platform tests", () => {
  it("should work on both Linux and Windows", async (context) => {
    const os = process.env.TD_OS || 'linux';
    
    const testdriver = TestDriver(context, { 
      os: os  // 'linux' or 'windows'
    });
    
    await testdriver.provision.chrome({
      url: 'https://example.com',
    });

    const result = await testdriver.assert("the page loaded successfully");
    expect(result).toBeTruthy();
  });
});
```

## Viewing Results

All test runs are automatically recorded and visible in your TestDriver dashboard at [console.testdriver.ai](https://console.testdriver.ai):

- All test runs with pass/fail status
- Video replays of each test
- Error messages and screenshots on failure
- Git commit and branch information
- Duration trends over time
