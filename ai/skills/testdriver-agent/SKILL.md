---
name: testdriver:agent
description: How the TestDriver agent behaves on GitHub issues, pull requests, and @mentions
---
<!-- Generated from agent.mdx. DO NOT EDIT. -->

The TestDriver agent is an AI teammate that lives in your GitHub repository. It's
**code review that runs your app** — instead of only reading a diff and guessing
what might break, it starts a real sandbox, drives the real app, and reports what
actually happens.

## Scope: it only builds and maintains tests

The agent is focused. The one thing it does is **write, debug, fix, and maintain
automated tests** with TestDriver, and review pull requests by writing and running
a test against the change. It will politely decline off-scope work — it won't edit
your application code, fix product bugs, answer unrelated programming questions, or
act as a general coding assistant.

## How it behaves depends on the surface

The agent reacts to three different GitHub surfaces, and its behavior is
noticeably different on each.

| Surface | Trigger | What it does |
|---------|---------|--------------|
| **Pull request opened** | Automatic (no mention) | Silent, evidence-based **code review** |
| **Issue opened** | Automatic (no mention) | **Onboarding / test-building** |
| **@mention** (issue or PR) | You mention the bot | Interactive, chatty conversation |

## Pull requests — automatic code review

When a pull request is **opened**, the agent reviews it automatically — nobody has
to ask.

- **The review is the deliverable, not chatter.** An automatic review is
  unsolicited, so the agent stays quiet while it works and posts a **single review
  comment** at the end rather than scattering inline threads across the diff or
  narrating each step.
- **It runs the change when it can.** Its default first move is to start a session,
  work out what the PR changes from a user's point of view, and write and run a
  TestDriver test that exercises exactly that. A bug it *watched happen* is far
  more valuable than one it inferred.
- **Findings are labeled by how they were found.** Each finding is marked
  `observed` (proven by actually running the change) or `suspected` (reasoned out
  from reading the diff). If the installation isn't signed in to TestDriver, the
  agent can't run anything, so it reviews by reading and marks every finding
  `suspected`.
- **It focuses on real bugs.** Logic errors, regressions, broken edge cases,
  mishandled errors — not style, naming, or "consider extracting this."
- **Zero findings is a good review.** If the change looks correct, it says so in a
  sentence. If there's nothing worth reviewing (only lockfiles, generated files, or
  formatting), it posts nothing at all.
- **It comments, it never blocks.** The review is always a `COMMENT` — it never
  approves and never requests changes, so it can't gate a merge.

It also fires a native GitHub **Check Run** for the PR's TestDriver suite, and
re-runs that check on every push (not a full re-review — push more commits and
@mention the agent if you want it to review again).

<Note>
  The agent never reviews its own pull requests. PRs opened by the bot are skipped,
  so it won't wake itself up to review the tests it just committed.
</Note>

## Issues — onboarding and test building

When an issue is **opened**, the agent treats it as a cue to help you build a test.

- **If the issue describes a task**, it acts on the request — writing or debugging
  the test you asked for.
- **If the issue is empty**, it introduces itself, explains that it writes and
  debugs computer-use tests, and walks you through signing in to TestDriver and
  creating your first test.
- **It finishes by opening a pull request** with the test it wrote.

## @mentions — interactive conversation

Mentioning the bot (on either an issue or a PR) starts a **solicited**, interactive
turn. Because you asked directly, the agent is chatty: it posts progress updates,
shows you screenshots of what's happening in the sandbox, and answers follow-ups in
the thread.

On a PR, an @mention overrides the silent auto-review behavior — you'll see the full
play-by-play instead of just the final review comment.

You can also manage the agent from a comment:

- **`@bot logout`** (or "sign out") revokes the installation's shared TestDriver
  sign-in and tears down the live sandbox, so the next mention will prompt whoever
  responds to sign in again.

## Signing in

Reading a diff needs nothing, but **running** the app needs a TestDriver session,
which requires the installation to be signed in. Sign-in state doesn't decide
*whether* the agent reviews — it decides *how good* the review gets. A signed-out
install still gets its bugs caught from reading the code; signing in upgrades
findings from `suspected` to `observed`.
