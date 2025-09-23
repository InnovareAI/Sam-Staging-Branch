import { NextRequest, NextResponse } from 'next/server';
import { createPostmarkHelper } from '@/lib/postmark-helper';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Postmark dual account integration...');
    
    const results = {
      innovareai: { helper: null, test: null },
      cubedai: { helper: null, test: null },
      summary: {}
    };

    // Test InnovareAI helper
    console.log('Testing InnovareAI helper...');
    const innovareHelper = createPostmarkHelper('InnovareAI');
    
    if (innovareHelper) {
      results.innovareai.helper = 'Created successfully';
      
      // Test suppression check
      const suppressionCheck = await innovareHelper.checkEmailSuppression('test@example.com');
      
      // Test email sending
      const emailResult = await innovareHelper.sendEmailSafely({
        To: 'tl@innovareai.com',
        Subject: 'API Test - InnovareAI Postmark Helper',
        HtmlBody: '<h2>🧪 API Test</h2><p>Testing InnovareAI Postmark helper via API endpoint.</p>',
        TextBody: 'API Test - Testing InnovareAI Postmark helper via API endpoint.'
      });
      
      results.innovareai.test = {
        suppression: suppressionCheck,
        email: emailResult
      };
    } else {
      results.innovareai.helper = 'Failed to create helper';
    }

    // Test 3CubedAI helper
    console.log('Testing 3CubedAI helper...');
    const cubedHelper = createPostmarkHelper('3cubedai');
    
    if (cubedHelper) {
      results.cubedai.helper = 'Created successfully';
      
      // Test suppression check
      const suppressionCheck = await cubedHelper.checkEmailSuppression('test@example.com');
      
      // Test email sending
      const emailResult = await cubedHelper.sendEmailSafely({
        To: 'tl@innovareai.com',
        Subject: 'API Test - 3CubedAI Postmark Helper',
        HtmlBody: '<h2>🧪 API Test</h2><p>Testing 3CubedAI Postmark helper via API endpoint.</p>',
        TextBody: 'API Test - Testing 3CubedAI Postmark helper via API endpoint.'
      });
      
      results.cubedai.test = {
        suppression: suppressionCheck,
        email: emailResult
      };
    } else {
      results.cubedai.helper = 'Failed to create helper';
    }

    // Test bulk operations with InnovareAI helper
    if (innovareHelper) {
      console.log('Testing bulk suppression check...');
      const testEmails = [
        'test1@example.com',
        'test2@example.com',
        'tl@innovareai.com'
      ];
      
      const bulkCheck = await innovareHelper.bulkCheckSuppressions(testEmails);
      results.summary.bulkCheck = Object.fromEntries(bulkCheck);
      
      // Test helper utility functions
      const testEmailData = innovareHelper.generateTestEmails();
      results.summary.testEmails = testEmailData;
    }

    // Generate summary
    results.summary.status = {
      innovareai: {
        helper: !!innovareHelper,
        email: results.innovareai.test?.email?.success || false
      },
      cubedai: {
        helper: !!cubedHelper,
        email: results.cubedai.test?.email?.success || false
      }
    };

    results.summary.configuration = {
      innovareai: {
        from: 'sp@innovareai.com',
        contact: 'sp@innovareai.com',
        company: 'InnovareAI',
        contactName: 'Sarah Powell'
      },
      cubedai: {
        from: 'sophia@3cubed.ai', 
        contact: 'sophia@3cubed.ai',
        company: '3CubedAI',
        contactName: 'Sophia Caldwell'
      }
    };

    console.log('✅ Postmark dual account test completed');

    return NextResponse.json(results);

  } catch (error) {
    console.error('❌ Postmark test error:', error);
    return NextResponse.json(
      { error: 'Postmark test failed', details: error.message },
      { status: 500 }
    );
  }
}