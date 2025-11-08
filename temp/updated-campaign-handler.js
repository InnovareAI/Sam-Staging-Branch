// Extract and flatten prospect data for processing
try {
  const inputData = $input.first().json;
  const webhookData = inputData.body || inputData;

  console.log('=== CAMPAIGN HANDLER DEBUG ===');
  console.log('Full webhook data:', JSON.stringify(webhookData, null, 2));

  // Get unipileAccountId - handle both object and string formats
  let unipileAccountId;
  if (typeof webhookData.unipileAccountId === 'object' && webhookData.unipileAccountId !== null) {
    unipileAccountId = webhookData.unipileAccountId.unipile_account_id;
    console.log('Extracted unipileAccountId from object:', unipileAccountId);
  } else {
    unipileAccountId = webhookData.unipileAccountId;
    console.log('Using direct unipileAccountId:', unipileAccountId);
  }

  // CRITICAL: Validate unipileAccountId exists
  if (!unipileAccountId) {
    console.error('ERROR: unipileAccountId is missing or undefined!');
    console.error('webhookData.unipileAccountId:', webhookData.unipileAccountId);
    throw new Error('unipileAccountId is required but was not provided in webhook payload');
  }

  console.log('Final unipileAccountId:', unipileAccountId);

  // Process each prospect and create individual items
  const prospects = webhookData.prospects || [];
  console.log(`Processing ${prospects.length} prospects`);

  const result = prospects.map((prospect, index) => {
    const item = {
      workspace_id: webhookData.workspaceId || webhookData.workspace_id,
      campaign_id: webhookData.campaignId || webhookData.campaign_id,
      unipile_account_id: unipileAccountId,
      unipile_dsn: webhookData.unipile_dsn,
      unipile_api_key: webhookData.unipile_api_key,
      supabase_url: webhookData.supabase_url,
      supabase_service_key: webhookData.supabase_service_key,
      prospect: prospect,
      linkedin_url: prospect.linkedin_url,
      linkedin_username: prospect.linkedin_url ? prospect.linkedin_url.split('/in/')[1]?.replace(/\/$/, '') : null,
      provider_id: null,
      messages: webhookData.messages || {},
      timing: webhookData.timing || {
        fu1_delay_days: 2,
        fu2_delay_days: 5,
        fu3_delay_days: 7,
        fu4_delay_days: 5,
        gb_delay_days: 7
      },
      last_message_sent: new Date().toISOString()
    };

    if (index === 0) {
      console.log('Sample item output:', JSON.stringify(item, null, 2));
    }

    return item;
  });

  console.log('=== END CAMPAIGN HANDLER DEBUG ===');
  return result;

} catch (error) {
  console.error('Error in Campaign Handler:', error.message);
  console.error('Error stack:', error.stack);
  throw error;
}
