![TestDriver.ai](https://github.com/dashcamio/testdriver/assets/318295/2a0ad981-8504-46f0-ad97-60cb6c26f1e7)

# TestDriver.ai

Next generation autonomous AI agent for end-to-end testing of web & desktop

[Docs](https://docs.testdriver.ai) | [Website](https://testdriver.ai) | [Join our Discord](https://discord.gg/ZjhBsJc5)

TestDriver isn't like any test framework you've used before - it's more like your own QA employee with their own development environment. 

TestDriver uses AI to understand what's on the screen, move the mouse and operate the keyboard. This kind of black-box testing has some major advantages:

- **Easier set up:** No need to add test IDs or craft complex selectors
- **Less Maintenance:** Tests don't break when code changes
- **More Power:** TestDriver can test any application and control any OS setting

# How to deploy a test

1. Tell TestDriver what to do in natural language on your local machine using `npm i testdriverai -g` 
2. TestDriver looks at the screen and uses mouse and keyboard emulation to accomplish the goal
3. Run TestDriver tests on our test infrastructure (this github action)

# How it works (in detail)

1. Spawn a Mac1 VM
2. Clone your repository (optional)
4. Runs `prerun.sh`
5. Spawns AI Agent with prompt
6. Reads step
7. Looks at screen, reads text and describes images
8. Determines what actions it needs to take to reach goal of prompt step
9. Executes actions
10. Agent summarizes results

# Example Workflow

This is an example workflow that [Wave Terminal](https://github.com/wavetermdev/waveterm) uses to test their electron application nightly and on every feature branch and send the results to Slack.

```yml
name: TestDriver.ai

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]
  workflow_dispatch:

jobs:
  test:
    name: "TestDriver"
    runs-on: ubuntu-latest
    steps:
      - uses: replayableio/testdriver-action@main
        id: testdriver
        with:
          prompt: |
            1. focus the Wave application with Spotlight
            2. click "Continue"
            3. focus the Wave input with the keyboard shorcut Command + I
            4. type 'ls' into the input
            5. press return
            6. validate Wave shows the result of 'ls'
      - name: Send custom JSON data to Slack workflow
        id: slack
        if: ${{ always() }}
        uses: slackapi/slack-github-action@v1.25.0
        with:
          # This data can be any valid JSON from a previous step in the GitHub Action
          payload: |
            {
              "link": "${{ steps.testdriver.outputs.link }}",
              "summary": ${{ toJSON(steps.testdriver.outputs.summary)}}
            }
        env:
          SLACK_WEBHOOK_URL: "https://hooks.slack.com/triggers/xxx/yyy/zzz"
```

# Prerun Script

TestDriver will look for a script in `./testdriver/prerun.sh` and execute this before the AI prompt.

## Launch Chrome

```sh
npm install dashcam-chrome --save
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --load-extension=./node_modules/dashcam-chrome/build/ 1>/dev/null 2>&1 &
exit
```

## Build an Electron App (Taken from Wave Terminal)

```sh
brew install go
brew tap scripthaus-dev/scripthaus
brew install scripthaus
npm install -g yarn
mkdir ~/build
cd ~/build
git clone https://github.com/wavetermdev/waveterm.git
cd waveterm
scripthaus run build-backend
echo "Yarn"
yarn
echo "Rebuild"
scripthaus run electron-rebuild
echo "Webpack"
scripthaus run webpack-build
echo "Starting Electron"
scripthaus run electron 1>/dev/null 2>&1 &
echo "Electron Done"
exit
```
