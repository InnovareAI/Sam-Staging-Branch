// Language Detection Utility for SAM AI
// Detects user language and provides language switching capabilities

export type SupportedLanguage = 
  | 'en' // English
  | 'es' // Spanish  
  | 'fr' // French
  | 'de' // German
  | 'it' // Italian
  | 'pt' // Portuguese
  | 'zh' // Chinese
  | 'ja' // Japanese
  | 'ko' // Korean
  | 'ar' // Arabic
  | 'hi' // Hindi
  | 'ru' // Russian
  | 'nl'; // Dutch

interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  patterns: RegExp[];
  greeting: string;
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    patterns: [/\b(hello|hi|hey|good|morning|afternoon|thanks|please|yes|no)\b/i],
    greeting: "Hi there! I'm Sam, your AI Sales Assistant."
  },
  es: {
    code: 'es', 
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    patterns: [/\b(hola|gracias|sí|no|buenos|días|por favor|¿|ñ|á|é|í|ó|ú)\b/i, /¿|ñ|á|é|í|ó|ú/],
    greeting: "¡Hola! Soy Sam, tu Asistente de Ventas con IA."
  },
  fr: {
    code: 'fr',
    name: 'French', 
    nativeName: 'Français',
    flag: '🇫🇷',
    patterns: [/\b(bonjour|salut|merci|oui|non|bonsoir|s'il vous plaît)\b/i, /ç|à|é|è|ê|ë|î|ï|ô|ù|û/],
    greeting: "Bonjour ! Je suis Sam, votre Assistant Commercial IA."
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch', 
    flag: '🇩🇪',
    patterns: [/\b(hallo|guten|tag|danke|ja|nein|bitte|auf wiedersehen)\b/i, /ß|ä|ö|ü|Ä|Ö|Ü/],
    greeting: "Hallo! Ich bin Sam, Ihr KI-Vertriebsassistent."
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹', 
    patterns: [/\b(ciao|buongiorno|grazie|sì|no|per favore|arrivederci)\b/i, /à|è|é|ì|í|î|ò|ó|ù|ú/],
    greeting: "Ciao! Sono Sam, il tuo Assistente Vendite IA."
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇵🇹',
    patterns: [/\b(olá|oi|obrigado|sim|não|bom dia|por favor)\b/i, /ã|â|á|à|ç|é|ê|í|ô|õ|ú/],
    greeting: "Olá! Eu sou Sam, seu Assistente de Vendas IA."
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    patterns: [/[\u4e00-\u9fff]/, /\b(你好|谢谢|是|不|请|再见)\b/],
    greeting: "你好！我是Sam，您的AI销售助手。"
  },
  ja: {
    code: 'ja',
    name: 'Japanese', 
    nativeName: '日本語',
    flag: '🇯🇵',
    patterns: [/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/, /\b(こんにちは|ありがとう|はい|いいえ|おはよう)\b/],
    greeting: "こんにちは！私はSam、あなたのAI営業アシスタントです。"
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어', 
    flag: '🇰🇷',
    patterns: [/[\uac00-\ud7af]/, /\b(안녕하세요|감사합니다|네|아니요|좋은)\b/],
    greeting: "안녕하세요! 저는 Sam, 당신의 AI 영업 어시스턴트입니다."
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇦🇪',
    patterns: [/[\u0600-\u06ff]/, /\b(مرحبا|شكرا|نعم|لا|من فضلك)\b/],
    greeting: "مرحباً! أنا سام، مساعد المبيعات الذكي الخاص بك."
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिंदी',
    flag: '🇮🇳',
    patterns: [/[\u0900-\u097f]/, /\b(नमस्ते|धन्यवाद|हां|नहीं|कृपया)\b/],
    greeting: "नमस्ते! मैं सैम हूं, आपका AI सेल्स असिस्टेंट।"
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    patterns: [/[\u0400-\u04ff]/, /\b(привет|спасибо|да|нет|пожалуйста)\b/i],
    greeting: "Привет! Я Сэм, ваш ИИ-помощник по продажам."
  },
  nl: {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands', 
    flag: '🇳🇱',
    patterns: [/\b(hallo|dank je|ja|nee|goedemorgen|alsjeblieft)\b/i],
    greeting: "Hallo! Ik ben Sam, uw AI Verkoopassistent."
  }
};

/**
 * Detects the most likely language of the given text
 */
export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) {
    return 'en'; // Default to English
  }

  const scores: Record<SupportedLanguage, number> = {} as Record<SupportedLanguage, number>;
  
  // Initialize scores
  Object.keys(SUPPORTED_LANGUAGES).forEach(lang => {
    scores[lang as SupportedLanguage] = 0;
  });

  // Score based on pattern matches
  Object.entries(SUPPORTED_LANGUAGES).forEach(([langCode, config]) => {
    config.patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        scores[langCode as SupportedLanguage] += matches.length;
      }
    });
  });

  // Find language with highest score
  const detectedLang = Object.entries(scores).reduce((best, [lang, score]) => {
    return score > best.score ? { lang: lang as SupportedLanguage, score } : best;
  }, { lang: 'en' as SupportedLanguage, score: 0 });

  return detectedLang.score > 0 ? detectedLang.lang : 'en';
}

