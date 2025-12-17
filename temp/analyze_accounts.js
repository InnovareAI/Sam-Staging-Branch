// Database accounts (all marked as "active")
const dbAccounts = [
  {id: "avp6xHsCRZaP5uSPmjc2jg", name: "Irish Maguad", workspace: "babdcab8-1a78-4b2f-913e-6e9fd9821009", status: "active"},
  {id: "ymtTx4xVQ6OVUFk83ctwtA", name: "Irish Maguad", workspace: "96c03b38-a2f4-40de-9e16-43098599e1d4", status: "active"},
  {id: "4Vv6oZ73RvarImDN6iYbbg", name: "Stan Bounev", workspace: "babdcab8-1a78-4b2f-913e-6e9fd9821009", status: "active"},
  {id: "I0XZxvzfSRuCL8nuFoUEuw", name: "Rony Chatterjee, PhD", workspace: "8a720935-db68-43e2-b16d-34383ec6c3e8", status: "active"},
  {id: "aroiwOeQQo2S8_-FqLjzNw", name: "Michelle Angelica  Gestuveo", workspace: "04666209-fce8-4d71-8eaf-01278edfc73b", status: "active"},
  {id: "gW6mCsj7RK-vp89UcDUC2w", name: "Sebastian Henkel", workspace: "c3100bea-82a6-4365-b159-6581f1be9be3", status: "active"},
  {id: "DMGuhuk_R_yBFqXJlT21ow", name: "Stan Bounev", workspace: "5b81ee67-4d41-4997-b5a4-e1432e060d12", status: "active"},
  {id: "nGqBWgDmTkqnoMGA3Hbc9w", name: "Stan Bounev", workspace: "5b81ee67-4d41-4997-b5a4-e1432e060d12", status: "active"},
  {id: "RFrEaJZOSGieognCTW0V6w", name: "Brian Neirby", workspace: "aa1a214c-02f0-4f3a-8849-92c7a50ee4f7", status: "active"},
  {id: "4nt1J-blSnGUPBjH2Nfjpg", name: "𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮 𝗦𝗮𝗻𝗶𝗲𝗹", workspace: "7f0341da-88db-476b-ae0a-fc0da5b70861", status: "active"},
  {id: "Ll1T0gRVTYmLM6kqN1cJcg", name: "ChonaM Lamberte", workspace: "2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c", status: "active"},
  {id: "jYXN8FeCTEukNSXDoaH3hA", name: "tl@innovareai.com", workspace: "babdcab8-1a78-4b2f-913e-6e9fd9821009", status: "active"},
  {id: "KeHOhroOTSut7IQr5DU4Ag", name: "Martin Schechtner", workspace: "c3100bea-82a6-4365-b159-6581f1be9be3", status: "active"},
  {id: "MT39bAEDTJ6e_ZPY337UgQ", name: "Michelle Angelica  Gestuveo", workspace: "babdcab8-1a78-4b2f-913e-6e9fd9821009", status: "active"},
  {id: "mERQmojtSZq5GeomZZazlw", name: "Thorsten Linz", workspace: "babdcab8-1a78-4b2f-913e-6e9fd9821009", status: "active"},
  {id: "fntPg3vJTZ2Z1MP4rISntg", name: "Samantha Truman", workspace: "dea5a7f2-673c-4429-972d-6ba5fca473fb", status: "active"}
];

