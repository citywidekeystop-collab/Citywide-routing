'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { randomUUID, createHmac, timingSafeEqual } = require('crypto');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://images.pexels.com'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  }
}));
app.use(express.json({ limit: '20kb' }));
// Keep the incomplete preview out of search results until real requests can be received.
app.use((req, res, next) => {
  if (!requiredLive()) res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

const requiredLive = () => process.env.ENABLE_LIVE_SUBMISSIONS === 'true'
  && !!process.env.DATABASE_URL
  && process.env.COMPLIANCE_REVIEW_COMPLETE === 'true'
  && !!process.env.ADMIN_PASSWORD;
const config = () => ({
  contactPhone: process.env.CONTACT_PHONE || '',
  contactEmail: process.env.CONTACT_EMAIL || '',
  platformName: 'Find Me a Locksmith',
  platformType: 'locksmith_referral',
  serviceRegion: process.env.SERVICE_REGION || 'Harford County, Baltimore County & Baltimore City, Maryland',
  live: requiredLive(),
  siteUrl: process.env.SITE_URL || ''
});
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

async function initializeDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_leads (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      service_category text NOT NULL,
      job_type text NOT NULL,
      property_type text NOT NULL,
      urgency text NOT NULL,
      zip_code varchar(5) NOT NULL,
      street_address text,
      city text,
      full_name text NOT NULL,
      phone text NOT NULL,
      email text,
      project_details text,
      consent_at timestamptz NOT NULL,
      marketing_opt_in boolean NOT NULL DEFAULT false,
      source text,
      status text NOT NULL DEFAULT 'new',
      assigned_to text NOT NULL DEFAULT 'unassigned',
      notification_status text NOT NULL DEFAULT 'not_configured'
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS service_leads_created_idx ON service_leads (created_at DESC)');
}

// SEO discovery: no invented canonical domain in preview mode.
const indexablePaths = ["/", "/services/locksmith-near-me", "/services/emergency-locksmith", "/services/car-lockout", "/services/house-lockout", "/services/lock-rekeying", "/services/lock-installation", "/services/car-key-replacement", "/services/commercial-locksmith"];
function publicSiteUrl() {
  const value = process.env.SITE_URL || '';
  try {
    const candidate = new URL(value);
    if (candidate.protocol !== 'https:' || !candidate.hostname || candidate.username || candidate.password) return '';
    return candidate.origin;
  } catch { return ''; }
}
app.get('/robots.txt', (_, res) => {
  const origin = publicSiteUrl();
  res.type('text/plain').send(!requiredLive() ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`);
});
app.get('/sitemap.xml', (_, res) => {
  const origin = publicSiteUrl();
  if (!origin) return res.status(503).type('text/plain').send('Set SITE_URL to the verified HTTPS website URL before publishing sitemap.');
  const escapeXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const links = indexablePaths.map(p => `<url><loc>${escapeXml(origin + p)}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${links}</urlset>`);
});

app.get('/healthz', (_, res) => res.json({ status: 'ok' }));
app.get('/api/config', (_, res) => res.json(config()));
const asText = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const allowedCategories = new Set(['locksmith']);
const allowedJobs = new Set([
  'Car lockout', 'Home lockout', 'Business lockout', 'Rekey locks',
  'Lock replacement / installation', 'Car key replacement', 'Car key programming',
  'Mailbox lock', 'Smart / keypad lock', 'Commercial lock / panic bar',
  'Access control / magnetic lock', 'Safe lockout', 'Other locksmith job'
]);
const allowedUrgencies = new Set(['Emergency / ASAP', 'Today', 'Schedule later']);
const allowedProperties = new Set(['Home', 'Vehicle', 'Office', 'Storefront', 'Other']);
const statuses = new Set(['new', 'contacted', 'booked', 'completed', 'closed']);
const assignments = new Set(['unassigned', 'licensed provider']);

async function notifyLead(lead) {
  const attempts = [];
  if (process.env.LEAD_WEBHOOK_URL) {
    const json = JSON.stringify({ event: 'service.lead.created', lead });
    const headers = { 'content-type': 'application/json' };
    if (process.env.LEAD_WEBHOOK_SECRET) {
      headers['x-lead-signature'] = createHmac('sha256', process.env.LEAD_WEBHOOK_SECRET).update(json).digest('hex');
    }
    attempts.push(fetch(process.env.LEAD_WEBHOOK_URL, { method: 'POST', headers, body: json, signal: AbortSignal.timeout(7000) })
      .then(r => { if (!r.ok) throw new Error(`Webhook HTTP ${r.status}`); }));
  }
  if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL && process.env.DISPATCH_EMAIL) {
    const body = {
      from: process.env.FROM_EMAIL, to: [process.env.DISPATCH_EMAIL],
      subject: `New ${lead.urgency} job: ${lead.jobType} (${lead.zipCode})`,
      text: `New job request (${lead.id})\nCategory: ${lead.serviceCategory}\nJob: ${lead.jobType}\nWhen: ${lead.urgency}\nProperty: ${lead.propertyType}\nCustomer: ${lead.fullName}\nPhone: ${lead.phone}\nEmail: ${lead.email}\nLocation: ${lead.streetAddress}, ${lead.city}, ${lead.zipCode}\nDetails: ${lead.projectDetails}\nSource: ${lead.source}`
    };
    attempts.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(7000)
    }).then(r => { if (!r.ok) throw new Error(`Email HTTP ${r.status}`); }));
  }
  if (!attempts.length) return 'not_configured';
  const settled = await Promise.allSettled(attempts);
  const success = settled.some(s => s.status === 'fulfilled');
  if (settled.some(s => s.status === 'rejected')) console.error('Dispatch notification error; inspect alert settings');
  return success ? 'sent' : 'failed';
}

const leadsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many requests. Please call if your issue is urgent.' } });
app.post('/api/leads', leadsLimiter, async (req, res) => {
  if (!requiredLive()) return res.status(503).json({ error: 'This is a demonstration. Real job requests are not active yet.' });
  const b = req.body || {};
  if (b.companyWebsite) return res.status(202).json({ demo: true }); // bot honeypot
  const lead = {
    id: randomUUID(),
    serviceCategory: asText(b.serviceCategory, 30),
    jobType: asText(b.jobType, 100),
    propertyType: asText(b.propertyType, 30),
    urgency: asText(b.urgency, 30),
    zipCode: asText(b.zipCode, 10),
    streetAddress: asText(b.streetAddress, 180),
    city: asText(b.city, 80),
    fullName: asText(b.fullName, 100),
    phone: asText(b.phone, 35),
    email: asText(b.email, 140),
    projectDetails: asText(b.projectDetails, 1200),
    marketingOptIn: b.marketingOptIn === true,
    source: asText(b.source, 150)
  };
  const digits = lead.phone.replace(/\D/g, '');
  if (!allowedCategories.has(lead.serviceCategory)
      || !allowedJobs.has(lead.jobType) || !allowedUrgencies.has(lead.urgency)
      || !allowedProperties.has(lead.propertyType)
      || !/^\d{5}$/.test(lead.zipCode)
      || !lead.fullName || digits.length < 10 || digits.length > 15
      || (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))
      || b.contactConsent !== true) {
    return res.status(400).json({ error: 'Please check your request details and contact permission.' });
  }
  try {
    await pool.query(`INSERT INTO service_leads
      (id, service_category, job_type, property_type, urgency, zip_code, street_address, city,
       full_name, phone, email, project_details, consent_at, marketing_opt_in, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13,$14)`,
      [lead.id, lead.serviceCategory, lead.jobType, lead.propertyType, lead.urgency,
       lead.zipCode, lead.streetAddress, lead.city, lead.fullName, lead.phone,
       lead.email, lead.projectDetails, lead.marketingOptIn, lead.source]);
    // A committed lead is never lost if an optional external alert fails.
    const status = await notifyLead(lead);
    await pool.query('UPDATE service_leads SET notification_status=$1 WHERE id=$2', [status, lead.id]).catch(() => {});
    res.status(201).json({ ok: true, requestId: lead.id.slice(0, 8), notification: status });
  } catch (err) {
    console.error('Lead save failed', err.message);
    res.status(500).json({ error: 'Could not save your request. Please call our dispatch team.' });
  }
});

function secureEquals(a, b) {
  const ba = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
function adminAuth(req, res, next) {
  if (!process.env.ADMIN_PASSWORD) return res.status(503).send('Admin access not configured.');
  const raw = req.get('authorization') || '';
  const [kind, payload] = raw.split(' ');
  let user = '', password = '';
  if (kind === 'Basic' && payload && payload.length < 1000) {
    const combo = Buffer.from(payload, 'base64').toString('utf8');
    const colon = combo.indexOf(':');
    if (colon > -1) { user = combo.slice(0, colon); password = combo.slice(colon + 1); }
  }
  if (secureEquals(user, process.env.ADMIN_USERNAME || 'dispatch') && secureEquals(password, process.env.ADMIN_PASSWORD)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Dispatch Admin"');
  return res.status(401).send('Authentication required');
}
app.get('/admin', adminAuth, (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin.html')));
app.get('/api/admin/leads', adminAuth, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const { rows } = await pool.query('SELECT * FROM service_leads ORDER BY created_at DESC LIMIT 250');
    res.json({ leads: rows });
  } catch { res.status(500).json({ error: 'Could not retrieve leads' }); }
});
app.patch('/api/admin/leads/:id', adminAuth, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const status = asText(req.body?.status, 30);
  const assignedTo = asText(req.body?.assignedTo, 30);
  if (!statuses.has(status) || !assignments.has(assignedTo)) return res.status(400).json({ error: 'Invalid status or assignment' });
  try {
    const result = await pool.query(`UPDATE service_leads SET status=$1, assigned_to=$2, updated_at=now()
      WHERE id=$3 RETURNING id, status, assigned_to`, [status, assignedTo, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Could not update request' }); }
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: 0 }));
app.use((_, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
const port = Number(process.env.PORT || 3000);
initializeDb().then(() => app.listen(port, () => {
  console.log(`Find Me a Locksmith on port ${port}. Live submissions: ${requiredLive()}`);
})).catch(err => { console.error('Database initialization failed:', err.message); process.exit(1); });
