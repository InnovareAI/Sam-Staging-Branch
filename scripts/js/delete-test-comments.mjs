#!/usr/bin/env node

const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';
const POST_SOCIAL_ID = 'urn:li:activity:7386026924579397633';

console.log('🗑️  Deleting test comments from LinkedIn post...\n');

async function getComments() {
  const url = `https://${UNIPILE_DSN}/api/v1/posts/${POST_SOCIAL_ID}/comments?account_id=${ACCOUNT_ID}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  });
  
  if (!response.ok) {
    console.error('❌ Failed to fetch comments:', response.status);
    return [];
  }
  
  const data = await response.json();
  return data.items || [];
}

async function deleteComment(commentId) {
  const url = `https://${UNIPILE_DSN}/api/v1/comments/${commentId}?account_id=${ACCOUNT_ID}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  });
  
  return response.ok;
}

(async () => {
  try {
    const comments = await getComments();
    console.log(`Found ${comments.length} total comments on post\n`);
    
    const testComments = comments.filter(c => 
      c.text?.includes('[TEST - Personal Profile]') || 
      c.text?.includes('[TEST - Company Page]')
    );
    
    console.log(`Found ${testComments.length} test comments to delete\n`);
    
    for (const comment of testComments) {
      console.log(`Deleting: "${comment.text.substring(0, 50)}..."`);
      const success = await deleteComment(comment.id);
      
      if (success) {
        console.log('✅ Deleted\n');
      } else {
        console.log('❌ Failed to delete\n');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ All test comments removed from LinkedIn');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
