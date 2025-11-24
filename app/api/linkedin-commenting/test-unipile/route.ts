import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Parse relative date strings like "8h", "2d", "1w" into Date objects
 */
function parseRelativeDate(dateStr: string): Date | null {
  if (typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d+)([hdwmyn]|mo)$/);
  if (!match) return null;

  const [, num, unit] = match;
  const value = parseInt(num);
  const now = new Date();

  switch (unit) {
    case 'n': // now
      return now;
    case 'h': // hours
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd': // days
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'w': // weeks
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case 'mo': // months
      const monthsAgo = new Date(now);
      monthsAgo.setMonth(monthsAgo.getMonth() - value);
      return monthsAgo;
    case 'y': // years
      const yearsAgo = new Date(now);
      yearsAgo.setFullYear(yearsAgo.getFullYear() - value);
      return yearsAgo;
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  const UNIPILE_DSN = 'api6.unipile.com:13670';
  const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
  const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

  console.log('🔍 Testing Unipile API directly...');

  try {
    // Step 1: Get profile
    const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/haywarddave?account_id=${ACCOUNT_ID}`;
    console.log('Fetching profile:', profileUrl);

    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: { 'X-API-KEY': UNIPILE_API_KEY }
    });

    if (!profileResponse.ok) {
      return NextResponse.json({
        error: `Profile fetch failed: ${profileResponse.status}`,
        details: await profileResponse.text()
      }, { status: 500 });
    }

    const profile = await profileResponse.json();
    console.log('Profile found:', profile.first_name, profile.last_name, profile.provider_id);

    // Step 2: Get posts
    const postsUrl = `https://${UNIPILE_DSN}/api/v1/users/${profile.provider_id}/posts?account_id=${ACCOUNT_ID}`;
    console.log('Fetching posts:', postsUrl);

    const postsResponse = await fetch(postsUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!postsResponse.ok) {
      return NextResponse.json({
        error: `Posts fetch failed: ${postsResponse.status}`,
        details: await postsResponse.text()
      }, { status: 500 });
    }

    const postsData = await postsResponse.json();
    const posts = postsData.items || [];

    console.log(`Found ${posts.length} total posts`);

    // Step 3: Filter posts from last 24 hours
    const maxAgeHours = 24;
    const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

    const recentPosts = posts.filter((post: any) => {
      const dateValue = post.date;
      let postDate = parseRelativeDate(dateValue);

      if (!postDate && post.parsed_datetime) {
        try {
          postDate = new Date(post.parsed_datetime);
          if (isNaN(postDate.getTime())) postDate = null;
        } catch (e) {}
      }

      if (!postDate) return false;

      return postDate >= cutoffDate;
    });

    console.log(`Found ${recentPosts.length} posts from last 24 hours`);

    // Return detailed info
    return NextResponse.json({
      success: true,
      profile: {
        name: `${profile.first_name} ${profile.last_name}`,
        provider_id: profile.provider_id
      },
      posts: {
        total: posts.length,
        recent_24h: recentPosts.length,
        samples: posts.slice(0, 3).map((p: any) => ({
          date: p.date,
          parsed_datetime: p.parsed_datetime,
          social_id: p.social_id,
          text_preview: p.text?.substring(0, 100) + '...',
          parsed_date: parseRelativeDate(p.date)?.toISOString() || p.parsed_datetime,
          age_hours: (() => {
            const pd = parseRelativeDate(p.date) || (p.parsed_datetime ? new Date(p.parsed_datetime) : null);
            return pd ? ((Date.now() - pd.getTime()) / (1000 * 60 * 60)).toFixed(1) : 'unknown';
          })()
        }))
      },
      cutoff_date: cutoffDate.toISOString(),
      current_time: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}