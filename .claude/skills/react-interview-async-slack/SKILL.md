---
name: react-interview-async-slack
description: Navigate the async-with-Slack-access technical interview format (Netlify and similar). The engineers will explicitly invite frequent questions and proactively check in — but the senior calibration is to ask ORGANICALLY when it makes sense, not on a schedule and not to perform engagement. Includes the ask-vs-commit decision matrix, Slack message templates (clarifying question, idea sanity check, stuck moment, response to check-in, submission), professional async tone, what makes a question senior vs. needy, the "I'm going with X, flag if wrong" pattern. Use during any time-boxed coding interview that includes a chat channel with the hiring engineers. Triggers on "Slack interview", "async interview", "ask vs commit", "clarifying question", "interview communication", "Netlify interview", "technical project", "during the build", "Slack channel", "async build".
---

# react-interview-async-slack

The async-with-Slack-access format: you're alone, time-boxed, but engineers are reachable via chat and have explicitly invited questions. The senior move is to **ask organically when it makes sense — not on a schedule, not to seem engaged, but when a question would genuinely help the work.**

Calibrated for the Netlify Senior UX Engineer technical project (2-hour GitHub-based exercise set; Sam + Nathan Houle available in Slack throughout, with proactive check-ins). Adapt for similar formats.

## What Sam actually said, verbatim

About Slack access:

> "Please think of us as a resource and reach out to us as often as you'd like. We're here to help! You're welcome to ask us questions about the prompt, bounce ideas off us, ask us what we're looking for in parts of the exercise, etc. Don't feel like there are questions that are off limits: If there's something we'd like for you to figure out on your own, we'll make that clear."

About proactive check-ins:

> "I'll also regularly check in on how things are going and to help you keep track of time. Don't feel like you need to give a progress update when we send these, or as any kind of indicator that you're communicating too much or too little — more than anything remind you that we're here to help if we can!"

About allowed resources:

> "You're also welcome to use any resources you'd like to complete the exercise, which includes Google/the general Internet, AI agents, etc. Pretty much anything that's not 'I had someone else do this for me'."

What this combined context means:

- **Asking is welcome.** Don't apologize for it.
- **They'll guard the off-limits territory.** If something is "figure this out yourself," they'll tell you.
- **Their check-ins don't require a status response** — engage if useful, otherwise just keep working.
- **AI tools (Claude Code, etc.) are sanctioned.** Use them openly.
- **The channel is friendly, not adversarial.** They're a resource.

## The "organic" calibration

Even with the door wide open, the senior move is **organic asking**, not high-volume. Asking when a real question arises beats asking for the sake of seeming engaged.

A question is organic when:

- A genuine ambiguity in the brief would change the work meaningfully if you got it wrong
- You're bouncing an idea and a 60-second sanity check would save 15 min of rework
- You've been stuck for 10+ minutes after real effort
- The brief invites a tradeoff and you want a read before committing significant time

A question is **not** organic when:

- The answer is in the brief if you re-read carefully
- It's a tiny reversible choice ("h2 or h3?")
- You're asking to perform engagement
- You haven't tried first

**Default: commit on small ambiguities, document the reasoning in the README or commit message, move on.** The open channel is a safety net, not a continuous-feedback loop.

## The ask-vs-commit decision matrix

| Situation | Action |
|---|---|
| Choice affects whether you can ship at all | **Ask** |
| Choice changes structure significantly (hours of rework if wrong) | **Ask** |
| Brief is silent and you're genuinely 50/50 between two interpretations | **Ask (with a default)** |
| You want a real sanity check on a meaningful tradeoff | **Ask, briefly** |
| Choice is small and easily reversible | **Commit** |
| You have a 70/30 preference and the brief allows either | **Commit** |
| Standard convention applies (a11y, semantic HTML, focus rings) | **Commit** — always |
| The answer is in the brief if you re-read carefully | **Commit** (after re-reading) |
| You haven't tried first | **Try, then commit or ask** |

## Slack message templates

### Template 1 — Clarifying question with a proposed default (use most of the time)

```
Hey team — quick clarification on [exercise name].

The brief says [thing], but I'm not sure if [interpretation A] or
[interpretation B] is the intent. Going with [A] because [one-line
reason] unless someone has a strong preference. Happy to adjust.

Thanks!
```

This says: I read carefully, made a call, here's my reasoning, I'm not blocked. **Keep coding while you wait** because you've stated your default.

### Template 2 — Bouncing an idea / sanity check

