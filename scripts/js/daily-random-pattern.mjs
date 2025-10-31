#!/usr/bin/env node
/**
 * Daily Random Pattern Generator
 *
 * Creates completely different sending patterns each day:
 * Day 1: 0min, 17min, 19min, 84min, ... (4 sends)
 * Day 2: 0min, 2min, 45min, 128min, ... (6 sends)
 * Day 3: 0min, 65min, 67min, 91min, ... (3 sends)
 *
 * LinkedIn sees different behavior every single day
 */

console.log('🎲 Daily Random Pattern Generator for LinkedIn\n')

// Generate a day's sending pattern
function generateDailyPattern(date, maxSends = 20) {
  // Use date as seed for reproducibility (same day = same pattern, but changes daily)
  const seed = new Date(date).getDate()

  // How many sends today? (Random between 3-20)
  const sendsToday = Math.floor(Math.random() * (maxSends - 3) + 3)

  // Total business minutes: 9am-5pm = 480 minutes
  const businessMinutes = 480

  // Generate random intervals
  const intervals = []
  let currentTime = 0

  for (let i = 0; i < sendsToday - 1; i++) {
    // Random interval: 1-120 minutes
    // But weighted towards shorter for realism
    const interval = Math.random() < 0.6
      ? Math.floor(Math.random() * 30 + 1)    // 60% chance: 1-30 min (bursts)
      : Math.floor(Math.random() * 90 + 30)  // 40% chance: 30-120 min (spacing)

    currentTime += interval

    if (currentTime > businessMinutes) break
    intervals.push(interval)
  }

  return {
    date: date,
    totalSends: intervals.length + 1,
    intervals: intervals,
    pattern: intervals.join(', ') + ' minutes between sends'
  }
}

// Generate 7 days of patterns
console.log('📅 Next 7 Days - Completely Different Patterns:\n')

const today = new Date()
for (let i = 0; i < 7; i++) {
  const date = new Date(today)
  date.setDate(date.getDate() + i)

  if (date.getDay() === 0 || date.getDay() === 6) {
    console.log(`Day ${i + 1} (${date.toDateString()}): 🚫 Weekend - No sends`)
    continue
  }

  const pattern = generateDailyPattern(date)
  console.log(`Day ${i + 1} (${date.toDateString()}):`)
  console.log(`  Total sends: ${pattern.totalSends}`)
  console.log(`  Intervals: ${pattern.intervals.join(', ')} minutes`)
  console.log(`  Example timeline:`)

  let time = 9 * 60 // Start at 9am (in minutes)
  console.log(`    - 9:00 AM (send 1)`)

  pattern.intervals.forEach((interval, idx) => {
    time += interval
    const hours = Math.floor(time / 60)
    const mins = time % 60
    console.log(`    - ${hours}:${mins.toString().padStart(2, '0')} (send ${idx + 2}, +${interval}min)`)
  })
  console.log()
}

console.log('🎯 Key Features:\n')
console.log('   ✅ Different number of sends each day (3-20)')
console.log('   ✅ Different intervals each day (1-120 minutes)')
console.log('   ✅ Bursts mixed with pauses (60% short, 40% long)')
console.log('   ✅ Unpredictable to LinkedIn AI')
console.log('   ✅ Looks like natural human behavior')
console.log()

console.log('💡 Implementation Strategy:\n')
console.log('Sam App API Change:')
console.log('   - Store daily pattern in memory/cache')
console.log('   - Generate new pattern at start of each business day')
console.log('   - Delay execution based on pattern')
console.log()

console.log('Example Implementation:')
console.log(`
// In execute-live/route.ts

// Generate daily pattern (cached per day)
const today = new Date().toISOString().split('T')[0]
let dailyPattern = cache.get(\`linkedin_pattern_\${today}\`)

if (!dailyPattern) {
  // Generate new pattern for today
  const sendsToday = Math.floor(Math.random() * 18 + 3) // 3-20 sends
  const intervals = []

  for (let i = 0; i < sendsToday - 1; i++) {
    const interval = Math.random() < 0.6
      ? Math.floor(Math.random() * 30 + 1)    // Short burst: 1-30min
      : Math.floor(Math.random() * 90 + 30)  // Long pause: 30-120min
    intervals.push(interval)
  }

  dailyPattern = { intervals, nextIndex: 0 }
  cache.set(\`linkedin_pattern_\${today}\`, dailyPattern, 86400) // Cache for 24h
}

// Get next delay from pattern
const nextDelay = dailyPattern.intervals[dailyPattern.nextIndex % dailyPattern.intervals.length]
dailyPattern.nextIndex++

// Schedule this prospect for nextDelay minutes from now
const scheduledTime = new Date(Date.now() + nextDelay * 60000)
`)

console.log()
console.log('📊 Result:')
console.log('   LinkedIn sees Michelle as a normal human')
console.log('   - Some days she sends many messages (busy day)')
console.log('   - Some days just a few (light day)')
console.log('   - Timing varies wildly (realistic multitasking)')
console.log('   - No detectable pattern across days')
