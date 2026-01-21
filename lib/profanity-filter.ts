const PROFANITY_LIST = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'cunt', 'dick', 'cock', 'pussy',
  'bastard', 'slut', 'whore', 'fag', 'faggot', 'nigger', 'nigga', 'retard',
  'rape', 'rapist', 'pedo', 'pedophile', 'nazi', 'hitler', 'porn', 'sex',
  'penis', 'vagina', 'anus', 'boob', 'tit', 'nude', 'naked', 'hentai',
  'cum', 'jizz', 'sperm', 'dildo', 'vibrator', 'orgasm', 'masturbate',
  'wank', 'handjob', 'blowjob', 'anal', 'oral', 'threesome', 'gangbang',
  'incest', 'bestiality', 'zoophilia', 'necrophilia', 'snuff', 'gore',
  'kike', 'spic', 'chink', 'gook', 'wetback', 'beaner', 'cracker',
  'homo', 'dyke', 'tranny', 'shemale', 'ladyboy', 'hermaphrodite',
  'cocaine', 'heroin', 'meth', 'crack', 'ecstasy', 'lsd', 'weed',
  'marijuana', 'cannabis', 'druggie', 'junkie', 'addict',
  'kill', 'murder', 'suicide', 'terrorist', 'bomb', 'shoot', 'stab',
  'admin', 'moderator', 'mod', 'staff', 'support', 'official', 'gamefolio',
  'system', 'root', 'administrator', 'owner', 'developer', 'dev',
];

const LEET_SPEAK_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '+': 't',
};

function normalizeLeetSpeak(text: string): string {
  let normalized = text.toLowerCase();
  
  for (const [leet, char] of Object.entries(LEET_SPEAK_MAP)) {
    normalized = normalized.split(leet).join(char);
  }
  
  normalized = normalized.replace(/(.)\1+/g, '$1$1');
  
  return normalized;
}

function removeSpecialChars(text: string): string {
  return text.replace(/[_\-\.]/g, '');
}

export function containsProfanity(username: string): { hasProfanity: boolean; reason?: string } {
  const normalized = normalizeLeetSpeak(username);
  const withoutSpecial = removeSpecialChars(normalized);
  
  for (const word of PROFANITY_LIST) {
    if (normalized.includes(word)) {
      console.log('[Profanity] Found profanity in normalized:', word);
      return { hasProfanity: true, reason: 'Username contains inappropriate content' };
    }
    
    if (withoutSpecial.includes(word)) {
      console.log('[Profanity] Found profanity in stripped:', word);
      return { hasProfanity: true, reason: 'Username contains inappropriate content' };
    }
  }
  
  const reservedPatterns = [
    /^admin/i,
    /^mod(erator)?$/i,
    /^staff$/i,
    /^support$/i,
    /^official/i,
    /^gamefolio/i,
    /^system$/i,
    /^root$/i,
  ];
  
  for (const pattern of reservedPatterns) {
    if (pattern.test(username)) {
      console.log('[Profanity] Reserved username pattern matched');
      return { hasProfanity: true, reason: 'This username is reserved' };
    }
  }
  
  return { hasProfanity: false };
}

export function isUsernameAppropriate(username: string): { valid: boolean; message?: string } {
  if (!username || username.length < 3) {
    return { valid: false, message: 'Username must be at least 3 characters' };
  }
  
  if (username.length > 20) {
    return { valid: false, message: 'Username must be 20 characters or less' };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: 'Username can only contain letters, numbers, and underscores' };
  }
  
  if (/^[0-9_]/.test(username)) {
    return { valid: false, message: 'Username must start with a letter' };
  }
  
  const profanityCheck = containsProfanity(username);
  if (profanityCheck.hasProfanity) {
    return { valid: false, message: profanityCheck.reason };
  }
  
  return { valid: true };
}
