export type Style = 'concise' | 'friendly';

export interface ResponderInput {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  modelName: string;
  maxTokens?: number;
  variables: { customerName: string; plan: string; company: string; product: string };
  userMessage: string;
  seed?: string;
}

export interface ResponderResult {
  text: string;
  latencyMs: number;
  tokens: { input: number; output: number; total: number };
  style: Style;
  topic: Topic;
}

type Topic = 'billing' | 'login' | 'limits' | 'export' | 'cancel' | 'general';

const FAST_MODEL = /mini|haiku|flash|nano|small|lite|instant|8b|3b/i;

export function styleOf(systemPrompt: string): Style {
  if (/\bconcise\b|short sentences|\bterse\b|\bbrief\b/i.test(systemPrompt)) return 'concise';
  if (/\bwarm\b|\bthorough\b|numbered steps|\bgreet\b|\bfriendly\b/i.test(systemPrompt)) return 'friendly';
  return 'concise';
}

export function topicOf(message: string): Topic {
  const m = message.toLowerCase();
  if (/invoice|bill|charge|receipt|payment|price|refund/.test(m)) return 'billing';
  if (/password|log ?in|sign ?in|2fa|locked/.test(m)) return 'login';
  if (/rate limit|limit|quota|429|throttl/.test(m)) return 'limits';
  if (/export|csv|download|spreadsheet/.test(m)) return 'export';
  if (/cancel|delete my account|close my account|downgrade/.test(m)) return 'cancel';
  return 'general';
}

const ANSWERS: Record<Topic, Record<Style, (v: ResponderInput['variables']) => string>> = {
  billing: {
    concise: (v) => `Invoices are under Settings → Billing → Invoices. An account manager will follow up on anything else about your ${v.plan} plan.`,
    friendly: (v) =>
      `Hi ${v.customerName}! Happy to help with billing. Here's where to find it:\n1. Open Settings → Billing.\n2. Pick the Invoices tab; every invoice is there as a PDF.\n3. Need a change? Reply here and an account manager will follow up within one business day.\nTip for the ${v.plan} plan: you can add a billing contact so invoices go straight to finance. Did that solve it?`,
  },
  login: {
    concise: (v) => `Use "Forgot password" on the sign-in page; the reset link is valid for 30 minutes. ${v.plan === 'enterprise' ? 'SSO users should sign in through their identity provider.' : ''}`.trim(),
    friendly: (v) =>
      `Hi ${v.customerName}, sorry you're locked out - let's fix that.\n1. On the sign-in page choose "Forgot password".\n2. Open the reset email (check spam; the link lasts 30 minutes).\n3. Set a new password and sign back in.\nTip for the ${v.plan} plan: ${v.plan === 'enterprise' ? 'SSO is available, so your team never needs passwords here.' : 'turn on two-factor auth under Settings → Security.'} Did that solve it?`,
  },
  limits: {
    concise: (v) => `${v.plan === 'free' ? 'Free' : v.plan[0].toUpperCase() + v.plan.slice(1)} plans allow ${limitFor(v.plan)} API calls per minute; a 429 means you hit it. Spread requests or upgrade to raise it.`,
    friendly: (v) =>
      `Hi ${v.customerName}! Here's how rate limits work in ${v.product}:\n1. Your ${v.plan} plan allows ${limitFor(v.plan)} API calls per minute per workspace.\n2. A 429 response means a burst went over; the Retry-After header says how long to wait.\n3. Batch endpoints count as one call, so they are the easiest way to stay under.\nTip for the ${v.plan} plan: ${v.plan === 'enterprise' ? 'custom limits are available through your account team.' : 'the next plan up raises the limit tenfold.'} Did that solve it?`,
  },
  export: {
    concise: () => `Open any report and click Export CSV (top right). Exports include the current filters and date range.`,
    friendly: (v) =>
      `Hi ${v.customerName}, exporting is quick:\n1. Open the report you want.\n2. Set the date range and filters.\n3. Click Export CSV in the top-right corner; the file downloads immediately.\nTip for the ${v.plan} plan: ${v.plan === 'free' ? 'exports cover the last 30 days; Pro extends that to a year.' : 'scheduled exports can email the CSV to your team every Monday.'} Did that solve it?`,
  },
  cancel: {
    concise: (v) => `Downgrade or cancel under Settings → Billing → Plan. ${v.plan === 'free' ? 'Free workspaces can simply be deleted there.' : 'Your data stays readable until the end of the billing period.'}`,
    friendly: (v) =>
      `Hi ${v.customerName}, sorry to hear that - here's how to change your plan:\n1. Open Settings → Billing → Plan.\n2. Choose Downgrade or Cancel and confirm.\n3. ${v.plan === 'free' ? 'You can delete the workspace on the same page.' : 'You keep access until the end of the current billing period.'}\nIf something isn't working for ${v.company}, tell me and I'll make sure the right person hears it. Did that solve it?`,
  },
  general: {
    concise: (v) => `I can help with billing, sign-in, API limits, exports and plan changes for ${v.product}. Which one is it?`,
    friendly: (v) =>
      `Hi ${v.customerName}! I'm the ${v.product} assistant for ${v.company}. I can help with:\n1. Billing and invoices\n2. Signing in and passwords\n3. API rate limits\n4. Exporting reports\nTip for the ${v.plan} plan: the Insights dashboard shows which teams drive your usage. What can I do for you?`,
  },
};

function limitFor(plan: string): string {
  return plan === 'enterprise' ? '10,000' : plan === 'pro' ? '1,000' : '100';
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

const tokensOf = (text: string): number => Math.max(1, Math.round(text.length / 4));

export function respond(input: ResponderInput): ResponderResult {
  const systemPrompt = input.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const style = styleOf(systemPrompt);
  const topic = topicOf(input.userMessage);

  let text = ANSWERS[topic][style](input.variables);
  const maxTokens = typeof input.maxTokens === 'number' && input.maxTokens > 0 ? input.maxTokens : 400;
  if (tokensOf(text) > maxTokens) text = `${text.slice(0, maxTokens * 4 - 1).trimEnd()}…`;

  const inputTokens = tokensOf(input.messages.map((m) => m.content).join('\n') + input.userMessage);
  const outputTokens = tokensOf(text);
  const fast = FAST_MODEL.test(input.modelName);
  const jitter = hash(input.seed ?? `${input.userMessage}:${input.modelName}`);
  const base = fast ? 250 + jitter * 200 : 1100 + jitter * 700;
  const latencyMs = Math.round(base + outputTokens * (fast ? 1.5 : 6));

  return { text, latencyMs, tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens }, style, topic };
}