/**
 * Gets the language configuration for a language code
 */
export function getLanguageConfig(langCode: SupportedLanguage): LanguageConfig {
  return SUPPORTED_LANGUAGES[langCode] || SUPPORTED_LANGUAGES.en;
}

/**
 * Generates the language switching prompt after workspace tour
 */
export function getLanguageSwitchPrompt(currentLang: SupportedLanguage = 'en'): string {
  const config = getLanguageConfig(currentLang);
  
  if (currentLang === 'en') {
    return `

🌍 **Language Options Available**

By the way, I speak multiple languages! If you'd prefer to continue in a different language, just type a message in that language and I'll automatically switch. I support:

${Object.values(SUPPORTED_LANGUAGES).map(lang => `${lang.flag} **${lang.name}** (${lang.nativeName})`).join('\n')}

Just continue in English, or type something like "Hola" for Spanish, "Bonjour" for French, etc.

Now, what would you like to tackle first - should I give you an overview of what I can do, or do you have specific sales challenges you'd like to discuss?`;
  } else {
    // If already switched languages, provide a brief note in their language
    const languageNames = {
      es: 'También puedo cambiar a otros idiomas si escribes en otro idioma.',
      fr: 'Je peux aussi changer vers d\'autres langues si vous écrivez dans une autre langue.',
      de: 'Ich kann auch zu anderen Sprachen wechseln, wenn Sie in einer anderen Sprache schreiben.',
      it: 'Posso anche passare ad altre lingue se scrivi in un\'altra lingua.',
      pt: 'Também posso mudar para outros idiomas se você escrever em outro idioma.',
      zh: '如果您用其他语言输入，我也可以切换到其他语言。',
      ja: '他の言語で入力すれば、他の言語に切り替えることもできます。',
      ko: '다른 언어로 입력하시면 다른 언어로 전환할 수도 있습니다.',
      ar: 'يمكنني أيضاً التبديل إلى لغات أخرى إذا كتبت بلغة أخرى.',
      hi: 'यदि आप किसी अन्य भाषा में लिखें तो मैं अन्य भाषाओं में भी बदल सकता हूं।',
      ru: 'Я также могу переключиться на другие языки, если вы напишете на другом языке.',
      nl: 'Ik kan ook naar andere talen wisselen als je in een andere taal schrijft.'
    };

    return `\n\n🌍 ${languageNames[currentLang as keyof typeof languageNames] || 'English'}`;
  }
}

/**
 * Gets system prompt additions for a specific language
 */
export function getLanguageSystemPrompt(langCode: SupportedLanguage): string {
  const config = getLanguageConfig(langCode);
  
  if (langCode === 'en') {
    return '';
  }

  return `
LANGUAGE: Respond in ${config.name} (${config.nativeName}). The user has indicated they prefer this language.

LANGUAGE SWITCHING: If the user writes in a different language, automatically switch to that language and acknowledge the change naturally.

CULTURAL CONTEXT: Adapt your communication style appropriately for ${config.name} business culture while maintaining your helpful, sales-focused personality.
`;
}

/**
 * Simple language detection from user input to determine if language should switch
 */
export function shouldSwitchLanguage(userInput: string, currentLang: SupportedLanguage): SupportedLanguage | null {
  const detectedLang = detectLanguage(userInput);
  
  // Only switch if detected language is different and confidence is reasonable
  if (detectedLang !== currentLang && detectedLang !== 'en') {
    return detectedLang;
  }
  
  // If currently not English and user writes in English, switch to English
  if (currentLang !== 'en' && detectedLang === 'en') {
    return 'en';
  }
  
  return null;
}