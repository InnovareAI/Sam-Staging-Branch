interface PersonalizationGuidelines {
  language: string;
  country: string;
  formality: 'formal' | 'semi-formal' | 'casual';
  addressingStyle: string;
  commonVariables: string[];
  culturalNotes: string[];
  exampleTemplates: {
    connectionRequest: string;
    followUp: string;
  };
  dosList: string[];
  dontsList: string[];
  characterEfficiency: {
    average: number;
    tips: string[];
  };
}

export const LINKEDIN_PERSONALIZATION_GUIDELINES: Record<string, PersonalizationGuidelines> = {
  'de': {
    language: 'German',
    country: 'Germany/Austria/Switzerland',
    formality: 'formal',
    addressingStyle: 'Sie (formal you) until explicitly told otherwise',
    commonVariables: [
      '{anrede}', // Mr./Ms. (Herr/Frau)
      '{nachname}', // Last name
      '{vorname}', // First name
      '{unternehmen}', // Company
      '{position}', // Job title
      '{branche}', // Industry
      '{standort}', // Location
      '{gemeinsame_kontakte}', // Mutual connections
      '{gemeinsame_interessen}' // Common interests
    ],
    culturalNotes: [
      'Always use formal "Sie" unless explicitly told to use "Du"',
      'Germans appreciate directness but with politeness',
      'Mention specific business value or mutual benefit',
      'Reference company achievements or industry recognition',
      'Use professional titles when appropriate (Dr., Prof., etc.)',
      'Business culture values punctuality and efficiency',
      'Data privacy (DSGVO/GDPR) is extremely important'
    ],
    exampleTemplates: {
      connectionRequest: `Sehr geehrte/r {anrede} {nachname},

ich habe Ihr Profil bei {unternehmen} entdeckt und bin von Ihrer Expertise im Bereich {branche} beeindruckt. Als {meine_position} bei {mein_unternehmen} arbeiten wir an ähnlichen Herausforderungen.

Gerne würde ich mich mit Ihnen vernetzen und von Ihren Erfahrungen lernen.

Mit freundlichen Grüßen,
{mein_name}`,
      
      followUp: `Hallo {vorname},

vielen Dank für die Annahme meiner Vernetzungsanfrage! Ich verfolge die Entwicklungen bei {unternehmen} mit großem Interesse, besonders Ihre Arbeit im Bereich {spezifisches_projekt}.

Falls Sie Interesse an einem kurzen Austausch über {relevantes_thema} haben, würde ich mich sehr freuen.

Beste Grüße,
{mein_name}`
    },
    dosList: [
      'Use "Sehr geehrte/r" for formal openings',
      'Include specific company or industry references',
      'Mention mutual connections if available',
      'Use "Mit freundlichen Grüßen" for professional closing',
      'Reference specific achievements or projects',
      'Be direct about your intentions',
      'Use industry-specific terminology correctly'
    ],
    dontsList: [
      'Never use "Du" without permission',
      'Avoid overly casual American-style approaches',
      'Don\'t ignore professional titles',
      'Never be pushy about immediate meetings',
      'Avoid generic templates without personalization',
      'Don\'t use informal abbreviations',
      'Never ignore GDPR privacy concerns'
    ],
    characterEfficiency: {
      average: 15, // German words are typically longer
      tips: [
        'Use compound words efficiently (Zusammensetzungen)',
        'Abbreviate common business terms (GmbH, AG, etc.)',
        'Use "inkl." instead of "einschließlich"',
        'Use "bzgl." instead of "bezüglich"',
        'Keep sentences structured but concise'
      ]
    }
  },

  'nl': {
    language: 'Dutch',
    country: 'Netherlands/Belgium',
    formality: 'semi-formal',
    addressingStyle: 'U (formal) initially, can switch to je/jij if appropriate',
    commonVariables: [
      '{aanhef}', // Salutation
      '{achternaam}', // Last name
      '{voornaam}', // First name
      '{bedrijf}', // Company
      '{functie}', // Job function
      '{sector}', // Industry sector
      '{locatie}', // Location
      '{gemeenschappelijke_connecties}', // Mutual connections
      '{gemeenschappelijke_interesses}' // Common interests
    ],
    culturalNotes: [
      'Dutch directness is appreciated - be straightforward',
      'Egalitarian culture - avoid excessive hierarchy emphasis',
      'Value work-life balance references',
      'Sustainability and social responsibility are important',
      'Innovation and efficiency are highly valued',
      'Be genuine and authentic in approach',
      'Avoid overly formal or stiff language'
    ],
    exampleTemplates: {
      connectionRequest: `Hallo {voornaam},

Ik kwam uw profil tegen bij {bedrijf} en was geïnteresseerd in uw werk als {functie}. Als {mijn_functie} bij {mijn_bedrijf} werk ik aan vergelijkbare uitdagingen in de {sector}.

Ik zou graag verbinding maken en ervaringen uitwisselen.

Met vriendelijke groet,
{mijn_naam}`,

      followUp: `Hoi {voornaam},

Bedankt voor het accepteren van mijn verzoek! Ik volg de ontwikkelingen bij {bedrijf} met interesse, vooral jullie aanpak van {specifiek_project}.

Zou je interesse hebben in een korte kennismaking over {relevant_onderwerp}?

Groeten,
{mijn_naam}`
    },
    dosList: [
      'Be direct and honest about intentions',
      'Use "Hallo" for semi-formal approach',
      'Reference specific company innovations',
      'Mention sustainability if relevant',
      'Be concise and to the point',
      'Show genuine interest in their work',
      'Use industry-specific Dutch terminology'
    ],
    dontsList: [
      'Don\'t be overly formal or hierarchical',
      'Avoid lengthy introductions',
      'Don\'t ignore their work-life balance',
      'Never use outdated formal structures',
      'Avoid generic corporate speak',
      'Don\'t be pushy about sales',
      'Never ignore their direct communication style'
    ],
    characterEfficiency: {
      average: 12,
      tips: [
        'Use contractions where appropriate',
        'Combine related concepts efficiently',
        'Use "mbt" instead of "met betrekking tot"',
        'Use "ivm" instead of "in verband met"',
        'Keep Dutch sentence structure clear'
      ]
    }
  },

  'fr': {
    language: 'French',
    country: 'France/Belgium/Switzerland/Quebec',
    formality: 'formal',
    addressingStyle: 'Vous (formal) - extremely important in French business culture',
    commonVariables: [
      '{civilite}', // Mr./Ms. (Monsieur/Madame)
      '{nom}', // Last name
      '{prenom}', // First name
      '{entreprise}', // Company
      '{poste}', // Position
      '{secteur}', // Industry
      '{ville}', // City
      '{relations_communes}', // Mutual connections
      '{interets_communs}' // Common interests
    ],
    culturalNotes: [
      'French business culture is very formal - always use "Vous"',
      'Proper grammar and spelling are crucial',
      'Intellectual approach is valued over pure sales',
      'Reference cultural or business achievements',
      'Elegance in language is appreciated',
      'Hierarchy and titles are important',
      'Long-term relationship building over quick wins'
    ],
    exampleTemplates: {
      connectionRequest: `Bonjour {civilite} {nom},

J'ai découvert votre profil chez {entreprise} et je suis impressionné(e) par votre expertise en {secteur}. En tant que {mon_poste} chez {mon_entreprise}, je travaille sur des défis similaires.

J'aimerais beaucoup établir une connexion et échanger sur nos expériences respectives.

Cordialement,
{mon_nom}`,

      followUp: `Bonjour {prenom},

Je vous remercie d'avoir accepté ma demande de connexion. Je suis les développements chez {entreprise} avec grand intérêt, notamment votre approche de {projet_specifique}.

Seriez-vous intéressé(e) par un bref échange sur {sujet_pertinent} ?

Bien cordialement,
{mon_nom}`
    },
    dosList: [
      'Always use "Monsieur/Madame" in formal contexts',
      'Use "Cordialement" or "Bien cordialement" for closing',
      'Reference intellectual achievements',
      'Maintain elegant language structure',
      'Show respect for their expertise',
      'Use proper French business vocabulary',
      'Demonstrate cultural awareness'
    ],
    dontsList: [
      'Never use "tu/toi" in business contexts',
      'Don\'t ignore French grammar rules',
      'Avoid overly casual English influences',
      'Never rush to business discussion',
      'Don\'t ignore hierarchy and titles',
      'Avoid poorly translated templates',
      'Never be too direct without politeness'
    ],
    characterEfficiency: {
      average: 14,
      tips: [
        'Use "cf." instead of "se référer à"',
        'Use abbreviations like "Cie" for "Compagnie"',
        'Use "etc." effectively',
        'Keep French sentence flow natural',
        'Use "via" instead of "par l\'intermédiaire de"'
      ]
    }
  },

  'en': {
    language: 'English',
    country: 'US/UK/Canada/Australia',
    formality: 'semi-formal',
    addressingStyle: 'First name basis is generally acceptable',
    commonVariables: [
      '{first_name}', // First name
      '{last_name}', // Last name
      '{company}', // Company
      '{title}', // Job title
      '{industry}', // Industry
      '{location}', // Location
      '{mutual_connections}', // Mutual connections
      '{common_interests}' // Common interests
    ],
    culturalNotes: [
      'Direct communication is valued',
      'Personal branding and achievements matter',
      'Innovation and disruption are positive',
      'Networking is culturally accepted',
      'Value propositions should be clear',
      'Professional but friendly tone works well',
      'Quick wins and efficiency are appreciated'
    ],
    exampleTemplates: {
      connectionRequest: `Hi {first_name},

I came across your profile at {company} and was impressed by your work in {industry}. As a {my_title} at {my_company}, I'm working on similar challenges.

I'd love to connect and learn from your experience.

Best regards,
{my_name}`,

      followUp: `Hi {first_name},

Thanks for connecting! I've been following {company}'s work in {specific_area} and found your approach to {specific_project} particularly interesting.

Would you be open to a brief chat about {relevant_topic}?

Best,
{my_name}`
    },
    dosList: [
      'Be direct and concise',
      'Show genuine interest in their work',
      'Use first names appropriately',
      'Reference specific achievements',
      'Be clear about value proposition',
      'Keep tone professional but friendly',
      'Include clear call to action'
    ],
    dontsList: [
      'Don\'t be overly formal',
      'Avoid generic templates',
      'Don\'t be pushy or sales-heavy',
      'Never ignore their actual work',
      'Don\'t use outdated business language',
      'Avoid spelling/grammar errors',
      'Don\'t be too casual initially'
    ],
    characterEfficiency: {
      average: 10,
      tips: [
        'Use contractions appropriately',
        'Keep sentences concise',
        'Use industry abbreviations',
        'Eliminate unnecessary words',
        'Use bullet points when helpful'
      ]
    }
  }
};

