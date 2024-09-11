![TestDriver.ai](https://github.com/dashcamio/testdriver/assets/318295/2a0ad981-8504-46f0-ad97-60cb6c26f1e7)

# TestDriver.ai

Next generation autonomous AI agent for end-to-end testing of web & desktop

[Docs](https://docs.testdriver.ai) | [Website](https://testdriver.ai) | [GitHub Action](https://github.com/marketplace/actions/testdriver-ai) | [Join our Discord](https://discord.gg/a8Cq739VWn)

----

TestDriver isn't like any test framework you've used before. TestDriver uses AI vision along with mouse and keyboard emulation to control the entire desktop. It's more like a QA employee than a test framework. This kind of black-box testing has some major advantages:

- **Easier set up:** No need to add test IDs or craft complex selectors
- **Less Maintenance:** Tests don't break when code changes
- **More Power:** TestDriver can test any application and control any OS setting

### Demo

https://github.com/user-attachments/assets/fba08020-a751-4d9e-9505-50db541fd38b

# Examples

- Test any user flow on any website in any browser
- Clone, build, and test any desktop app
- Render multiple browser windows and popups like 3rd party auth
- Test `<canvas>`, `<iframe>`,  and `<video>` tags with ease
- Use file selectors to upload files to the browser
- Test chrome extensions
- Test integrations between applications
- Integrates into CI/CD via GitHub Actions ($)

Check out [the docs](https://docs.testdriver.ai/).

# Workflow

1. Tell TestDriver what to do in natural language on your local machine using `npm i testdriverai -g` 
2. TestDriver looks at the screen and uses mouse and keyboard emulation to accomplish the goal
3. Run TestDriver tests on our test infrastructure

# Quickstart

## Install TestDriver via NPM

Install testdriverai via NPM. This will make testdriverai available as a global command.

```sh
npm install testdriverai -g
```

## Set up the project

In the root of the project you want to test, run `testdriverai init`. This will authorize you to communicate with our API and set up example GitHub runner workflows.

```sh
testdriverai init
```

You're almost ready to deploy your first test!

## Teach TestDriver a test

Running testdriverai init creates a sample project that's ready to deploy via GitHub actions! But the test file is blank, so let's show TestDriver what we want to test. Run the following command:

```sh
testdriverai .testdriver/test.yml
```

## Reset the test state

TestDriver best practice is to start instructing TestDriver with your app in it's initial state. For browsers, this means creating a new tab with the website you want to test.

If you have multiple monitors, make sure you do this on your primary display.

> When deploying, the TestDriver GitHub action executes tests on ephemeral VMs. You can use a prerun script to reach this initial state automatically.

## Instruct TestDriver

Now, just tell TestDriver what you want it to do. For now, stick with single commands like "click sign up" and "scroll down." 

Later, try `/explore` to perform higher level objectives like "complete the onboarding." 

```yaml
> Click on sign up
TestDriver Generates a Test
TestDriver will look at your screen and generate a test script. TestDriver can see the screen, control the mouse, keyboard, and more! 
TestDriver can only see your primary display!
To navigate to testdriver.ai, we need to focus on the
Google Chrome application, click on the search bar, type
the URL, and then press Enter.

Here are the steps:

1. Focus on the Google Chrome application.
2. Click on the search bar.
3. Type "testdriver.ai".
4. Press Enter.

Let's start with focusing on the Google Chrome application
and clicking on the search bar.

commands:
  - command: focus-application
    name: Google Chrome
  - command: hover-text
    text: Search Google or type a URL
    description: main google search
    action: click

After this, we will type the URL and press Enter.
```

## TestDriver executes the test script

TestDriver will execute the commands found in the yml codeblocks of the response.

See the yml TestDriver generated? That's our own schema. You can learn more about it in the [reference](https://docs.testdriver.ai/reference/yml-schema).

> Take your hands off the mouse and keyboard while TestDriver executes! TestDriver is not a fan of backseat drivers.

## Keep going!

Feel free to ask TestDriver to perform some more tasks. Every time you prompt TestDriver it will look at your screen and generate more test step to complete your goal.

```sh
> navigate to airbnb.com
> search for destinations in austin tx
> click check in
> select august 8
```

## Save the test

If everything worked perfectly, use the `/save` command to save the test script to the current file. 

If something didn't work, you can use `/undo` to remove all of the test steps added since the last prompt.

## Test the test locally

Now it's time to make sure the test plan works before we deploy it. Use testdriver run to run the test file you just created with /save . 

```sh
testdriverai run testdriver/test.yml
```

Make sure to reset the test state! 

## Deploy

Now it's time to deploy your test using our GitHub action! testdriver init already did the work for you and will start triggering tests once you commit the new files to your repository.

```sh
git add .
git commit -am "Add TestDriver tests"
gh pr create --web
```

Your test will run on every commit and the results will be posted as a Dashcam.io video within your GitHub summary! Learn more about deploying on CI [here](https://docs.testdriver.ai/continuous-integration/overview).

