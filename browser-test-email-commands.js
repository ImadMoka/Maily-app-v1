// EMAIL FETCHING BROWSER TEST COMMAND
// Replace YOUR_TOKEN_HERE with a valid bearer token

fetch('http://localhost:3000/api/emails/recent', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer YOUR_TOKEN_HERE`
  }
})
.then(response => response.json())
.then(data => {
  console.log('✅ SUCCESS:', data)
  console.log(`📧 Found ${data.emails?.length || 0} emails from ${data.accountEmail}`)
  if (data.database) {
    console.log(`💾 Saved: ${data.database.saved}, Skipped: ${data.database.skipped}`)
  }
})
.catch(error => console.error('❌ ERROR:', error))