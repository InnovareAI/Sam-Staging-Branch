const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function test() {
  const APIFY_API_TOKEN = 'apify_api_4OLqa5gjDL8KUvehW9Bmz9ztTOhDzN1KCYzo';
  const HASHTAG_ACTOR = 'HTdyczuehykuGguHO';
  const keyword = 'GenAI';

  console.log('Fetching runs...');
  const runsListUrl = `https://api.apify.com/v2/acts/${HASHTAG_ACTOR}/runs?token=${APIFY_API_TOKEN}&limit=10`;
  const runsResponse = await fetch(runsListUrl);
  const runsData = await runsResponse.json();
  const recentRuns = runsData.data?.items || [];
  console.log(`Found ${recentRuns.length} runs`);

  const normalizeHashtag = (h) => h.replace(/^#+/, '').toLowerCase();
  const keywordNormalized = normalizeHashtag(keyword);
  const twoHoursMs = 2 * 60 * 60 * 1000;

  for (const run of recentRuns) {
    const runAge = Date.now() - new Date(run.startedAt).getTime();
    console.log(`\nRun ${run.id}: ${run.status}, age ${Math.round(runAge/60000)}min`);

    if (run.status === 'RUNNING' || run.status === 'READY') {
      console.log('  → Skipping (still running)');
      continue;
    }

    if (runAge >= twoHoursMs) {
      console.log('  → Skipping (older than 2 hours)');
      continue;
    }

    if (run.status !== 'SUCCEEDED' && run.status !== 'ABORTED') {
      console.log(`  → Skipping (status ${run.status})`);
      continue;
    }

    // Check input
    const inputUrl = `https://api.apify.com/v2/key-value-stores/${run.defaultKeyValueStoreId}/records/INPUT?token=${APIFY_API_TOKEN}`;
    const inputResponse = await fetch(inputUrl);
    const inputData = await inputResponse.json();

    let runHashtags = [];
    if (inputData.hashtags && Array.isArray(inputData.hashtags)) {
      runHashtags = inputData.hashtags;
    } else if (inputData.hashtag) {
      runHashtags = [inputData.hashtag];
    } else if (inputData.keyword) {
      runHashtags = [inputData.keyword];
    }

    const runHashtagsNormalized = runHashtags.map(normalizeHashtag);
    console.log(`  Input: ${JSON.stringify(runHashtags)} → ${JSON.stringify(runHashtagsNormalized)}`);
    console.log(`  Looking for: ${keywordNormalized}`);
    console.log(`  Match: ${runHashtagsNormalized.includes(keywordNormalized)}`);

    if (runHashtagsNormalized.includes(keywordNormalized)) {
      console.log('  → FOUND MATCHING RUN!');

      // Check dataset
      const datasetInfoUrl = `https://api.apify.com/v2/datasets/${run.defaultDatasetId}?token=${APIFY_API_TOKEN}`;
      const dsResponse = await fetch(datasetInfoUrl);
      const dsInfo = await dsResponse.json();
      console.log(`  Dataset items: ${dsInfo.data?.itemCount}`);

      // Fetch actual items
      console.log('\nFetching dataset items...');
      const itemsUrl = `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${APIFY_API_TOKEN}`;
      const itemsResponse = await fetch(itemsUrl);
      const data = await itemsResponse.json();

      const rawPosts = Array.isArray(data) ? data : [];
      console.log(`Raw posts: ${rawPosts.length}`);

      // Filter by hashtag
      const matchingPosts = rawPosts.filter((p) => {
        const postHashtag = p.hashtag ? normalizeHashtag(p.hashtag) : '';
        return postHashtag === keywordNormalized;
      });
      console.log(`Posts matching #${keyword}: ${matchingPosts.length}`);

      // Take first 10
      const posts = matchingPosts.slice(0, 10);
      console.log(`Posts to process: ${posts.length}`);

      // Show first few
      console.log('\nSample posts:');
      for (const p of posts.slice(0, 3)) {
        console.log(`  ${p.author_name} - ${p.hashtag} - ${p.post_url?.substring(0, 60)}...`);
      }

      break;
    }
  }
}

test().catch(console.error);
