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
          resolve({ account: account.name, chats: result.items || [], error: null });
        } catch (e) {
          resolve({ account: account.name, chats: [], error: data });
        }
      });
    });
    req.on("error", (e) => resolve({ account: account.name, chats: [], error: e.message }));
    req.end();
  });
};

Promise.all(accounts.map(checkMessages)).then(results => {
  results.forEach(r => {
    console.log("\n========================================");
    console.log("📬 " + r.account);
    console.log("========================================");

    if (r.error) {
      console.log("Error:", r.error);
      return;
    }

    if (r.chats.length === 0) {
      console.log("No recent chats found");
      return;
    }

    // Find chats with unread messages
    const unreadChats = r.chats.filter(c => c.unread_count > 0);
    console.log("Total chats:", r.chats.length);
    console.log("Unread conversations:", unreadChats.length);

    if (unreadChats.length > 0) {
      console.log("\n🔴 UNREAD MESSAGES:");
      unreadChats.forEach(chat => {
        const attendee = chat.attendees && chat.attendees.find(a => a.is_self === false);
        console.log("  - " + (attendee ? attendee.name : "Unknown") + " (" + chat.unread_count + " unread)");
        if (chat.last_message && chat.last_message.text) {
          console.log("    Last: " + chat.last_message.text.substring(0, 80) + "...");
        }
      });
    }

    // Show recent activity
    console.log("\n📋 Recent Activity (last 5):");
    r.chats.slice(0, 5).forEach(chat => {
      const lastMsg = chat.last_message;
      const attendee = chat.attendees && chat.attendees.find(a => a.is_self === false);
      const name = attendee ? attendee.name : "Unknown";
      const date = lastMsg && lastMsg.timestamp ? new Date(lastMsg.timestamp).toLocaleDateString() : "N/A";
      const direction = lastMsg && lastMsg.is_sender ? "→ SENT" : "← RECEIVED";
      console.log("  [" + date + "] " + name + " " + direction);
      if (lastMsg && lastMsg.text) {
        console.log("    \"" + lastMsg.text.substring(0, 60) + "...\"");
      }
    });
  });
});
