const https = require("https");

// Account mapping
const accountMap = {
  "mERQmojtSZq5GeomZZazlw": "Thorsten Linz",
  "4nt1J-blSnGUPBjH2Nfjpg": "Charissa Saniel",
  "aroiwOeQQo2S8_-FqLjzNw": "Michelle Gestuveo",
  "ymtTx4xVQ6OVUFk83ctwtA": "Irish Maguad"
};

const accounts = Object.keys(accountMap);

// Get all campaign prospects
async function getCampaignProspects() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "latxadqrvrrrcvkktrog.supabase.co",
      path: "/rest/v1/campaign_prospects?select=id,first_name,last_name,linkedin_url,status,unipile_account_id,responded_at&status=in.(connection_request_sent,follow_up_1_sent,follow_up_2_sent,follow_up_3_sent,accepted,replied,engaged)&limit=500",
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

// Get chats for an account
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

// Get messages from a specific chat
async function getChatMessages(chatId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api6.unipile.com",
      port: 13670,
      path: "/api/v1/chats/" + chatId + "/messages?limit=20",
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
  console.log("🔍 Checking for campaign conversations (including replied)...\n");

  // Get campaign prospects
  const prospects = await getCampaignProspects();
  console.log("📊 Total prospects in campaigns:", prospects.length);

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
  });

  const allConversations = [];

  // Check each account
  for (const accountId of accounts) {
    const accountName = accountMap[accountId];
    console.log("\n========================================");
    console.log("📬 Checking " + accountName + "...");
    console.log("========================================");

    const chats = await getChats(accountId);
    console.log("Total chats:", chats.length);

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
        const messages = await getChatMessages(chat.id);

        // Count sent and received
        const sentMessages = messages.filter(m => m.is_sender === true);
        const receivedMessages = messages.filter(m => m.is_sender === false);

        // If they replied at least once, it's a conversation
        if (receivedMessages.length > 0) {
          const lastMsg = messages[0]; // Most recent
          const lastReceivedMsg = receivedMessages[0];

          allConversations.push({
            account: accountName,
            accountId: accountId,
            prospect: matchedProspect.first_name + " " + (matchedProspect.last_name || ""),
            prospectId: matchedProspect.id,
            dbStatus: matchedProspect.status,
            chatId: chat.id,
            unreadCount: chat.unread_count || 0,
            totalMessages: messages.length,
            sentCount: sentMessages.length,
            receivedCount: receivedMessages.length,
            lastMessageIsFromUs: lastMsg.is_sender === true,
            lastReceivedText: lastReceivedMsg.text || "(no text)",
            lastReceivedTimestamp: lastReceivedMsg.timestamp
          });
        }
      }
    }
  }

  console.log("\n\n========================================");
  console.log("📊 CAMPAIGN CONVERSATIONS SUMMARY");
  console.log("========================================");
  console.log("Total conversations with prospects:", allConversations.length);

  // Separate by status
  const needsReply = allConversations.filter(c => !c.lastMessageIsFromUs);
  const alreadyReplied = allConversations.filter(c => c.lastMessageIsFromUs);

  console.log("\n🔴 NEEDS REPLY (prospect's turn → us):", needsReply.length);
  console.log("✅ ALREADY REPLIED (our turn → prospect):", alreadyReplied.length);

  if (needsReply.length > 0) {
    console.log("\n========================================");
    console.log("🔴 CONVERSATIONS NEEDING REPLY:");
    console.log("========================================\n");
    needsReply.forEach((c, i) => {
      console.log((i + 1) + ". " + c.prospect + " (via " + c.account + ")");
      console.log("   DB Status: " + c.dbStatus);
      console.log("   Unread: " + c.unreadCount);
      console.log("   Messages: " + c.sentCount + " sent, " + c.receivedCount + " received");
      console.log("   Last from them: \"" + c.lastReceivedText.substring(0, 120) + "\"");
      console.log("");
    });
  }

  if (alreadyReplied.length > 0) {
    console.log("\n========================================");
    console.log("✅ CONVERSATIONS (WAITING FOR PROSPECT):");
    console.log("========================================\n");
    alreadyReplied.forEach((c, i) => {
      console.log((i + 1) + ". " + c.prospect + " (via " + c.account + ")");
      console.log("   DB Status: " + c.dbStatus);
      console.log("   Messages: " + c.sentCount + " sent, " + c.receivedCount + " received");
      console.log("   Their last msg: \"" + c.lastReceivedText.substring(0, 80) + "...\"");
      console.log("");
    });
  }
}

main().catch(console.error);
