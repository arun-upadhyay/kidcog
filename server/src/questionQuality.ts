import type { GeneratedQuestion } from './generatedQuestions.js';

const VISUAL_DEPENDENCY = [
  /\b(?:look at|look closely at|see|compare)\s+(?:this|that|the|these|those|two|three|four)\s+(?:picture|pictures|image|images|photo|photos|drawing|drawings)\b/i,
  /\b(?:in|from|on)\s+(?:this|that|the|these|those)\s+(?:picture|pictures|image|images|photo|photos|drawing|drawings)\b/i,
  /\bwhich\s+(?:picture|image|photo|drawing)\b/i,
  /\b(?:picture|image|photo|drawing)\s+(?:above|below|shown|displayed)\b/i,
  /\b(?:shown|pictured|displayed)\s+(?:above|below|here)\b/i,
];

/**
 * True when the wording asks the child to inspect media supplied outside the
 * question. The app cannot satisfy that contract reliably: file questions can
 * show emoji/figures, but they do not carry arbitrary referenced photographs.
 */
export function dependsOnMissingVisual(prompt: string) {
  return VISUAL_DEPENDENCY.some(pattern => pattern.test(prompt));
}

export function visibleEscapes(prompt: string) {
  return /\\[nrt]/.test(prompt);
}

export function validateQuestionContent(q: GeneratedQuestion): string | null {
  if (dependsOnMissingVisual(q.prompt)) return 'prompt refers to a picture or image that the app does not provide';
  if (visibleEscapes(q.prompt)) return 'prompt contains a visible escaped newline or tab';
  return null;
}
