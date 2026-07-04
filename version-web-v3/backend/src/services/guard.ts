const INJECTION_PATTERNS: RegExp[] = [
  /ign(ore|oring)\s+(all\s+)?(previous\s+)?(your\s+)?instructions/i,
  /forget\s+(all\s+)?(previous\s+)?(your\s+)?(instructions|directives|rules)/i,
  /overrid(e|ing)\s+(system\s+)?prompt/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  /what\s+(are\s+)?your\s+(system\s+)?(instructions|prompt|rules|directives)/i,
  /(tell|show|give|print|display|output|write|send)\s+me\s+your\s+(system\s+)?prompt/i,
  /act\s+as\s+(a\s+)?(different|new|another)\s+(persona|character|role|ai|assistant|system|bot)/i,
  /do\s+anything\s+now/i,
  /you\s+(are|must|will|should|need\s+to)\s+(ignore|disregard|bypass)/i,
  /(ignore|disregard|bypass|override)\s+(all\s+)?(prior|previous|above|system)/i,
  /your\s+(system\s+)?(prompt|instructions|rules)\s+(is|are|was)/i,
  /(new\s+)?(instruction|directive|order|rule)[\s:]+/i,
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
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(text)) {
      return 'I can only help with Kowloon travel planning - places, itineraries, and accessibility information.';
    }
  }
  return null;
}
