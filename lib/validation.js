const types = () =>
  import("arktype").then(({ scope }) =>
    scope({
      // - command: press-keys # Types a keyboard combination. Repeat the command to repeat the keypress.
      //   keys: [command, space]
      PressKeysCommand: {
        command: '"press-keys"',
        keys: "string[]",
      },
      // - command: hover-text # Hovers text matching the \`description\`. The text must be visible. This will also handle clicking or right clicking on the text if required.
      //   text: Sign Up # The text to find on screen. The longer and more unique the better.
      //   description: registration in the top right of the header # Describe the element so it can be identified in the future. Do not include the text itself here. Make sure to include the unique traits of this element.
      //   action: click # What to do when text is found. Available actions are: click, right-click, double-click, hover
      //   method: ai # Optional. Only try this if text match is not working.
      HoverTextCommand: {
        command: '"hover-text"',
        text: "string",
        description: "string",
        action: '"click" | "right-click" | "double-click" | "hover"',
        "method?": '"ai"',
      },
      // - command: type # Types the string into the active application. You must focus the correct field before typing.
      //   text: Hello World
      TypeCommand: {
        command: '"type"',
        text: "string",
      },
      // - command: wait # Waits a number of miliseconds before continuing.
      //   timeout: 5000
      WaitCommand: {
        command: '"wait"',
        timeout: "number",
      },
      // - command: hover-image # Hovers an icon, button, or image matching \`description\`. This will also handle handle clicking or right clicking on the icon or image if required.
      //   description: search icon in the webpage content # Describe the icon or image and what it represents. Describe the element so it can be identified in the future. Do not include the image or icon itself here. Make sure to include the unique traits of this element.
      //   action: click # What to do when text is found. Available actions are: click, right-click, double-click, hover
      HoverImageCommand: {
        command: '"hover-image"',
        description: "string",
        action: '"click" | "right-click" | "double-click" | "hover"',
      },
      // - command: focus-application # Focus an application by name.
      //   name: Google Chrome # The name of the application to focus.
      FocusApplicationCommand: {
        command: '"focus-application"',
        name: "string",
      },
      // - command: remember # Remember a string value without needing to interact with the desktop.
      //   description: My dog's name # The key of the memory value to store.
      //   value: Roofus # The value of the memory to store
      RememberCommand: {
        command: '"remember"',
        description: "string",
        value: "string",
      },
      // - command: get-email-url # Retrieves the URL from a sign-up confirmation email in the background.
      //   # This retrieves an email confirmation URL without opening an email client. Do not view the screen, just run this command when dealing with emails
      //   username: testdriver # The username of the email address to check.
      GetEmailUrlCommand: {
        command: '"get-email-url"',
        username: "string",
      },
      // - command: scroll # Scroll up or down. Make sure the correct portion of the page is focused before scrolling.
      //   direction: down # Available directions are: up, down, left, right
      //   method: keyboard # Optional. Available methods are: keyboard (default), mouse. Use mouse only if the prompt explicitly asks for it.
      //   amount: 300 # Optional. The amount of pixels to scroll. Defaults to 300 for keyboard and 200 for mouse.
      ScrollCommand: {
        command: '"scroll"',
        direction: '"up" | "down" | "left" | "right"',
        "method?": '"keyboard" | "mouse"',
        "amount?": "number",
      },
      // - command: scroll-until-text # Scroll until text is found
      //   text: Sign Up # The text to find on screen. The longer and more unique the better.
      //   direction: down # Available directions are: up, down, left, right
      //   method: keyboard # Optional. Available methods are: keyboard (default), mouse. Use mouse only if the prompt explicitly asks for it.
      ScrollUntilTextCommand: {
        command: '"scroll-until-text"',
        text: "string",
        direction: '"up" | "down" | "left" | "right"',
        "method?": '"keyboard" | "mouse"',
      },
      // - command: scroll-until-image # Scroll until icon or image is found
      //   description: Submit at the bottom of the form
      //   direction: down # Available directions are: up, down, left, rights
      //   method: keyboard # Optional. Available methods are: keyboard (default), mouse. Use mouse only if the prompt explicitly asks for it.
      ScrollUntilImageCommand: {
        command: '"scroll-until-image"',
        description: "string",
        direction: '"up" | "down" | "left" | "right"',
        "method?": '"keyboard" | "mouse"',
      },
      // - command: wait-for-text # Wait until text is seen on screen. Not recommended unless explicitly requested by user.
      //   text: Copyright 2024 # The text to find on screen.
      WaitForTextCommand: {
        command: '"wait-for-text"',
        text: "string",
      },
      // - command: wait-for-image # Wait until icon or image is seen on screen. Not recommended unless explicitly requested by user.
      //   description: trash icon
      WaitForImageCommand: {
        command: '"wait-for-image"',
        description: "string",
      },
      // - command: assert # Assert that a condition is true. This is used to validate that a task was successful. Only use this when the user asks to "assert", "check," or "make sure" of something.
      //   expect: the video is playing # The condition to check. This should be a string that describes what you see on screen.
      AssertCommand: {
        command: '"assert"',
        expect: "string",
      },
      // - command: if # Conditional block. If the condition is true, run the commands in the block. Otherwise, run the commands in the else block. Only use this if the user explicitly asks for a condition.
      //   condition: the active window is "Google Chrome"
      //   then:
      //     - command: hover-text
      //       text: Search Google or type a URL
      //       description: main google search
      //       action: click
      //     - command: type
      //       text: monster trucks
      //       description: search for monster trucks
      //   else:
      //     - command: focus-application
      //       name: Google Chrome
      IfCommand: {
        command: '"if"',
        condition: "string",
        // The unknown[] instead of Command[] is because of a weird error, although it does work
        // on the other typescript repo
        then: "unknown[]",
        "else?": "unknown[]",
      },

      Command:
        "PressKeysCommand | HoverTextCommand | TypeCommand | WaitCommand | HoverImageCommand | FocusApplicationCommand | RememberCommand | GetEmailUrlCommand | ScrollCommand | ScrollUntilTextCommand | ScrollUntilImageCommand | WaitForTextCommand | WaitForImageCommand | AssertCommand | IfCommand",

      CommandList: "Command[]",

      Step: {
        prompt: "string",
        commands: "Command[]",
      },

      StepList: "Step[]",

      File: {
        version: "string",
        session: "string | undefined",
        steps: "Step[]",
      },
    }).export(),
  );

/**
 *
 * @param {unknown} data
 */
const getType = async (data) => {
  const { type } = await import("arktype");
  const t = await types();

  /**
   * @type {["File", "Step", "StepList", "Command", "CommandList"]}
   */
  const options = ["File", "Step", "StepList", "Command", "CommandList"];

  for (const option of options) {
    const result = t[option](data);
    if (!(result instanceof type.errors)) {
      return option;
    }
  }
  return null;
};

module.exports = { getType };
