/**
 * Part 4: the support assistant, driven by a LaunchDarkly AI Config.
 *
 * The AI Config `support-assistant` holds the model and the prompt. The
 * product manager edits either in LaunchDarkly; the next request picks up the
 * change with no deploy. Each generation is measured through the SDK's
 * tracker (duration, tokens, success, later feedback), which is what powers the
 * config's Monitoring tab and any experiment on its variations.
 */
import type { LDContext } from '@launchdarkly/node-server-sdk';
import {
  initAi,
  LDFeedbackKind,
  type LDAIAgentConfigDefault,
  type LDAICompletionConfig,
  type LDAICompletionConfigDefault,
  type LDAIConfigTracker,
  type LDMessage,
} from '@launchdarkly/server-sdk-ai';
import { FLAG_KEYS, ldClient } from '../ld.js';
import { respond, type Style } from './localResponder.js';

export const aiClient = initAi(ldClient);

export const AI_CONFIG_KEY = FLAG_KEYS.SUPPORT_ASSISTANT;

/**
 * Used only when LaunchDarkly cannot serve the config (missing key, SDK not
 * initialized). When the config exists but is toggled *off*, LaunchDarkly
 * serves its own "disabled" variation and `enabled` is false; this default is
 * not consulted.
 */
export const SUPPORT_ASSISTANT_DEFAULT: LDAICompletionConfigDefault = {
  enabled: true,
  model: { name: 'local-fallback-mini', parameters: { temperature: 0.2, max_tokens: 120 } },
  provider: { name: 'local' },
  messages: [
    {
      role: 'system',
      content:
        'You are the {{product}} support assistant for {{company}}. The customer is {{customerName}} on the {{plan}} plan. Be concise: answer in at most two short sentences.',
    },
  ],
};

/**
 * The same default for an *agent*-mode config: LaunchDarkly's "Agent" config
 * type carries a single `instructions` string instead of `messages`. The app
 * accepts either type (see servedConfigFor) so the PM can pick whichever the
 * UI offers; the instructions become the system prompt.
 */
export const SUPPORT_ASSISTANT_AGENT_DEFAULT: LDAIAgentConfigDefault = {
  enabled: SUPPORT_ASSISTANT_DEFAULT.enabled,
  model: SUPPORT_ASSISTANT_DEFAULT.model,
  provider: SUPPORT_ASSISTANT_DEFAULT.provider,
  instructions: SUPPORT_ASSISTANT_DEFAULT.messages?.[0]?.content,
};

export interface AssistantVariables {
  customerName: string;
  plan: string;
  company: string;
  product: string;
}

/** Pull the prompt variables out of a single- or multi-context. */
export function variablesFor(context: LDContext): AssistantVariables {
  const c = context as Record<string, unknown>;
  const user = (c.kind === 'multi' ? (c.user as Record<string, unknown> | undefined) : c) ?? {};
  const org = c.kind === 'multi' ? (c.organization as Record<string, unknown> | undefined) : undefined;
  const name = typeof user.name === 'string' && user.anonymous !== true ? user.name.split(' ')[0] : 'there';
  return {
    customerName: name,
    plan: typeof org?.plan === 'string' ? org.plan : 'free',
    company: typeof org?.name === 'string' ? org.name : 'your team',
    product: 'ABC Analytics',
  };
}

export interface ServedConfig {
  key: string;
  enabled: boolean;
  variationKey: string;
  version: number;
  model: { name: string; parameters?: Record<string, unknown> } | null;
  provider: string | null;
  messages: LDMessage[];
  /** True when the SDK fell back to SUPPORT_ASSISTANT_DEFAULT (config missing or unreachable). */
  fallback: boolean;
}

export interface SupportTurn {
  enabled: boolean;
  served: ServedConfig;
  reply?: string;
  style?: Style;
  metrics?: { durationMs: number; tokens: { input: number; output: number; total: number } };
  resumptionToken?: string;
  tracker?: LDAIConfigTracker;
}

/**
 * Evaluate the AI Config for a visitor (no generation).
 *
 * LaunchDarkly AI Configs come in modes. A *completion* config holds
 * `messages`; an *agent* config holds `instructions`. The SDK refuses a
 * mode mismatch, so peek at the served variation's `_ldMeta.mode` and call
 * the matching method; an agent's instructions are presented as the system
 * message so the rest of the app (and the responder) see one shape.
 */
export async function servedConfigFor(context: LDContext): Promise<{ served: ServedConfig; config: LDAICompletionConfig }> {
  const variables = { ...variablesFor(context) };
  const raw = (await ldClient.jsonVariation(AI_CONFIG_KEY, context, null)) as { _ldMeta?: { mode?: string } } | null;
  const mode = raw?._ldMeta?.mode ?? 'completion';

  let config: LDAICompletionConfig;
  if (mode === 'agent') {
    const agent = await aiClient.agentConfig(AI_CONFIG_KEY, context, SUPPORT_ASSISTANT_AGENT_DEFAULT, variables);
    config = {
      key: agent.key,
      enabled: agent.enabled,
      model: agent.model,
      provider: agent.provider,
      messages: agent.instructions ? [{ role: 'system', content: agent.instructions }] : [],
      createTracker: agent.createTracker,
    };
  } else {
    config = await aiClient.completionConfig(AI_CONFIG_KEY, context, SUPPORT_ASSISTANT_DEFAULT, variables);
  }

  const track = config.createTracker().getTrackData();
  return {
    config,
    served: {
      key: config.key,
      enabled: config.enabled,
      variationKey: track.variationKey,
      version: track.version,
      model: config.model ? { name: config.model.name, parameters: config.model.parameters } : null,
      provider: config.provider?.name ?? null,
      messages: config.messages ?? [],
      fallback: track.variationKey === '',
    },
  };
}

/**
 * One chat turn: fetch the config for this visitor, generate a reply, and
 * record the generation's metrics on a fresh tracker.
 */
export async function runSupportTurn(context: LDContext, message: string, opts: { simulate?: boolean; seed?: string } = {}): Promise<SupportTurn> {
  const { served, config } = await servedConfigFor(context);
  if (!config.enabled) return { enabled: false, served };

  const tracker = config.createTracker();
  try {
    const result = respond({
      messages: config.messages ?? [],
      modelName: config.model?.name ?? 'unknown',
      maxTokens: typeof config.model?.parameters?.max_tokens === 'number' ? config.model.parameters.max_tokens : undefined,
      variables: variablesFor(context),
      userMessage: message,
      seed: opts.seed,
    });
    // A real provider call would sit here; the simulator skips the wait.
    if (!opts.simulate) await new Promise((r) => setTimeout(r, result.latencyMs));

    tracker.trackDuration(result.latencyMs);
    tracker.trackTokens(result.tokens);
    tracker.trackSuccess();

    return {
      enabled: true,
      served,
      reply: result.text,
      style: result.style,
      metrics: { durationMs: result.latencyMs, tokens: result.tokens },
      resumptionToken: tracker.resumptionToken,
      tracker,
    };
  } catch (err) {
    tracker.trackError();
    throw err;
  }
}

/** Deferred feedback: rebuild the tracker from the token the reply carried. */
export function recordFeedback(context: LDContext, resumptionToken: string, kind: 'positive' | 'negative'): ReturnType<LDAIConfigTracker['getTrackData']> {
  const tracker = aiClient.createTracker(resumptionToken, context);
  tracker.trackFeedback({ kind: kind === 'positive' ? LDFeedbackKind.Positive : LDFeedbackKind.Negative });
  return tracker.getTrackData();
}
