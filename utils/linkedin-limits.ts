interface LinkedInAccount {
  id: string;
  name: string;
  type: 'LINKEDIN';
  connection_params: {
    im: {
      id: string;
      username: string;
      premiumId?: string | null;
      premiumFeatures: string[];
      premiumContractId?: string | null;
    };
  };
}

interface LinkedInLimits {
  characterLimit: number;
  dailyConnections: number;
  weeklyConnections: number;
  accountType: 'Free' | 'Premium' | 'Sales Navigator' | 'Recruiter';
  isPremium: boolean;
}

export function getLinkedInLimits(accounts: LinkedInAccount[]): LinkedInLimits[] {
  return accounts.map(account => {
    const { premiumId, premiumFeatures } = account.connection_params.im;
    
    // Determine account type based on premium features
    let accountType: LinkedInLimits['accountType'] = 'Free';
    let characterLimit = 200; // Free account default
    let dailyConnections = 15;
    let weeklyConnections = 15;
    
    const isPremium = premiumId !== null || premiumFeatures.length > 0;
    
    if (premiumFeatures.includes('sales_navigator')) {
      accountType = 'Sales Navigator';
      characterLimit = 300;
      dailyConnections = 100;
      weeklyConnections = 200;
    } else if (premiumFeatures.includes('recruiter')) {
      accountType = 'Recruiter';
      characterLimit = 300;
      dailyConnections = 100;
      weeklyConnections = 200;
    } else if (isPremium) {
      accountType = 'Premium';
      characterLimit = 300;
      dailyConnections = 100;
      weeklyConnections = 200;
    }
    
    return {
      characterLimit,
      dailyConnections,
      weeklyConnections,
      accountType,
      isPremium
    };
  });
}

export function getBestCharacterLimit(accounts: LinkedInAccount[]): number {
  const limits = getLinkedInLimits(accounts);
  
  // Return the highest character limit available (premium accounts have 300, free have 200)
  return Math.max(...limits.map(limit => limit.characterLimit), 200);
}

export function getCharacterLimitSummary(accounts: LinkedInAccount[]): {
  maxLimit: number;
  minLimit: number;
  premiumAccounts: number;
  freeAccounts: number;
  totalAccounts: number;
} {
  const limits = getLinkedInLimits(accounts);
  
  return {
    maxLimit: Math.max(...limits.map(l => l.characterLimit), 200),
    minLimit: Math.min(...limits.map(l => l.characterLimit), 200),
    premiumAccounts: limits.filter(l => l.isPremium).length,
    freeAccounts: limits.filter(l => !l.isPremium).length,
    totalAccounts: limits.length
  };
}