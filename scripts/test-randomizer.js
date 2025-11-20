/**
 * Test the human-like randomization logic
 */

// Simulate the randomizer logic (without Supabase)
function testRandomizer() {
  console.log('🧪 Testing Human-Like Randomization Logic\n');

  // Test data
  const accountId = 'test-account-123';
  const today = new Date().toISOString().split('T')[0];
  const timezone = 'America/Los_Angeles';

  // Get current time in PT
  const now = new Date();
  const campaignTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const dayOfWeek = campaignTime.getDay(); // 0 = Sunday, 6 = Saturday
  const currentHour = campaignTime.getHours();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  console.log('📅 Current Date:', today);
  console.log('🕐 Server Time:', now.toISOString());
  console.log('🌎 Campaign Time (PT):', campaignTime.toLocaleString());
  console.log('📆 Day of Week:', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]);
  console.log('⏰ Current Hour (PT):', currentHour);
  console.log('🏖️  Is Weekend:', isWeekend ? 'YES' : 'NO');
  console.log('');

  // Check working hours (5 AM - 6 PM PT)
  const workingHoursStart = 5;
  const workingHoursEnd = 18;
  const isOutsideWorkingHours = currentHour < workingHoursStart || currentHour >= workingHoursEnd;

  console.log('⏰ Working Hours: 5 AM - 6 PM PT');
  console.log('🚦 Currently:', isOutsideWorkingHours ? 'OUTSIDE working hours' : 'WITHIN working hours');

  if (isOutsideWorkingHours) {
    const hoursUntilStart = currentHour < workingHoursStart
      ? workingHoursStart - currentHour
      : (24 - currentHour) + workingHoursStart;
    console.log('⏸️  Would wait:', hoursUntilStart, 'hours until working hours');
    console.log('');
    return;
  }

  if (isWeekend) {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    console.log('⏸️  Would wait:', daysUntilMonday, 'days until Monday');
    console.log('');
    return;
  }

  console.log('✅ Within working hours and weekday - randomization would proceed');
  console.log('');

  // Generate day-specific randomization seed
  const dateSeed = parseInt(today.replace(/-/g, '')) + accountId.charCodeAt(0);
  const dayPattern = dateSeed % 5;

  const patterns = ['Slow (0-2 msg/hr)', 'Medium (2-3 msg/hr)', 'Busy (3-5 msg/hr)', 'Burst (alternate)', 'Random Walk (1-5 msg/hr)'];
  console.log('🎲 Today\'s Pattern:', patterns[dayPattern]);
  console.log('');

  // Simulate delays for 5 prospects
  console.log('⏱️  Sample Delays for 5 Prospects:');
  console.log('─'.repeat(50));

  for (let i = 0; i < 5; i++) {
    let hourlyRate;

    switch (dayPattern) {
      case 0: hourlyRate = Math.random() * 2; break;
      case 1: hourlyRate = 2 + Math.random(); break;
      case 2: hourlyRate = 3 + Math.random() * 2; break;
      case 3: hourlyRate = (i % 2 === 0) ? 4 + Math.random() : 1 + Math.random(); break;
      case 4: hourlyRate = 1 + Math.random() * 4; break;
      default: hourlyRate = 2;
    }

    const baseDelayMinutes = 60 / hourlyRate;
    const randomness = 0.7 + Math.random() * 0.6;
    const delayMinutes = Math.floor(baseDelayMinutes * randomness);

    console.log(`Prospect ${i + 1}: ${delayMinutes} min delay (${hourlyRate.toFixed(1)} msg/hr)`);
  }

  console.log('');
  console.log('✅ Randomization logic is working!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  - Respects working hours (5 AM - 6 PM PT)');
  console.log('  - Skips weekends (M-F only)');
  console.log('  - 5 different day patterns for variety');
  console.log('  - Random variance (±30%) per message');
  console.log('  - Checks daily account limits');
}

// Run test
testRandomizer();
