# earshot

My audiobook year — pulled **automatically** from Audible, then turned into a public,
copyright-safe retrospective (titles, authors, narrators, runtime, series, finished
status — never book text or audio).

> Working name / early days. Right now this repo proves out the one thing that has to
> work first: **automatically getting my listening data out of Audible.**

## How the data gets out

Audible has no public API, and scripted browser logins to Amazon are a CAPTCHA/2FA
trap. So instead of logging in every run, we authenticate **once** and reuse a
long-lived device token:

1. **One-time, local:** `pnpm setup:auth` logs into Audible (you clear any CAPTCHA/OTP
   at the keyboard), exports your library, and pushes the resulting **device token** to
   GitHub as the `AUDIBLE_CONFIG` secret. Your Amazon password never leaves your machine.
2. **Recurring, hands-off:** a scheduled GitHub Action restores that token and runs
   `pnpm pull` — no browser, no re-login. It only pings you (via a GitHub issue/email)
   on the rare occasion the token actually needs refreshing.

Uses [`audible-cli`](https://github.com/mkb79/audible-cli) under the hood — the mature,
open-source Audible client. It's a Python tool; that's the only non-JS dependency.

## Setup (one time)

```bash
pipx install audible-cli   # the Audible client (Python)
gh auth login              # if you haven't already
pnpm setup:auth            # log in, export, store the token as a GH secret
```

Then look at `data/library.json` (gitignored) to see exactly what fields Audible gives us.

## What's safe to publish

Facts about **my own** listening — titles, authors, narrators, runtimes, series,
finished/progress, my own stats. Never book text, audio, or transcripts.
