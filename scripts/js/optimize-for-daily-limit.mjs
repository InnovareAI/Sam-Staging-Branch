#!/usr/bin/env node
/**
 * Optimize scheduler for daily LinkedIn rate limits
 *
 * Michelle's limits: 20 CR/day (connection requests per day)
 * This changes our scheduling strategy significantly
 */

console.log('📊 LinkedIn Campaign Optimization for Rate Limits\n')

const DAILY_CR_LIMIT = 20
const BUSINESS_HOURS = 8 // 9am-5pm
const BUSINESS_DAYS = 5 // Mon-Fri

console.log('🎯 Current Limits:')
console.log(`   Daily CR Limit: ${DAILY_CR_LIMIT} connection requests/day`)
console.log(`   Business Hours: ${BUSINESS_HOURS} hours/day`)
console.log(`   Business Days: ${BUSINESS_DAYS} days/week`)
console.log()

// Strategy 1: Space out throughout the day
const avgCRPerHour = DAILY_CR_LIMIT / BUSINESS_HOURS
const minutesPerCR = (BUSINESS_HOURS * 60) / DAILY_CR_LIMIT

console.log('📋 Strategy 1: Even Distribution')
console.log(`   Average: ${avgCRPerHour.toFixed(1)} connection requests/hour`)
console.log(`   Interval: ${minutesPerCR.toFixed(0)} minutes between requests`)
console.log(`   Recommended scheduler: Every ${Math.ceil(minutesPerCR / 2)} minutes`)
console.log()

// Strategy 2: Batch processing (more human-like)
const batchSize = 5
const batchesPerDay = DAILY_CR_LIMIT / batchSize
const hoursBetweenBatches = BUSINESS_HOURS / batchesPerDay

console.log('📋 Strategy 2: Batch Processing (RECOMMENDED)')
console.log(`   Batch size: ${batchSize} prospects at once`)
console.log(`   Batches per day: ${batchesPerDay}`)
console.log(`   Hours between batches: ${hoursBetweenBatches.toFixed(1)}h`)
console.log(`   Scheduler frequency: Every ${Math.ceil(hoursBetweenBatches * 60)} minutes`)
console.log()

// Calculate n8n operation costs
const intervals = [
  { name: '2 minutes', minutes: 2 },
  { name: '15 minutes', minutes: 15 },
  { name: '30 minutes', minutes: 30 },
  { name: '1 hour', minutes: 60 },
  { name: '2 hours', minutes: 120 }
]

console.log('💰 N8N Operation Costs (50,000 limit):')
intervals.forEach(interval => {
  const executionsPerDay = (60 / interval.minutes) * 24
  const executionsPerMonth = executionsPerDay * 30
  const operationsPerMonth = executionsPerMonth * 4 // 4 operations per scheduler check
  const status = operationsPerMonth <= 50000 ? '✅' : '🔴'
  const pct = ((operationsPerMonth / 50000) * 100).toFixed(0)
  console.log(`   ${status} ${interval.name}: ${operationsPerMonth.toLocaleString()} ops/month (${pct}% of limit)`)
})
console.log()

// Optimal recommendation
console.log('🎯 OPTIMAL CONFIGURATION:')
console.log()
console.log('   Scheduler Frequency: Every 2 hours')
console.log('   ✅ 5,760 operations/month (11.5% of limit)')
console.log('   ✅ Checks 12 times/day during business hours')
console.log('   ✅ Can handle 1-2 prospects per check')
console.log()
console.log('   Rate Limiting:')
console.log('   - Max 5 prospects per execution (batch)')
console.log('   - Max 20 CR/day enforced in Sam App')
console.log('   - Business hours only (9am-5pm Mon-Fri)')
console.log()
console.log('   Human-like behavior:')
console.log('   - Random 1-5 minute delays between prospects in batch')
console.log('   - Random wait times between follow-ups')
console.log('   - Messages only during business hours')
console.log()

console.log('📝 Implementation Steps:\n')
console.log('1. Update scheduler to 2-hour interval:')
console.log('   node scripts/js/update-scheduler-interval.mjs 120')
console.log()
console.log('2. Add daily rate limiting to Sam App:')
console.log('   - Track connection requests per day per account')
console.log('   - Stop execution when limit reached')
console.log('   - Resume next business day')
console.log()
console.log('3. Add humanization to n8n workflow:')
console.log('   node scripts/js/humanize-linkedin-campaign.mjs')
console.log()

// Weekly capacity
const weeklyCapacity = DAILY_CR_LIMIT * BUSINESS_DAYS
const monthlyCapacity = weeklyCapacity * 4
console.log('📊 Campaign Capacity:')
console.log(`   Daily: ${DAILY_CR_LIMIT} connection requests`)
console.log(`   Weekly: ${weeklyCapacity} connection requests`)
console.log(`   Monthly: ${monthlyCapacity} connection requests`)
console.log()
console.log('   With 5-message sequence (CR + 4 FU + GB):')
console.log(`   Monthly outreach: ${monthlyCapacity} new prospects`)
console.log(`   Total messages: ${monthlyCapacity * 6} messages/month`)
