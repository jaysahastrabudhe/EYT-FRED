require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Zoho OAuth & API domains
const ZOHO_ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.com';
const ZOHO_API_DOMAIN = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';

let cachedAccessToken = null;
let tokenExpiryTime = null;

// Function to refresh access token
async function getZohoAccessToken() {
  const currentTime = Date.now();
  
  // If token is cached and not expired, return it (with a 5-minute buffer)
  if (cachedAccessToken && tokenExpiryTime && currentTime < (tokenExpiryTime - 5 * 60 * 1000)) {
    return cachedAccessToken;
  }

  console.log('Refreshing Zoho Access Token...');
  try {
    const response = await axios.post(`${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token`, null, {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      }
    });

    if (response.data.access_token) {
      cachedAccessToken = response.data.access_token;
      // Expires in seconds (usually 3600), convert to ms and set timestamp
      const expiresInMs = (response.data.expires_in || 3600) * 1000;
      tokenExpiryTime = currentTime + expiresInMs;
      console.log('Successfully refreshed Zoho Access Token.');
      return cachedAccessToken;
    } else {
      throw new Error(`Failed to refresh token: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('Error refreshing Zoho token:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// API endpoint for lead registration
app.post('/api/register', async (req, res) => {
  console.log('\n--- Incoming Lead Registration Request ---');
  const data = req.body;
  
  if (!data || !data.lead || !data.lead.name || !data.lead.email) {
    return res.status(400).json({ error: 'Missing required lead details (name, email).' });
  }

  try {
    const accessToken = await getZohoAccessToken();

    // Map lead builder full name into First/Last Name for standard Zoho fields
    const nameParts = data.lead.name.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts.pop() : data.lead.name;
    const firstName = nameParts.join(' ');

    // Compile Description tag if team registration
    let descriptionText = `High School Stream: ${data.lead.stream || 'N/A'}\n`;
    if (data.type === 'team' && data.teammates) {
      descriptionText += `\nTEAM REGISTRATION:\n`;
      data.teammates.forEach((tm, idx) => {
        descriptionText += `\nTeammate ${idx + 2}:\n  Name: ${tm.name}\n  Email: ${tm.email}\n  Phone: ${tm.phone}\n  DOB: ${tm.dob}\n`;
      });
    }

    // Map data to Zoho Lead schema fields
    const zohoLead = {
      First_Name: firstName || undefined,
      Last_Name: lastName,
      Email: data.lead.email,
      Phone: data.lead.phone,
      COB_Date_Of_Birth: data.lead.dob,
      Registration_Type: data.type === 'team' ? 'Team' : 'Individual',
      Lead_Source: 'Founder Sprint Landing Page',
      Lead_Status: 'Sprint-Fee-Paid',
      Description: descriptionText,
      Tag: [
        { name: 'Sprint-Fee-Paid' },
        { name: 'Age-Verified' }
      ]
    };

    console.log('Submitting Lead to Zoho CRM API:', JSON.stringify(zohoLead, null, 2));

    const response = await axios.post(`${ZOHO_API_DOMAIN}/crm/v2/Leads`, {
      data: [zohoLead]
    }, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Zoho CRM Response Status:', response.status);
    console.log('Zoho CRM Response Data:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.data && response.data.data[0]) {
      const leadStatus = response.data.data[0];
      if (leadStatus.status === 'success') {
        console.log('Success! Lead created in Zoho CRM. Lead ID:', leadStatus.details.id);
        return res.status(200).json({ success: true, id: leadStatus.details.id });
      } else {
        console.error('Zoho CRM rejected the payload:', leadStatus);
        return res.status(500).json({ error: 'Zoho API error', details: leadStatus });
      }
    }

    res.status(500).json({ error: 'Unexpected response from Zoho API.' });
  } catch (error) {
    const errorData = error.response ? error.response.data : error.message;
    console.error('Error submitting lead to Zoho CRM:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ error: 'Server error integration with Zoho CRM.', details: errorData });
  }
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  Let's Enterprise Founder's Sprint Web Server`);
  console.log(`  Running locally on http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
