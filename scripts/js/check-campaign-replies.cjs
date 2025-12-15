const https = require("https");

// Account mapping
const accountMap = {
  "mERQmojtSZq5GeomZZazlw": "Thorsten Linz",
  "4nt1J-blSnGUPBjH2Nfjpg": "Charissa Saniel",
  "aroiwOeQQo2S8_-FqLjzNw": "Michelle Gestuveo",
  "ymtTx4xVQ6OVUFk83ctwtA": "Irish Maguad"
};

const accounts = Object.keys(accountMap);

// Step 1: Get all campaign prospects who were contacted
async function getCampaignProspects() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "latxadqrvrrrcvkktrog.supabase.co",
      path: "/rest/v1/campaign_prospects?select=id,first_name,last_name,linkedin_url,status,unipile_account_id&status=in.(connection_request_sent,follow_up_1_sent,follow_up_2_sent,follow_up_3_sent,accepted)&limit=500",
      method: "GET",
      headers: {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.end();
  });
}

// Step 2: Get chats for an account
async function getChats(accountId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api6.unipile.com",
      port: 13670,
      path: "/api/v1/chats?account_id=" + accountId + "&limit=100",
      method: "GET",
      headers: {
        "X-API-KEY": "39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE="
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          resolve(result.items || []);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.end();
  });
}

// Step 3: Get messages from a specific chat
async function getChatMessages(chatId, accountId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api6.unipile.com",
      port: 13670,
      path: "/api/v1/chats/" + chatId + "/messages?limit=10",
      method: "GET",
      headers: {
        "X-API-KEY": "39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE="
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          resolve(result.items || []);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.end();
  });
}

// Extract vanity from LinkedIn URL
function extractVanity(url) {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
  return match ? match[1].toLowerCase() : null;
}

// Normalize name for matching
function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("🔍 Checking for campaign replies...\n");

  // Get campaign prospects
  const prospects = await getCampaignProspects();
  console.log("📊 Total contacted prospects:", prospects.length);

  // Build lookup maps
  const prospectsByVanity = {};
  const prospectsByName = {};

  prospects.forEach(p => {
    const vanity = extractVanity(p.linkedin_url);
    if (vanity) {
      prospectsByVanity[vanity.toLowerCase()] = p;
    }

    const fullName = normalizeName((p.first_name || "") + " " + (p.last_name || ""));
    if (fullName) {
      prospectsByName[fullName] = p;
    }

    // Also try first name only
    const firstName = normalizeName(p.first_name || "");
    if (firstName && firstName.length > 2) {
      if (!prospectsByName[firstName]) {
        prospectsByName[firstName] = p;
      }
    }
  });

  console.log("📋 Indexed by vanity:", Object.keys(prospectsByVanity).length);
  console.log("📋 Indexed by name:", Object.keys(prospectsByName).length);

  const campaignReplies = [];

  // Check each account
  for (const accountId of accounts) {
    const accountName = accountMap[accountId];
    console.log("\n========================================");
    console.log("📬 Checking " + accountName + "...");
    console.log("========================================");

    const chats = await getChats(accountId);
    console.log("Total chats:", chats.length);

    let repliesFound = 0;

    for (const chat of chats) {
      // Get attendee info
      const attendee = chat.attendees && chat.attendees.find(a => a.is_self === false);
      if (!attendee) continue;

      const attendeeName = attendee.name || "";
      const attendeeIdentifier = attendee.identifier || "";

      // Try to match by identifier (vanity)
      let matchedProspect = null;
      if (attendeeIdentifier) {
        const vanity = attendeeIdentifier.toLowerCase();
        if (prospectsByVanity[vanity]) {
          matchedProspect = prospectsByVanity[vanity];
        }
      }

      // Try to match by name
      if (!matchedProspect) {
        const normalizedAttendeeName = normalizeName(attendeeName);
        if (prospectsByName[normalizedAttendeeName]) {
          matchedProspect = prospectsByName[normalizedAttendeeName];
        }
      }

      if (matchedProspect) {
        // This is a conversation with one of our prospects!
        // Check if they replied (last message is NOT from us)
        const messages = await getChatMessages(chat.id, accountId);

        // Find if there's a received message (not from us)
        const receivedMessages = messages.filter(m => m.is_sender === false);

        if (receivedMessages.length > 0) {
          repliesFound++;
          const lastReceived = receivedMessages[0]; // Most recent received

          campaignReplies.push({
            account: accountName,
            prospect: matchedProspect.first_name + " " + (matchedProspect.last_name || ""),
            status: matchedProspect.status,
            chatId: chat.id,
            unreadCount: chat.unread_count || 0,
            lastReply: lastReceived.text || "(no text)",
            replyTimestamp: lastReceived.timestamp
          });

          console.log("\n🎯 REPLY FOUND: " + matchedProspect.first_name + " " + (matchedProspect.last_name || ""));
          console.log("   Status: " + matchedProspect.status);
          console.log("   Unread: " + (chat.unread_count || 0));
          console.log("   Reply: \"" + (lastReceived.text || "").substring(0, 100) + "...\"");
        }
      }
    }

    console.log("\n✅ Replies found for " + accountName + ": " + repliesFound);
  }

  console.log("\n\n========================================");
  console.log("📊 CAMPAIGN REPLY SUMMARY");
  console.log("========================================");
  console.log("Total campaign replies found:", campaignReplies.length);

  if (campaignReplies.length > 0) {
    console.log("\n🔴 REPLIES NEEDING ATTENTION:\n");
    campaignReplies.forEach((r, i) => {
      console.log((i + 1) + ". " + r.prospect + " (via " + r.account + ")");
      console.log("   Status: " + r.status);
      console.log("   Unread: " + r.unreadCount);
      console.log("   Reply: \"" + r.lastReply.substring(0, 120) + "\"");
      console.log("");
    });
  } else {
    console.log("\n✅ No pending campaign replies found.");
  }
}

main().catch(console.error);
