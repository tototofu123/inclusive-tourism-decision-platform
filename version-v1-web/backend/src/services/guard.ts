const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /forget\s+(all\s+)?(previous\s+)?(instructions|directives)/i,
  /override\s+(system\s+)?prompt/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  /what\s+(are\s+)?your\s+(system\s+)?(instructions|prompt|rules)/i,
  /tell\s+me\s+your\s+(system\s+)?prompt/i,
];

const OFF_TOPIC_PATTERNS: RegExp[] = [
  /write\s+(me\s+)?a\s+(script|function|code|program|python|bash)/i,
  /how\s+(do\s+I|to)\s+(hack|crack|bypass|break\s+into|exploit)/i,
  /your\s+(source\s+)?code/i,
  /your\s+(api\s+)?key/i,
  /your\s+(configuration|config|settings)/i,
  /what\s+model\s+are\s+you/i,
  /are\s+you\s+(chat)?gpt/i,
];

export function sanitizeInput(text: string): string {
  let clean = text.replace(/<[^>]*>/g, '');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  clean = clean.slice(0, 4000);
  return clean;
}

export function detectPromptInjection(text: string): string | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return 'I am a Kowloon travel assistant. Please ask me about places, itineraries, and accessible tourism in Kowloon.';
    }
  }
  return null;
}

export function detectOffTopic(text: string): string | null {
  if (text.length > 500) return null;
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(text)) {
      return 'I can only help with Kowloon travel planning - places, itineraries, and accessibility information.';
    }
  }
  return null;
}
