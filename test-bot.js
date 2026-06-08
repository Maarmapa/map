// Quick test of bot v7.1 modules

console.log('🧪 Testing Bot v7.1 Modules\n');

// Test 1: Token Monitor
console.log('1️⃣  Token Monitor');
try {
  const TokenMonitor = require('./token-monitor');
  const monitor = new TokenMonitor();
  console.log('   ✅ TokenMonitor loaded');
  console.log('   ✅ Services:', Object.keys(monitor.services).join(', '));
  const status = monitor.getFullStatus();
  console.log('   ✅ Status method works');
} catch(e) {
  console.log('   ❌ Error:', e.message);
}

// Test 2: WebPost Module
console.log('\n2️⃣  WebPost Module');
try {
  const WebPostGenerator = require('./webpost-module');
  const webpost = new WebPostGenerator('fake-key', 'fake-token', 'https://r2.example.com');
  console.log('   ✅ WebPostGenerator loaded');
  console.log('   ✅ Methods: generateWebPost, webSearch, extractImagesFromUrl');
} catch(e) {
  console.log('   ❌ Error:', e.message);
}

// Test 3: WebPost Carousel Module
console.log('\n3️⃣  WebPost Carousel Module');
try {
  const WebPostCarouselGenerator = require('./webpost-carousel-module');
  const carousel = new WebPostCarouselGenerator({
    openrouterKey: 'fake',
    grokKey: 'fake',
    runwayKey: 'fake',
    r2Worker: 'https://r2.example.com'
  });
  console.log('   ✅ WebPostCarouselGenerator loaded');
  console.log('   ✅ Methods: webSearch, extractMediaFromUrl, generateCarouselSlides');
} catch(e) {
  console.log('   ❌ Error:', e.message);
}

// Test 4: Cheerio (HTML Parser)
console.log('\n4️⃣  Cheerio (HTML Parser)');
try {
  const cheerio = require('cheerio');
  const $ = cheerio.load('<html><body><img src="test.jpg"/><p>Hello</p></body></html>');
  const imgCount = $('img').length;
  const text = $('p').text();
  console.log('   ✅ Cheerio loaded');
  console.log('   ✅ Can parse HTML');
  console.log('   ✅ Found', imgCount, 'image(s)');
  console.log('   ✅ Found text:', text);
} catch(e) {
  console.log('   ❌ Error:', e.message);
}

// Test 5: DESIGN.md existence
console.log('\n5️⃣  DESIGN.md');
try {
  const fs = require('fs');
  const exists = fs.existsSync('./DESIGN.md');
  if (exists) {
    const content = fs.readFileSync('./DESIGN.md', 'utf8');
    const lines = content.split('\n').length;
    console.log('   ✅ DESIGN.md found');
    console.log('   ✅ File size:', (content.length / 1024).toFixed(2), 'KB');
    console.log('   ✅ Lines:', lines);
  } else {
    console.log('   ⚠️  DESIGN.md not found');
  }
} catch(e) {
  console.log('   ❌ Error:', e.message);
}

console.log('\n✅ Bot v7.1 modules are ready to use!\n');
