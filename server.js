require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Zoho ────────────────────────────────────────────────────────────────────
const ZOHO_ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.com';
const ZOHO_API_DOMAIN      = process.env.ZOHO_API_DOMAIN      || 'https://www.zohoapis.com';

let cachedAccessToken = null;
let tokenExpiryTime   = null;

async function getZohoAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && tokenExpiryTime && now < tokenExpiryTime - 5 * 60 * 1000) {
    return cachedAccessToken;
  }
  const response = await axios.post(`${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token`, null, {
    params: {
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id:     process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type:    'refresh_token'
    }
  });
  if (!response.data.access_token) throw new Error('Zoho token refresh failed');
  cachedAccessToken = response.data.access_token;
  tokenExpiryTime   = now + (response.data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

async function submitZohoLead(data) {
  const accessToken = await getZohoAccessToken();
  const nameParts   = data.lead.name.trim().split(' ');
  const lastName    = nameParts.length > 1 ? nameParts.pop() : data.lead.name;
  const firstName   = nameParts.join(' ');

  let descriptionText = `High School Stream: ${data.lead.stream || 'N/A'}\n`;
  if (data.type === 'team' && data.teammates) {
    descriptionText += '\nTEAM REGISTRATION:\n';
    data.teammates.forEach((tm, i) => {
      descriptionText += `\nTeammate ${i + 2}:\n  Name: ${tm.name}\n  Email: ${tm.email}\n  Phone: ${tm.phone}\n  DOB: ${tm.dob}\n`;
    });
  }

  const zohoLead = {
    First_Name:        firstName || undefined,
    Last_Name:         lastName,
    Email:             data.lead.email,
    Phone:             data.lead.phone,
    COB_Date_Of_Birth: data.lead.dob,
    Registration_Type: data.type === 'team' ? 'Team' : 'Individual',
    Lead_Source:       'Founder Sprint Landing Page',
    Lead_Status:       'Sprint-Fee-Paid',
    Description:       descriptionText,
    Tag:               [{ name: 'Sprint-Fee-Paid' }, { name: 'Age-Verified' }]
  };

  const response = await axios.post(
    `${ZOHO_API_DOMAIN}/crm/v2/Leads`,
    { data: [zohoLead] },
    { headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } }
  );

  const result = response.data?.data?.[0];
  if (result?.status !== 'success') throw new Error(JSON.stringify(result));
  console.log('Zoho lead created:', result.details.id);
  return result.details.id;
}

// ── Cashfree ─────────────────────────────────────────────────────────────────
const CF_BASE = 'https://api.cashfree.com/pg';
const CF_HEADERS = () => ({
  'x-api-version':  '2023-08-01',
  'x-client-id':    process.env.CF_APP_ID,
  'x-client-secret': process.env.CF_SECRET_KEY,
  'Content-Type':   'application/json'
});

// In-memory store: orderId → { registrationData, createdAt }
const pendingRegistrations = new Map();

// Purge entries older than 2 hours
function purgeStalePending() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  pendingRegistrations.forEach((val, key) => {
    if (val.createdAt < cutoff) pendingRegistrations.delete(key);
  });
}

// POST /api/create-order
app.post('/api/create-order', async (req, res) => {
  const data = req.body;
  if (!data?.lead?.name || !data?.lead?.email || !data?.lead?.phone) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  purgeStalePending();

  const amount   = data.type === 'team' ? 1000 : 500;
  const orderId  = `FSR${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const origin   = req.headers.origin || `${req.protocol}://${req.headers.host}`;
  const phone    = data.lead.phone.replace(/\D/g, '').slice(-10);
  const customerId = data.lead.email.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50);

  try {
    const cfRes = await axios.post(`${CF_BASE}/orders`, {
      order_id:       orderId,
      order_amount:   amount,
      order_currency: 'INR',
      customer_details: {
        customer_id:    customerId,
        customer_name:  data.lead.name,
        customer_email: data.lead.email,
        customer_phone: phone
      },
      order_meta: {
        return_url: `${origin}/?order_id=${orderId}`
      }
    }, { headers: CF_HEADERS() });

    pendingRegistrations.set(orderId, { data, createdAt: Date.now() });

    res.json({
      payment_session_id: cfRes.data.payment_session_id,
      order_id: orderId
    });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Cashfree order creation failed:', detail);
    res.status(500).json({ error: 'Could not create payment order.', details: detail });
  }
});

// GET /api/verify-order/:orderId
app.get('/api/verify-order/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const cfRes = await axios.get(`${CF_BASE}/orders/${orderId}`, { headers: CF_HEADERS() });
    const { order_status, order_amount } = cfRes.data;

    if (order_status !== 'PAID') {
      return res.json({ success: false, status: order_status });
    }

    // Payment confirmed — submit to Zoho in background, don't block response
    const pending = pendingRegistrations.get(orderId);
    if (pending) {
      pendingRegistrations.delete(orderId);
      submitZohoLead(pending.data).catch(err =>
        console.error(`Zoho submission failed for ${orderId}:`, err.message)
      );
    }

    res.json({ success: true, order_id: orderId, amount: order_amount });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Payment verification failed:', detail);
    res.status(500).json({ error: 'Verification failed.', details: detail });
  }
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  Let's Enterprise Founder's Sprint Web Server`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
