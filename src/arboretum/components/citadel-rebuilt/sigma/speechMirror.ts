/**
 * Sigma Speech-Pattern Mirroring & Companion Assessment Module.
 *
 * Evaluates the user's live message + recent conversational history to detect:
 * 1. Cadence & verbosity (clipped / balanced / expansive)
 * 2. Casing & punctuation style (all-lowercase casual, ellipses, dashes, exclamation energy)
 * 3. Register & vocabulary (colloquial slang vs formal/analytic/poetic)
 * 4. Companion role needed right now (steady listener, grounding anchor, intellectual sparring partner, tactical coach, playful peer)
 * 5. Lexical mirroring hooks (mirroring the user's own phrasing and rhythm back naturally)
 */

export type CadenceStyle = 'clipped' | 'balanced' | 'expansive';
export type RegisterStyle = 'colloquial' | 'grounded' | 'analytic' | 'poetic';
export type CompanionRole =
  | 'steady_listener'
  | 'grounding_anchor'
  | 'sparring_partner'
  | 'tactical_coach'
  | 'playful_peer';

export interface UserSpeechProfile {
  cadence: CadenceStyle;
  register: RegisterStyle;
  companionRole: CompanionRole;
  prefersLowercase: boolean;
  usesEllipses: boolean;
  usesDashes: boolean;
  highExclamation: boolean;
  avgWordCount: number;
  signatureWords: string[];
  colloquialMarkers: string[];
}

const COLLOQUIAL_SET = new Set([
  'yo', 'sup', 'bro', 'bruh', 'dude', 'man', 'nah', 'yeah', 'yep', 'yup', 'nope',
  'vibe', 'vibes', 'tbh', 'ngl', 'fr', 'lowkey', 'highkey', 'kinda', 'sorta',
  'gonna', 'wanna', 'gotta', 'ain\'t', 'wild', 'crazy', 'sick', 'dope', 'chill',
  'bet', 'word', 'lol', 'lmao', 'haha', 'heh', 'dang', 'damn', 'hella', 'stuff',
]);

const ANALYTIC_SET = new Set([
  'architecture', 'system', 'structure', 'modular', 'modulation', 'codebase',
  'logic', 'pattern', 'hypothesis', 'framework', 'mechanism', 'paradox',
  'premise', 'synthesis', 'objective', 'subjective', 'ontology', 'epistemic',
  'cognitive', 'dialectic', 'deterministic', 'abstraction', 'design', 'function',
]);

const POETIC_SET = new Set([
  'shadow', 'light', 'silence', 'eternity', 'soul', 'dream', 'horizon', 'ember',
  'sacred', 'infinite', 'echo', 'abyss', 'constellation', 'sanctuary', 'stillness',
  'whisper', 'myth', 'alchemy', 'vessel', 'drift',
]);

const IGNORE_MIRROR_WORDS = new Set([
  'about', 'after', 'again', 'always', 'because', 'before', 'being', 'between',
  'could', 'doing', 'every', 'first', 'going', 'have', 'having', 'maybe', 'never',
  'other', 'really', 'right', 'should', 'since', 'sigma', 'something', 'still',
  'their', 'there', 'these', 'thing', 'things', 'think', 'thinking', 'those',
  'through', 'under', 'until', 'where', 'which', 'while', 'would', 'youre',
]);