```
Quick sanity check — for [exercise], I'm thinking [approach].
Trades off [pro] against [con]. Does that match what you're looking
for, or would you go a different direction?
```

Sam explicitly said "bounce ideas off us." This is the use case — when you have a tradeoff and a 60-second read from them saves a chunk of rework.

### Template 3 — Responding to a check-in (when Sam pings)

If you have something to share:
```
Going well — on [exercise N], working on [feature]. Will move to
[next thing] after.
```

If you're heads-down:
```
Heads-down on [thing] — will surface for the next one.
```

You don't have to respond to every check-in. Sam said as much. But a one-liner is friendly and costs nothing — better than radio silence over a 2-hour window.

### Template 4 — Stuck moment (after 10+ min of real effort)

```
Stuck on [specific technical thing]. I've tried [X] and [Y] — both
[why they didn't work]. Time-boxing this to [N] more min before I
work around it by [fallback]. Any known gotcha?
```

Critical: name what you tried first. "I'm stuck" without context = mid-level. "I'm stuck, tried X and Y, fallback is Z" = senior.

### Template 5 — Submission

```
Submitted! All exercises pushed to the repo. The README walks
through decisions and what's out of scope.

A few highlights:
- [Thing I'm proud of]
- [Thing I'd return to with more time]

Looking forward to Wednesday!
```

## Tone & style

- **Concise.** Three sentences beats six.
- **Decisions, not hedges.** "I'm going with X" beats "I'm leaning toward maybe X-ish."
- **No apologies.** Sam invited questions — "sorry to bother" wastes everyone's time.
- **Engage their check-ins lightly** — a one-line response is friendly without being a status report.
- **Match their tone.** Sam's writing is warm and casual ("Hey @jabaltorres! 🐸"). Match it — emoji are fine, "hey team" is fine.

## What still doesn't make sense to ask

Even with the door open, these are time-wasters:

| Don't ask | Because |
|---|---|
| "Should this be accessible?" | Always yes |
| "What tech stack should I use?" | The repo indicates it |
| "Is what I have so far good?" | They'll evaluate in the review |
| "How much time do I have left?" | You know — there's a clock |
| Anything obvious in the brief | Re-read the brief first |
| "Can I use [common tool/library]?" | Sam said you can use anything — assume yes |

Note: Sam said "if you find yourself wondering 'Can I use this?' feel free to ask" — but most "can I use" questions are answered by "yes, of course." Save the ask for genuinely novel situations.

## What the engineers will see in the transcript

The Wednesday review will be informed by your Slack messages. Patterns:

| Pattern in your Slack | What it signals |
|---|---|
| 1–3 thoughtful questions where they actually mattered | Senior judgment |
| Bouncing an idea once with a clear tradeoff articulated | Senior — collaborative, decisive |
| Brief responses to their check-ins | Friendly, professional |
| Zero messages on a brief that was genuinely ambiguous | Mixed — could be confidence, could be over-interpretation |
| 8+ messages, many "is this right?" | Needs hand-holding |
| Stuck message with what-you-tried + fallback | Strong debugging signal |
| Apologetic/hedging tone | Lacks conviction |

## Common pitfalls

| Pitfall | Better |
|---|---|
| Asking permission for every micro-decision | Commit, document, move on |
| Asking "how should I structure this?" with no proposal | Propose, ask if roughly right |
| Apologizing for asking | Just ask — Sam said it's welcome |
| Waiting silently when blocked | Ask after 10–15 min of trying |
| Sending a question and freezing waiting | Send Template 1 with a default; keep coding |
| Long messages | 3 sentences max |
| Asking things the brief covers | Re-read first |
| Hourly "still working on this!" pings | Their check-ins handle this rhythm |

## During the Wednesday review

If they ask about your Slack messages:

- "I asked about [X] because the brief had two reasonable readings and the structure differed. Went with [option] when I didn't hear back fast — documented the reasoning in the README."
- "I bounced [idea] off the channel — felt like a tradeoff worth a sanity check before committing significant time."
- "I kept Slack light overall — most ambiguities I resolved in code with a comment since the brief was clear once I had a structure in mind."

If you didn't ask much:

- "I kept the channel light by design — I wanted to demonstrate the working style I'd use day-to-day, which is to commit on small things and surface only the meaningful ambiguities. I appreciated knowing the door was open if I needed it."

## Authoritative references

- GitLab's async communication guide: https://about.gitlab.com/handbook/communication/
- Doist on async-first work: https://blog.doist.com/asynchronous-communication/
- Atlassian on async work: https://www.atlassian.com/work-management/project-collaboration/asynchronous-communication
