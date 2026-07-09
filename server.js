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

// ── WhatsApp (Twilio) ────────────────────────────────────────────────────────
async function sendWhatsApp(phone, name, orderId) {
  const sid         = process.env.TWILIO_ACCOUNT_SID;
  const token       = process.env.TWILIO_AUTH_TOKEN;
  const msgSvcSid   = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const templateSid = process.env.TWILIO_SPRINT_CONFIRM_TEMPLATE_SID;

  if (!sid || !token || !msgSvcSid || !templateSid) {
    console.log('[WA] Twilio credentials missing — skipping WhatsApp confirmation.');
    return;
  }

  const phone10 = phone.replace(/\D/g, '').slice(-10);
  const to      = `whatsapp:+91${phone10}`;
  const creds   = Buffer.from(`${sid}:${token}`).toString('base64');

  const body = new URLSearchParams({
    To:               to,
    MessagingServiceSid: msgSvcSid,
    ContentSid:       templateSid,
    ContentVariables: JSON.stringify({ '1': name.split(' ')[0], '2': orderId })
  });

  try {
    const res = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      body.toString(),
      { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log('[WA] Sent. SID:', res.data.sid);
  } catch (err) {
    console.error('[WA] Failed:', err.response?.data || err.message);
  }
}

// ── Email (Resend) ────────────────────────────────────────────────────────────
async function sendConfirmationEmail(email, name, orderId, type, amount) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY missing — skipping email confirmation.');
    return;
  }

  const firstName = name.split(' ')[0];
  const typeLabel = type === 'team' ? 'Team of 3' : 'Individual';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seat Confirmed — Founder's Sprint</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Inter',Arial,sans-serif;color:#e8e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

        <!-- Header bar -->
        <tr>
          <td style="background:#0061E3;padding:20px 32px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;">Let's Enterprise</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">The Founder's Sprint</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 24px;font-size:16px;color:#b0b0c8;line-height:1.6;">Hey <strong style="color:#e8e8f0;">${firstName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:16px;color:#b0b0c8;line-height:1.6;">Your seat is <strong style="color:#00CEC8;">confirmed</strong>. You're registered for the Founder's Sprint — one day to pitch a real growth blueprint and earn 3 Fred Again tickets.</p>

            <!-- Details block -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e1a;border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                      <span style="font-size:12px;color:#6b6b8a;text-transform:uppercase;letter-spacing:1px;">Registration ID</span><br>
                      <span style="font-size:15px;font-weight:700;color:#00CEC8;font-family:monospace;">${orderId}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                      <span style="font-size:12px;color:#6b6b8a;text-transform:uppercase;letter-spacing:1px;">Entry Type</span><br>
                      <span style="font-size:15px;color:#e8e8f0;">${typeLabel} &mdash; ₹${amount}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                      <span style="font-size:12px;color:#6b6b8a;text-transform:uppercase;letter-spacing:1px;">Sprint Date</span><br>
                      <span style="font-size:15px;color:#e8e8f0;">Saturday, July 18, 2026</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                      <span style="font-size:12px;color:#6b6b8a;text-transform:uppercase;letter-spacing:1px;">Reporting Time</span><br>
                      <span style="font-size:15px;color:#e8e8f0;">8:45 AM sharp</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="font-size:12px;color:#6b6b8a;text-transform:uppercase;letter-spacing:1px;">Venue</span><br>
                      <span style="font-size:15px;color:#e8e8f0;">Let's Enterprise Space, Pune</span>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- What's next -->
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b6b8a;">What Happens Next</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#b0b0c8;line-height:1.5;">
                  <span style="color:#0061E3;font-weight:700;">01 &mdash;</span> Your Sprint brief arrives 48 hours before the event.
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#b0b0c8;line-height:1.5;">
                  <span style="color:#0061E3;font-weight:700;">02 &mdash;</span> Arrive at Let's Enterprise Space by 8:45 AM on July 18 with a laptop and charger.
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#b0b0c8;line-height:1.5;">
                  <span style="color:#0061E3;font-weight:700;">03 &mdash;</span> Build. Pitch. Win. The top team takes 3 Fred Again tickets + ₹25K scholarship each.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:12px;color:#4a4a6a;line-height:1.6;">Questions? Reply to this email or reach us at <a href="mailto:hi@letsenterprise.in" style="color:#0061E3;text-decoration:none;">hi@letsenterprise.in</a></p>
            <p style="margin:8px 0 0;font-size:11px;color:#3a3a5a;">&copy; 2026 Let's Enterprise &bull; Pune &bull; <a href="https://eyt.letsenterprise.in/terms.html" style="color:#3a3a5a;">Terms &amp; Conditions</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await axios.post('https://api.resend.com/emails', {
      from:    "Founder's Sprint <hi@letsenterprise.in>",
      to:      [email],
      subject: `You're in, ${firstName} — Founder's Sprint · July 18 🎟️`,
      html
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    console.log('[Email] Sent. ID:', res.data.id);
  } catch (err) {
    console.error('[Email] Failed:', err.response?.data || err.message);
  }
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

    // Payment confirmed — await all post-payment tasks before responding
    // (Vercel serverless kills background work after res.json, so we must await)
    const pending = pendingRegistrations.get(orderId);
    if (pending) {
      pendingRegistrations.delete(orderId);
      const { data } = pending;
      const amount = data.type === 'team' ? 1000 : 500;

      const results = await Promise.allSettled([
        submitZohoLead(data),
        sendWhatsApp(data.lead.phone, data.lead.name, orderId),
        sendConfirmationEmail(data.lead.email, data.lead.name, orderId, data.type, amount)
      ]);
      const labels = ['Zoho', 'WhatsApp', 'Email'];
      results.forEach((r, i) => {
        if (r.status === 'rejected')
          console.error(`${labels[i]} failed for ${orderId}:`, r.reason?.message);
      });
    }

    res.json({ success: true, order_id: orderId, amount: order_amount });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Payment verification failed:', detail);
    res.status(500).json({ error: 'Verification failed.', details: detail });
  }
});

// ── Temp: notification test ──────────────────────────────────────────────────
app.get('/api/test-notifications', async (req, res) => {
  const name  = 'Test User';
  const phone = req.query.phone || '917410788808';
  const email = req.query.email || 'hi@letsenterprise.in';
  const testOrderId = 'TEST' + Date.now().toString(36).slice(-5).toUpperCase();
  const [wa, em] = await Promise.allSettled([
    sendWhatsApp(phone, name, testOrderId),
    sendConfirmationEmail(email, name, testOrderId, 'individual', 500)
  ]);
  res.json({
    order_id: testOrderId,
    whatsapp: wa.status === 'fulfilled' ? 'sent (no error)' : (wa.reason?.message || 'failed'),
    email:    em.status === 'fulfilled' ? 'sent (no error)' : (em.reason?.message || 'failed')
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`  Let's Enterprise Founder's Sprint Web Server`);
    console.log(`  Running on http://localhost:${PORT}`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;
