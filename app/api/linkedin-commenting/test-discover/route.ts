import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const UNIPILE_DSN = 'api6.unipile.com:13670';
  const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
  const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

  console.log('TEST: Simple discover test');

  // Test with haywarddave
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/haywarddave?account_id=${ACCOUNT_ID}`;
  const profileResponse = await fetch(profileUrl, {
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  });

  if (!profileResponse.ok) {
    return NextResponse.json({ error: 'Profile fetch failed' });
  }

  const profile = await profileResponse.json();
  console.log('Profile:', profile.first_name, profile.last_name);

  // Get posts
  const postsUrl = `https://${UNIPILE_DSN}/api/v1/users/${profile.provider_id}/posts?account_id=${ACCOUNT_ID}`;
  const postsResponse = await fetch(postsUrl, {
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  });

  if (!postsResponse.ok) {
    return NextResponse.json({ error: 'Posts fetch failed' });
  }

  const postsData = await postsResponse.json();
  const posts = postsData.items || [];

  console.log('Total posts:', posts.length);

  // Check date of first post
  if (posts.length > 0) {
    const first = posts[0];
    console.log('First post date:', first.date);
    console.log('First post parsed_datetime:', first.parsed_datetime);

    // Parse relative date
    const dateStr = first.date;
    if (dateStr && typeof dateStr === 'string') {
      const match = dateStr.match(/^(\d+)h$/);
      if (match) {
        const hours = parseInt(match[1]);
        console.log('Post is', hours, 'hours old');

        const maxAge = 72;
        const isRecent = hours <= maxAge;
        console.log('Is within', maxAge, 'hours?', isRecent);
      }
    }
  }

  return NextResponse.json({
    profile: `${profile.first_name} ${profile.last_name}`,
    totalPosts: posts.length,
    firstPost: posts[0] ? {
      date: posts[0].date,
      parsed_datetime: posts[0].parsed_datetime,
      text: posts[0].text?.substring(0, 50)
    } : null
  });
}