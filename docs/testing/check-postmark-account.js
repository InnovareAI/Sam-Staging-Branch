// Check Postmark account status and domain verification
const serverResponse = await fetch('https://api.postmarkapp.com/server', {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'X-Postmark-Server-Token': 'bf9e070d-eec7-4c41-8fb5-1d37fe384723'
  }
});

const serverData = await serverResponse.json();
console.log('📊 Postmark Server Info:', serverData);

// Check sending statistics
const statsResponse = await fetch('https://api.postmarkapp.com/stats/outbound', {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'X-Postmark-Server-Token': 'bf9e070d-eec7-4c41-8fb5-1d37fe384723'
  }
});

const statsData = await statsResponse.json();
console.log('📈 Sending Stats:', statsData);

// Check recent bounces
const bouncesResponse = await fetch('https://api.postmarkapp.com/bounces', {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'X-Postmark-Server-Token': 'bf9e070d-eec7-4c41-8fb5-1d37fe384723'
  }
});

const bouncesData = await bouncesResponse.json();
console.log('❌ Recent Bounces:', bouncesData);