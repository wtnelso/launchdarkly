# Part 2 — Target: walkthrough for reviewers

**Scenario.** ABC Company is revamping its landing page. Our team owns the **hero**. With ~40,000
visitors a day we can't ship it to everyone at once, so the new hero sits behind the
`landing-hero-v-2` flag and LaunchDarkly decides, per visitor, who sees it - first a named
colleague, then whole segments defined by attributes.

Select **Part 2 · Target** in the top-right picker.

## What to look for

| Requirement | Where it lives | What you'll see |
| --- | --- | --- |
| Flag around a component | `client/src/scenarios/part2/Part2View.tsx` (`HeroGate` → `useBoolVariation('landing-hero-v-2')`) | Classic hero vs personalized hero; nothing else on the page changes. |
| Context with attributes | `client/src/scenarios/part2/personas.ts` (`contextFor`) | Multi-context `user` (key, name, email, country, role, betaTester) + `organization` (key, name, plan, industry, employees). The Admin drawer's persona picker calls `identify()`. |
| Individual targeting | LaunchDarkly → flag → Targeting → Individual targets | `alice-chen` gets v2 even though no rule matches her; reason `TARGET_MATCH`. |
| Rule-based targeting | Rules on the same flag | Rule 1 `user.betaTester is true` serves Bruno; Rule 2 `organization.plan is enterprise` serves Carla; reasons `RULE_MATCH` with the rule number. The anonymous visitor falls through to the default (`FALLTHROUGH`). |
| Both tiers agree | `server/src/routes/landing.ts` (`boolVariationDetail`) | The Evaluation card shows the browser's and the API's value **and reason** for the same context. |

## Suggested 3-minute demo

1. Visitor = **Anonymous**: "This is what 40,000 people a day see. Classic hero. The API agrees:
   default rule."
2. Switch to **Alice**: "Alice is on our team. She's individually targeted, so she sees v2 before
   anyone else. Reason: individual target. No deploy, no reload."
3. Switch to **Bruno**: "Free plan, but he opted into the beta. Rule 1 matches on a *user* attribute.
   He gets a trial offer and the EU data-residency note because his country is DE."
4. Switch to **Carla**: "Maple Health is an Enterprise customer. Rule 2 matches on the
   *organization's* plan, not the user. Her hero talks to her account team."
5. In LaunchDarkly, switch Rule 1 to serve false (or toggle the flag): "Bruno drops back to classic
   instantly; Alice and Carla are untouched. That's how you ship to 1%, then 10%, then everyone."

## Design decisions worth calling out

- **Multi-context** rather than stuffing company data into the user: rules can target the
  organization (plan, size, industry) independently of the person, which is how B2B rollouts work.
- **Reasons on both tiers.** `variationDetail` exposes *why* a value was served; showing it next to
  the value makes targeting explainable to a stakeholder in one glance.
- **Personas live in the Admin drawer**, so the landing page itself stays exactly what a customer
  would see.
- **Attribute discovery.** LaunchDarkly only offers an attribute in the rule builder after an SDK has
  sent it, so the README tells you to cycle through the personas before configuring rules.

## Screenshots

_Add before submitting:_

- [ ] Anonymous visitor: classic hero, Evaluation card showing Default rule on both tiers
- [ ] Alice: v2 hero, reason Individual target
- [ ] Bruno: v2 hero with Beta badge and EU note, reason Rule 1 (user.betaTester)
- [ ] Carla: v2 hero, reason Rule 2 (organization.plan)
- [ ] LaunchDarkly Targeting tab showing the individual target and the two rules
