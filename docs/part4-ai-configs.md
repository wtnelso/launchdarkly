# Extra credit — AI Configs: walkthrough for reviewers

**Scenario.** ABC Company is rolling out a support chatbot. As the AI product manager you keep
proposing better prompts and want to try cheaper or faster models, but every change used to mean
a code deploy. Now the assistant's **model and prompt live in a LaunchDarkly AI Config**
(`support-assistant`): edit a variation and the next reply uses it; target variations by visitor;
toggle the config off and the assistant steps aside; run an experiment to learn which prompt and
model customers actually prefer.

Select **Part 4 · AI Config** in the top-right picker. The end-user view is ABC Analytics' Help
Center with the assistant; the Admin drawer shows which configuration answered and why.

## What to look for

| Requirement | Where it lives | What you'll see |
| --- | --- | --- |
| AI Config fetched per visitor | `server/src/ai/supportAssistant.ts` → `aiClient.completionConfig('support-assistant', context, SUPPORT_ASSISTANT_DEFAULT, variables)` | The served variation's model, parameters and **rendered** messages (`{{customerName}}`, `{{plan}}`, `{{company}}`, `{{product}}` filled in) in the Admin drawer's *Served configuration* card, plus the evaluation reason. |
| Prompt and model changeable without a deploy | LaunchDarkly → Agents → Configs → `support-assistant` → Variations | Edit the system message or pick another model, **Review and save**, ask again: the reply's tone and latency change immediately. |
| Metrics on every generation | `runSupportTurn()` → `tracker.trackDuration/trackTokens/trackSuccess`; `recordFeedback()` → `trackFeedback` via the **resumption token** | The *Turns* card logs variation, model, ms, tokens and 👍/👎 per reply; LaunchDarkly's Monitoring tab charts Generations, Satisfaction, Time to generate, Tokens and Costs. |
| Kill switch | Toggle the config off in LaunchDarkly | `enabled: false` from the API; the chat shows a quiet "taking a break" banner with a support email. |
| Experiment on prompt/model variants | LaunchDarkly experiment on the config's default rule; Admin → *Simulate conversations* (`POST /api/demo/simulate-chats`) | Hundreds of synthetic conversations with feedback; Results show positive-feedback rate per variation with probability to beat control, completion time and tokens as secondaries. |

## Suggested 3-minute demo

1. **Ask as the Anonymous visitor.** Click *Where is my invoice?*: a two-sentence answer in about
   300 ms. The drawer says which variation and model served it (*Concise (fast model)* via the
   default rule) and shows the rendered prompt. Click 👍: the *Turns* row updates and LaunchDarkly
   records positive feedback for that generation.
2. **Switch to Carla** (enterprise): if you added the enterprise rule she gets *Friendly &
   thorough*: a greeting by name, numbered steps, a plan-specific tip, and a slower "big model".
   Same code, different configuration.
3. **Edit the prompt in LaunchDarkly.** Change the Concise variation's system message to ask for a
   warm, thorough answer, **Review and save**, and ask again as the Anonymous visitor: the style
   flips. No deploy, no restart. (Change it back afterwards.)
4. **Kill switch.** Toggle the config off: the assistant goes offline with a friendly banner. Toggle
   it back on.
5. **Experiment.** Click **Simulate 300 conversations**: the API evaluates the config for 300 random
   visitors, generates replies and rates them (friendly prompts win more 👍). Open the experiment's
   Results tab a few minutes later: *Positive AI feedback rate* per variation, probability to beat
   control, plus the cost of that satisfaction in completion time and tokens. "Friendly wins on
   satisfaction but costs 4× the latency and 3× the tokens - that's the decision a PM gets to make,
   with data."

## Design decisions worth calling out

- **No real LLM, on purpose.** The exercise is about *managing* models and prompts, so the server
  uses a deterministic responder (`server/src/ai/localResponder.ts`) that still honours the config:
  the prompt text decides the style, the model name decides latency, `max_tokens` caps the reply,
  and token counts are estimated. Swapping in a real provider is one function call; the tracker
  code around it does not change.
- **Variables, not string concatenation.** The prompt uses `{{customerName}}`, `{{plan}}`,
  `{{company}}` and `{{product}}`; the SDK renders them (Mustache) from the visitor's context, so
  the PM can move or drop them without touching code.
- **Deferred feedback through the resumption token.** A thumbs up arrives seconds after the
  reply. The reply carries the tracker's `resumptionToken`; `/api/chat/feedback` rebuilds the
  tracker from it so the feedback lands on the same generation (same `runId`). The simulator
  skips the round trip and rates on the in-process tracker.
- **`defaultValue` vs the disabled variation.** The in-code default (`SUPPORT_ASSISTANT_DEFAULT`)
  only applies when LaunchDarkly cannot serve the config (missing key, SDK offline); the drawer
  shows a *Fallback* pill then. When the config is toggled **off**, LaunchDarkly serves its own
  disabled variation and the app shows the banner. Two different failure modes, two different
  behaviours.
- **Once per tracker.** The AI SDK records duration, tokens, success/error and feedback at most
  once per generation, which is why the 👍/👎 buttons lock after a vote.
- **Legacy vs new AI SDK.** This uses `@launchdarkly/server-sdk-ai` 2.x (explicit
  `completionConfig` + tracker, no provider handler required). LaunchDarkly's newer
  `@launchdarkly/ai-server` wires provider calls automatically but needs a real provider handler
  and OpenTelemetry peers, which this key-less demo does not want.

## Screenshots

_Add before submitting:_

- [ ] Help Center with a concise reply and a friendly reply (two personas)
- [ ] Admin drawer: Served configuration (variation, model, reason, rendered prompt) and the Turns log with 👍
- [ ] LaunchDarkly → Agents → Configs → `support-assistant` → Variations and Targeting
- [ ] Monitoring tab: Generations, Satisfaction, Time to generate, Tokens
- [ ] Experiment Results: Positive AI feedback rate per variation with probability to beat control