export function getPersonalizationGuidelines(language: string): PersonalizationGuidelines {
  return LINKEDIN_PERSONALIZATION_GUIDELINES[language] || LINKEDIN_PERSONALIZATION_GUIDELINES['en'];
}

export function detectLanguageFromContent(content: string): string {
  // Simple language detection based on common words
  const languageIndicators = {
    'de': ['sehr', 'geehrte', 'mit', 'freundlichen', 'grüßen', 'ich', 'Sie', 'haben', 'sind', 'unternehmen'],
    'nl': ['hallo', 'bedrijf', 'met', 'vriendelijke', 'groet', 'ik', 'ben', 'werk', 'bij', 'interessant'],
    'fr': ['bonjour', 'monsieur', 'madame', 'cordialement', 'entreprise', 'je', 'vous', 'suis', 'avec', 'dans'],
    'en': ['hello', 'company', 'work', 'experience', 'best', 'regards', 'looking', 'forward', 'connect', 'team']
  };

  const contentLower = content.toLowerCase();
  let bestMatch = 'en';
  let maxMatches = 0;

  for (const [lang, indicators] of Object.entries(languageIndicators)) {
    const matches = indicators.filter(indicator => contentLower.includes(indicator)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = lang;
    }
  }

  return bestMatch;
}

export function getLanguageSpecificRecommendations(content: string, language: string): string[] {
  const guidelines = getPersonalizationGuidelines(language);
  const recommendations: string[] = [];

  // Check for missing personalization variables
  const hasVariables = guidelines.commonVariables.some(variable => 
    content.includes(variable.replace(/[{}]/g, ''))
  );

  if (!hasVariables) {
    recommendations.push(`Add ${language} personalization variables: ${guidelines.commonVariables.slice(0, 3).join(', ')}`);
  }

  // Check formality level
  if (guidelines.formality === 'formal' && language === 'de') {
    if (!content.includes('Sie') && !content.includes('Sehr geehrte')) {
      recommendations.push('Use formal German addressing: "Sie" and "Sehr geehrte/r"');
    }
  }

  if (guidelines.formality === 'formal' && language === 'fr') {
    if (!content.includes('Vous') && !content.includes('Monsieur') && !content.includes('Madame')) {
      recommendations.push('Use formal French addressing: "Vous" and "Monsieur/Madame"');
    }
  }

  // Character efficiency recommendations
  if (content.length > 250) {
    recommendations.push(...guidelines.characterEfficiency.tips.slice(0, 2));
  }

  return recommendations;
}