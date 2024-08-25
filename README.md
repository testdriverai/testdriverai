# TestDriver AI Agent


## Workflow

Everything will be saved when SigInt is called

### Editing and naming

```sh
node index.js edit testdriver.yml
node index.js testdriver.yml
```

### Running

```sh
node index.js run testdriver.yml
```

## Internal Commands Docs

### `/summarize`

Writes a summary to `/tmp/oiResult.log` for GitHub and such.

### `/save`

Writes yml instructions from memory to save file

### `/run`

Execute a `/save`

### `/summarize`

Generate a text summary of the test.

### `/quit`

Exits the application.

### `/undo`

Undo the last thing appended to the save file.

### `/manual`

Generates the yml and runs it as if it were created from AI.

`/manual command=click x=10 y=20`
`/manual command=match-image path=sort.png`
`/manual command=wait-for-image path=sort.png seconds=10`
`/manual command=wait-for-text text='see detatils'`
`/manual command=embed file=open.yml`

# Old

## Installation
```sh
npm install
```

### Potential problems

#### Node GYP
FYI robotjs might require extra steps to install, due to `node-gyp`, so you have to:

```sh
brew install python-setuptools
```

or whatever accomplishes the same on your OS distro.

## Running

```
npm run dev
```

## Running as `testdriver`

Run `npm link` and the agent will be available globally as `testdriver`.

```
npm link
testdriver
```
## Example of saving and restoring AI memory

Let's say I want to test the `/save` and `/summarize` call. It would be annoying to wait for an entire test to run to test the function once. Here's how you do it.

So let's say I just ran this test:

```md
> open google chrome
> navigate to youtube.com
> search for 'cat videos'
> click the first one
```

I would call `/savechat` to save the history JSON into the `/.chats` directory.

Then, I can make changes and spawn a new process. At that point I could run `/loadchat` to restore the agent memory 
as if I had never exited the process:

```sh
# load an old chat history to test saving
/loadchat .chats/1713391070500.json
```

That will allow me to test things like `/save` and `/summarize` over and over again without running more tests.

```sh
# save the test plan to markdown
/save
```

## Turning an exploratory test into a regression test

Ok so we've run our test. TestDriver will automatically save a regression to `./saves`. This saved regression will
contain the codeblocks the AI generated and ran in linear order.

Any invalid codeblocks (invalid yml) should not be written here. However, codeblocks that contain spelling errors or invalid paramers
will be written.

Any `yml` block that spawns a subrouteine (at depth 1 or higher) will invoke a REAL ai agent that will make decisions. This is also
an opportunity for it to go off the rails.

So for example, `click-text` does NOT hardcode the x/y coordinates. It is evaluated at run time, the AI is given a screenshot and the
`click-text` process starts from scratch. The AI *should* choose the same text every time, but it may not.

Same for `click-image`. We think that this will be more reliable than x,y coords or sub-image matching, as it allows the AI to adapt to
a changing application. No selectors!
