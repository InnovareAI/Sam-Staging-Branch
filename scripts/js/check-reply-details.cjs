const https = require("https");

// Account IDs for Thorsten, Charissa, Michelle, Irish
const accounts = [
  { id: "mERQmojtSZq5GeomZZazlw", name: "Thorsten Linz" },
  { id: "4nt1J-blSnGUPBjH2Nfjpg", name: "Charissa Saniel" },
  { id: "aroiwOeQQo2S8_-FqLjzNw", name: "Michelle Gestuveo" },
  { id: "ymtTx4xVQ6OVUFk83ctwtA", name: "Irish Maguad" }
];

const checkMessages = (account) => {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api6.unipile.com",
      port: 13670,
      path: "/api/v1/chats?account_id=" + account.id + "&limit=20",
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
          resolve({ account: account.name, accountId: account.id, chats: result.items || [], error: null });
        } catch (e) {
          resolve({ account: account.name, accountId: account.id, chats: [], error: data });
        }
      });
    });
    req.on("error", (e) => resolve({ account: account.name, accountId: account.id, chats: [], error: e.message }));
    req.end();
  });
};

const getChatMessages = (chatId, accountId) => {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api6.unipile.com",
      port: 13670,
      path: "/api/v1/chats/" + chatId + "/messages?account_id=" + accountId + "&limit=5",
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
};

async function main() {
  const results = await Promise.all(accounts.map(checkMessages));

  for (const r of results) {
    console.log("\n========================================");
    console.log("📬 " + r.account);
    console.log("========================================");

    if (r.error) {
      console.log("Error:", r.error);
      continue;
    }

    if (r.chats.length === 0) {
      console.log("No recent chats found");
      continue;
    }

    // Find chats with unread messages
    const unreadChats = r.chats.filter(c => c.unread_count > 0);
    console.log("Total chats:", r.chats.length);
    console.log("Unread conversations:", unreadChats.length);

    if (unreadChats.length > 0) {
      console.log("\n🔴 UNREAD MESSAGES:");
      for (const chat of unreadChats) {
        console.log("\n--- Chat ID:", chat.id, "---");
        console.log("Unread count:", chat.unread_count);

        // Get actual messages from this chat
        const messages = await getChatMessages(chat.id, r.accountId);
        if (messages.length > 0) {
          messages.slice(0, 3).forEach(msg => {
            const sender = msg.sender_name || msg.sender?.name || "Unknown";
            const text = msg.text || msg.body || "(no text)";
            const date = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString() : "N/A";
            const direction = msg.is_sender ? "→ SENT" : "← RECEIVED";
            console.log("  [" + date + "] " + sender + " " + direction);
            console.log("    \"" + text.substring(0, 100) + "\"");
          });
        } else {
          console.log("  (Could not fetch messages)");
        }
      }
    }

    // Show 3 most recent conversations with messages
    console.log("\n📋 Recent Activity (3 most recent):");
    for (const chat of r.chats.slice(0, 3)) {
      console.log("\n--- Chat ID:", chat.id, "---");
      const messages = await getChatMessages(chat.id, r.accountId);
      if (messages.length > 0) {
        messages.slice(0, 2).forEach(msg => {
          const sender = msg.sender_name || msg.sender?.name || "Unknown";
          const text = msg.text || msg.body || "(no text)";
          const date = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString() : "N/A";
          const direction = msg.is_sender ? "→ SENT" : "← RECEIVED";
          console.log("  [" + date + "] " + sender + " " + direction);
          console.log("    \"" + text.substring(0, 100) + "\"");
        });
      }
    }
  }
}

main();