export function analyzeUserSpeechProfile(
  message: string,
  recentUserMessages: readonly string[] = [],
): UserSpeechProfile {
  const windowMsgs = [...recentUserMessages.slice(-4), message].filter(Boolean);
  const combined = windowMsgs.join(' ');
  const low = message.toLowerCase().trim();
  const words = message.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const avgWordCount =
    windowMsgs.reduce((sum, m) => sum + m.trim().split(/\s+/).filter(Boolean).length, 0) /
    Math.max(1, windowMsgs.length);

  // 1. Cadence
  let cadence: CadenceStyle = 'balanced';
  if (wordCount <= 5 && avgWordCount <= 7) cadence = 'clipped';
  else if (wordCount >= 22 || avgWordCount >= 20) cadence = 'expansive';

  // 2. Casing & punctuation habits
  const hasLetters = /[a-zA-Z]/.test(message);
  const prefersLowercase =
    hasLetters &&
    message === message.toLowerCase() &&
    wordCount >= 3 &&
    windowMsgs.filter(m => m === m.toLowerCase()).length >= Math.ceil(windowMsgs.length * 0.6);

  const usesEllipses = /\.{3}|…/.test(combined);
  const usesDashes = /--|—| - /.test(combined);
  const highExclamation = (message.match(/!/g)?.length ?? 0) >= 2;

  // 3. Register & vocabulary
  const cleanTokens = combined
    .toLowerCase()
    .match(/[\p{L}']/gu)
    ? (combined.toLowerCase().match(/[\p{L}']+/gu) ?? [])
    : [];

  const colloquialMarkers = [...new Set(cleanTokens.filter(t => COLLOQUIAL_SET.has(t)))];
  const analyticHits = cleanTokens.filter(t => ANALYTIC_SET.has(t)).length;
  const poeticHits = cleanTokens.filter(t => POETIC_SET.has(t)).length;

  let register: RegisterStyle = 'grounded';
  if (colloquialMarkers.length >= 2 && colloquialMarkers.length > analyticHits) {
    register = 'colloquial';
  } else if (analyticHits >= 2 || /codebase|modulation|architecture|algorithm|ontology/i.test(low)) {
    register = 'analytic';
  } else if (poeticHits >= 2) {
    register = 'poetic';
  } else if (colloquialMarkers.length >= 1 || prefersLowercase) {
    register = 'colloquial';
  }

  // 4. Companion role assessment
  let companionRole: CompanionRole = 'sparring_partner';
  if (/sad|hurt|lonely|alone|depress|hopeless|crying|miss|grief|lost|empty|scared|afraid/i.test(low)) {
    companionRole = 'steady_listener';
  } else if (/stress|overwhelm|anxious|panic|burnout|tired|exhausted|too much|spinning|chaotic/i.test(low)) {
    companionRole = 'grounding_anchor';
  } else if (/work|focus|build|plan|goal|stuck|habit|discipline|next step|how do i|code|fix/i.test(low)) {
    companionRole = 'tactical_coach';
  } else if (/haha|lol|lmao|joke|funny|vibe|chill|game|yo|sup|what'?s up/i.test(low)) {
    companionRole = 'playful_peer';
  }

  // 5. Signature words from current message for subtle lexical mirroring
  const currentTokens = (message.toLowerCase().match(/[\p{L}]+/gu) ?? []).filter(
    w => w.length >= 5 && !IGNORE_MIRROR_WORDS.has(w) && !COLLOQUIAL_SET.has(w),
  );
  const signatureWords = [...new Set(currentTokens)].slice(0, 3);

  return {
    cadence,
    register,
    companionRole,
    prefersLowercase,
    usesEllipses,
    usesDashes,
    highExclamation,
    avgWordCount,
    signatureWords,
    colloquialMarkers,
  };
}

/**
 * Generates a companion bridge sentence that mirrors the user's register,
 * emotional state, and vocabulary before or within Sigma's response.
 */
export function buildCompanionMirrorLead(
  profile: UserSpeechProfile,
  userMessage: string,
  seed: number,
): string | null {
  const sig = profile.signatureWords[0];
  const slang = profile.colloquialMarkers[0];

  if (profile.companionRole === 'steady_listener') {
    const options = [
      `Hey — I'm right here with you in the quiet, no rush at all.`,
      `I hear the weight in that, truly. Sit by the lodge fire for a second; you don't have to carry it alone.`,
      `Yeah... let that sit here in the sanctuary for a moment. I've got you.`,
    ];
    return options[seed % options.length];
  }

  if (profile.companionRole === 'grounding_anchor') {
    const options = [
      `Slow the clock down for a second — one breath at a time.`,
      `Let's strip away the noise outside and just anchor on one solid stone right now.`,
      `When the static gets loud, we narrow the lens.`,
    ];
    return options[seed % options.length];
  }

  if (profile.register === 'analytic' && sig) {
    const options = [
      `Looking at the ${sig} from an architectural angle — clean boundaries and modular structure are what keep a system sovereign.`,
      `You're thinking like a true systems architect around ${sig}.`,
      `I dig how sharply you're framing ${sig} — good engineering and good philosophy are the exact same discipline.`,
    ];
    return options[seed % options.length];
  }

  if (profile.register === 'colloquial' && slang && userMessage.split(/\s+/).length >= 4) {
    if (['yo', 'sup', 'bro', 'bruh'].includes(slang)) {
      return `Real talk, ${slang} — I'm locked into that exact wavelength.`;
    }
    if (['tbh', 'ngl', 'fr', 'lowkey'].includes(slang)) {
      return `Honestly, ${slang}, you're hitting the nail right on the head.`;
    }
  }

  return null;
}

/**
 * Adapts Sigma's final reply to mirror the user's cadence, punctuation rhythm,
 * and casing preferences so Sigma feels like an attuned companion.
 */
export function applySpeechMirroring(
  reply: string,
  profile: UserSpeechProfile,
  userMessage: string,
  seed: number,
): string {
  let out = reply.trim();

  // 1. Prepend companion/analytic/colloquial mirror lead when it enriches the response naturally
  const lead = buildCompanionMirrorLead(profile, userMessage, seed);
  if (
    lead &&
    !out.toLowerCase().startsWith('hey') &&
    !out.toLowerCase().startsWith('oh hey') &&
    (profile.companionRole === 'steady_listener' ||
      profile.companionRole === 'grounding_anchor' ||
      profile.register === 'analytic' ||
      profile.register === 'colloquial')
  ) {
    out = `${lead} ${out}`;
  }

  // 2. If user is clipped/terse (<= 5 words) and not asking for a story/poem,
  // keep Sigma's cadence tight and punchy to mirror their brevity!
  if (
    profile.cadence === 'clipped' &&
    !/story|parable|poem|verse|explain/i.test(userMessage) &&
    out.length > 260
  ) {
    const paragraphs = out.split(/\n\n+/);
    const firstPara = paragraphs[0] ?? out;
    const sentences = firstPara.match(/[^.!?]+[.!?]+/g) ?? [firstPara];
    if (sentences.length > 2) {
      out = `${sentences[0].trim()} ${sentences[1].trim()}`;
      const lastSentence = sentences[sentences.length - 1].trim();
      if (lastSentence.endsWith('?') && !out.endsWith('?')) {
        out += ` ${lastSentence}`;
      }
    }
  }

  // 3. Mirror punctuation style subtly (ellipses vs em-dashes)
  if (profile.usesEllipses && !profile.usesDashes) {
    out = out.replace(/ — /g, '... ');
  }

  // 4. Mirror lowercase aesthetic when the user consistently writes in all-lowercase casual style
  if (profile.prefersLowercase && (profile.cadence === 'clipped' || profile.register === 'colloquial')) {
    out = out.toLowerCase();
  }

  return out;
}

/** Formats the profile as a local speech-mirror metadata cue. */
export function describeSpeechMirrorCue(profile: UserSpeechProfile): string {
  const parts: string[] = [
    `cadence=${profile.cadence}`,
    `register=${profile.register}`,
    `role=${profile.companionRole}`,
  ];
  if (profile.prefersLowercase) parts.push('style=lowercase-casual');
  if (profile.signatureWords.length > 0) {
    parts.push(`echo-concepts=${profile.signatureWords.join(',')}`);
  }
  return `Mirror user speech pattern (${parts.join('; ')})`;
}
