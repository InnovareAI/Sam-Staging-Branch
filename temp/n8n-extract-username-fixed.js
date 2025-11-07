// Extract LinkedIn username from URL and get unipileAccountId from webhook
const linkedinUrl = $input.item.json.linkedin_url;
const username = linkedinUrl.split('/in/')[1]?.split('?')[0]?.replace('/', '');

if (!username) {
  throw new Error('Invalid LinkedIn URL: ' + linkedinUrl);
}

// CRITICAL FIX: Get unipileAccountId from the webhook node
const webhookData = $node["Campaign Webhook"].json;
const unipileAccountId = webhookData.unipileAccountId;

if (!unipileAccountId) {
  throw new Error('Missing unipileAccountId from webhook data');
}

return {
  ...items[0].json,
  linkedin_username: username,
  unipileAccountId: unipileAccountId  // Now available for Get LinkedIn Profile node
};