// Unipile API accounts with real status
const unipileAccounts = [
  {id: "4nt1J-blSnGUPBjH2Nfjpg", name: "𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮 𝗦𝗮𝗻𝗶𝗲𝗹", status: "OK"},
  {id: "I0XZxvzfSRuCL8nuFoUEuw", name: "Rony Chatterjee, PhD", status: "OK"},
  {id: "KeHOhroOTSut7IQr5DU4Ag", name: "Martin Schechtner", status: "OK"},
  {id: "Ll1T0gRVTYmLM6kqN1cJcg", name: "ChonaM Lamberte", status: "OK"},
  {id: "RFrEaJZOSGieognCTW0V6w", name: "Brian Neirby", status: "OK"},
  {id: "aroiwOeQQo2S8_-FqLjzNw", name: "Michelle Angelica  Gestuveo", status: "OK"},
  {id: "fntPg3vJTZ2Z1MP4rISntg", name: "Samantha Truman", status: "OK"},
  {id: "gW6mCsj7RK-vp89UcDUC2w", name: "Sebastian Henkel", status: "OK"},
  {id: "jYXN8FeCTEukNSXDoaH3hA", name: "tl@innovareai.com (GOOGLE)", status: "OK"},
  {id: "mERQmojtSZq5GeomZZazlw", name: "Thorsten Linz", status: "CREDENTIALS"},
  {id: "nGqBWgDmTkqnoMGA3Hbc9w", name: "Stan Bounev", status: "OK"},
  {id: "oOBepNc0QZauax2xo9aIMw", name: "stan@cyberinsyts.com (MAIL)", status: "OK"},
  {id: "rV0czB_nTLC8KSRb69_zRg", name: "jf@innovareai.com (GOOGLE)", status: "OK"},
  {id: "ymtTx4xVQ6OVUFk83ctwtA", name: "Irish Maguad", status: "OK"}
];

console.log("=== DISCONNECTED ACCOUNTS ===");
console.log("");

// Find accounts in DB but not in Unipile (deleted from Unipile)
const unipileIds = new Set(unipileAccounts.map(a => a.id));
const missingInUnipile = dbAccounts.filter(a => !unipileIds.has(a.id));

console.log("1. ACCOUNTS IN DB BUT DELETED FROM UNIPILE:");
missingInUnipile.forEach(acc => {
  console.log(`   - ${acc.name} (${acc.id})`);
  console.log(`     Workspace: ${acc.workspace}`);
  console.log(`     DB Status: ${acc.status} (SHOULD BE: disconnected)`);
});

console.log("");
console.log("2. ACCOUNTS WITH CREDENTIAL ISSUES:");
const credentialIssues = unipileAccounts.filter(a => a.status === "CREDENTIALS");
credentialIssues.forEach(acc => {
  const dbAccount = dbAccounts.find(d => d.id === acc.id);
  console.log(`   - ${acc.name} (${acc.id})`);
  if (dbAccount) {
    console.log(`     Workspace: ${dbAccount.workspace}`);
    console.log(`     DB Status: ${dbAccount.status} (SHOULD BE: disconnected)`);
  }
  console.log(`     Unipile Status: ${acc.status} (needs re-authentication)`);
});

console.log("");
console.log("=== SUMMARY ===");
const totalMismatches = missingInUnipile.length + credentialIssues.length;
console.log(`Total DB accounts: ${dbAccounts.length}`);
console.log(`Total Unipile accounts: ${unipileAccounts.length}`);
console.log(`Deleted from Unipile: ${missingInUnipile.length}`);
console.log(`Credential issues: ${credentialIssues.length}`);
console.log(`Total needing DB update: ${totalMismatches}`);

console.log("");
console.log("=== INNOVAREAI WORKSPACE (babdcab8-1a78-4b2f-913e-6e9fd9821009) ===");
const innovareaiAccounts = dbAccounts.filter(a => a.workspace === "babdcab8-1a78-4b2f-913e-6e9fd9821009");
console.log(`Total accounts in workspace: ${innovareaiAccounts.length}`);
innovareaiAccounts.forEach(acc => {
  const unipileAcc = unipileAccounts.find(u => u.id === acc.id);
  const realStatus = unipileAcc ? unipileAcc.status : "DELETED";
  const mismatch = (acc.status === "active" && realStatus !== "OK") ? "❌ MISMATCH" : "✅";
  console.log(`${mismatch} ${acc.name} - DB: ${acc.status}, Unipile: ${realStatus}`);
});
