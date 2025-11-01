/**
 * KB Health Scoring System
 * Calculates overall knowledge base health for workspace
 */

export interface KBHealthScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  message: string;
  criticalGaps: string[];
  warnings: string[];
  suggestions: string[];
}

export function calculateKBHealthScore(feedback: any): KBHealthScore {
  const { stats, overallFeedback, sectionFeedback } = feedback;

  let score = 50; // Start at 50

  // ICP configured (+25 points)
  if (stats.icpCount > 0) score += 25;

  // Critical sections filled (+5 each, max 20)
  const criticalSections = ['products', 'icp', 'messaging', 'pricing'];
  const filledSections = criticalSections.filter(s =>
    sectionFeedback[s]?.status !== 'critical'
  );
  score += (filledSections.length / criticalSections.length) * 20;

  // Document count (+1 per doc, max 15)
  score += Math.min(stats.totalDocuments, 15);

  // Penalties for critical gaps
  const criticalGaps = overallFeedback.filter((f: any) => f.type === 'critical');
  score -= criticalGaps.length * 10;

  score = Math.max(0, Math.min(100, score));

  // Grade assignment
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let message: string;

  if (score >= 90) {
    grade = 'A';
    message = "Excellent! I have everything I need to handle sales conversations effectively.";
  } else if (score >= 75) {
    grade = 'B';
    message = "Good foundation, but a few gaps remain.";
  } else if (score >= 60) {
    grade = 'C';
    message = "Minimal coverage - I can function but may struggle with some conversations.";
  } else if (score >= 40) {
    grade = 'D';
    message = "Critical gaps exist - I need more content to be effective.";
  } else {
    grade = 'F';
    message = "I don't have enough knowledge to handle sales conversations confidently.";
  }

  // Extract issues by severity
  const criticalGapMessages = overallFeedback
    .filter((f: any) => f.type === 'critical')
    .map((f: any) => f.title);

  const warnings = overallFeedback
    .filter((f: any) => f.type === 'warning')
    .map((f: any) => f.title);

  const suggestions = overallFeedback
    .filter((f: any) => f.type === 'suggestion')
    .map((f: any) => f.title);

  return {
    score,
    grade,
    message,
    criticalGaps: criticalGapMessages,
    warnings,
    suggestions
  };
}

/**
 * Format KB health for SAM display
 */
export function formatKBHealthForSAM(health: KBHealthScore, stats: any): string {
  let output = `**Knowledge Base Health: ${health.grade} (${health.score}/100)**\n\n`;
  output += `${health.message}\n\n`;
  output += `**Coverage:**\n`;
  output += `- ICP Profiles: ${stats.icpCount}\n`;
  output += `- Documents: ${stats.totalDocuments}\n`;
  output += `- Sections Covered: ${stats.sections}/12\n\n`;

  if (health.criticalGaps.length > 0) {
    output += `**❌ Critical Gaps:**\n`;
    output += health.criticalGaps.map(g => `- ${g}`).join('\n') + '\n\n';
  }

  if (health.warnings.length > 0) {
    output += `**⚠️ Warnings:**\n`;
    output += health.warnings.slice(0, 3).map(w => `- ${w}`).join('\n') + '\n\n';
  }

  if (health.criticalGaps.length === 0 && health.warnings.length === 0) {
    output += `**✅ No critical gaps**\n\n`;
  }

  output += `Type \`/kb-details\` for full breakdown.`;

  return output;
}

/**
 * Get critical gaps for injection into SAM system prompt
 */
export function getCriticalGapsPrompt(feedback: any): string | null {
  const criticalGaps = feedback.overallFeedback.filter(
    (f: any) => f.type === 'critical'
  );

  if (criticalGaps.length === 0) return null;

  let prompt = `\n**🚨 CRITICAL KB GAPS - MENTION TO USER**\n\n`;
  prompt += `Before proceeding with searches or campaigns, you MUST mention these gaps:\n\n`;

  criticalGaps.forEach((gap: any) => {
    prompt += `**${gap.title}**\n`;
    prompt += `${gap.message}\n`;
    prompt += `Action: ${gap.action}\n\n`;
  });

  prompt += `Ask if they want to fill these gaps first, or proceed anyway.\n`;
  prompt += `Be conversational - don't just list them, weave into natural dialogue.\n`;

  return prompt;
}
