/**
 * HAIKU TEST - Minimal test to verify API_KEY works
 */

const axios = require('axios');

async function testHaiku(query) {
  const HAIKU_API_KEY = process.env.API_KEY;
  
  if (!HAIKU_API_KEY) {
    console.log('❌ API_KEY not set');
    return;
  }

  console.log('🧪 Testing Haiku API with query:', query);
  console.log('🔑 API Key:', HAIKU_API_KEY.substring(0, 10) + '...');

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Write a short Instagram post about: ${query}`,
          },
        ],
      },
      {
        headers: {
          'x-api-key': HAIKU_API_KEY,
          'anthropic-version': '2023-06-01',
        },
      }
    );

    console.log('✅ SUCCESS! Haiku API works');
    console.log('\n📝 Response:');
    console.log(response.data.content[0].text);
    console.log('\n📊 Tokens used:', response.data.usage.input_tokens + response.data.usage.output_tokens);
  } catch (error) {
    console.error('❌ Error:', error.response?.status || error.message);
    console.error('Details:', error.response?.data || error.message);
  }
}

// Run test
testHaiku('vans drop satoshi nakamoto streetwear');
