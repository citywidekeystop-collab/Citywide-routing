'use strict';
const locksmithJobs = [
  'Car lockout', 'Home lockout', 'Business lockout', 'Rekey locks',
  'Lock replacement / installation', 'Car key replacement', 'Car key programming',
  'Mailbox lock', 'Smart / keypad lock', 'Commercial lock / panic bar',
  'Access control / magnetic lock', 'Safe lockout', 'Other locksmith job'
];
const form = document.getElementById('leadForm');
const state = { serviceCategory: 'locksmith', jobType: '', urgency: 'Emergency / ASAP' };
let step = 1;
let isLive = false;
function renderJobs() {
  const target = document.getElementById('jobChoices');
  target.replaceChildren();
  locksmithJobs.forEach(name => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'job-choice' + (state.jobType === name ? ' selected' : '');
    btn.textContent = name; btn.dataset.job = name;
    btn.setAttribute('aria-pressed', String(state.jobType === name));
    btn.addEventListener('click', () => { state.jobType = name; renderJobs(); showError(step,''); });
    target.append(btn);
  });
}
function selectUrgency(urgency) {
  state.urgency = urgency;
  document.querySelectorAll('[data-urgency]').forEach(b => {
    const selected = b.dataset.urgency === urgency;
    b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected));
  });
}
function showError(n, message) { document.getElementById(`error${n}`).textContent = message; }
function validate(n) {
  if (n === 1 && !state.jobType) return 'Choose the job type to continue.';
  if (n === 2 && !/^\d{5}$/.test(document.getElementById('zip').value.trim())) return 'Enter a valid 5-digit ZIP code.';
  if (n === 3) {
    if (!document.getElementById('fullName').value.trim()) return 'Enter your name.';
    const digits = document.getElementById('phone').value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return 'Enter a valid phone number.';
    const email = document.getElementById('email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email or leave it blank.';
    if (!document.getElementById('contactConsent').checked) return 'Please agree to be contacted about this request.';
  }
  return '';
}
function goToStep(n) {
  if (n > step) { const error = validate(step); if (error) return showError(step,error); }
  step = n;
  document.querySelectorAll('.form-step').forEach(el => {
    const active = Number(el.dataset.formStep) === step;
    el.classList.toggle('active', active); el.setAttribute('aria-hidden', String(!active));
  });
  document.getElementById('stepLabel').textContent = `Step ${step} of 3`;
  document.getElementById('stepTitle').textContent = ['Select a locksmith job','Tell us where & when','Your contact details'][step - 1];
  document.getElementById('progressFill').style.width = `${step / 3 * 100}%`;
  document.getElementById('requestTitle').textContent = ['What do you need fixed?','Where do you need help?','How can we reach you?'][step - 1];
  showError(step,'');
}
document.querySelectorAll('[data-urgency]').forEach(b => b.addEventListener('click', () => selectUrgency(b.dataset.urgency)));
document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => goToStep(Number(b.dataset.next))));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => goToStep(Number(b.dataset.back))));

// Service cards preselect the matching intake path.
document.querySelectorAll('[data-prefill]').forEach(b => b.addEventListener('click', () => {
  state.jobType = b.dataset.prefill;
  renderJobs(); goToStep(1);
  document.getElementById('request').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

function readField(id) { return document.getElementById(id).value.trim(); }
form.addEventListener('submit', async e => {
  e.preventDefault();
  const error = validate(3);
  if (error) return showError(3,error);
  const submit = document.getElementById('submitBtn');
  if (!isLive) {
    return showResult('This is a working preview', 'Your form is filled in, but no personal information was sent or stored. The database, contact details, dispatch alerts and legal compliance review must be completed before accepting real requests.');
  }
  submit.disabled = true; submit.textContent = 'Sending request…';
  const url = new URLSearchParams(location.search);
  const source = [url.get('utm_source'),url.get('utm_campaign')].filter(Boolean).join(' / ').slice(0, 150) || 'website';
  const data = {
    ...state,
    zipCode: readField('zip'), propertyType: readField('property'), streetAddress: readField('street'),
    city: readField('city'), fullName: readField('fullName'), phone: readField('phone'), email: readField('email'),
    projectDetails: readField('details'), contactConsent: document.getElementById('contactConsent').checked,
    marketingOptIn: document.getElementById('marketingOptIn').checked,
    companyWebsite: readField('companyWebsite'), source
  };
  try {
    const response = await fetch('/api/leads', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Could not send request.');
    showResult('Your request has been received!', `Request #${result.requestId}. Our team will review the details and contact you to discuss the next steps. This does not confirm a booking or price.`);
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'service_request_submitted', service: state.serviceCategory });
  } catch (err) { showError(3, err.message || 'Something went wrong. Please try again.'); }
  finally { submit.disabled = false; submit.textContent = 'Send request →'; }
});
function showResult(title, message) {
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultMessage').textContent = message;
  form.hidden = true; document.getElementById('resultPanel').hidden = false;
  document.querySelector('.steps-head').hidden = true;
  document.querySelector('.progress-rail').hidden = true;
}
document.getElementById('newRequest').addEventListener('click', () => {
  form.reset(); state.jobType = ''; selectUrgency('Emergency / ASAP');
  form.hidden = false; document.getElementById('resultPanel').hidden = true;
  document.querySelector('.steps-head').hidden = false;
  document.querySelector('.progress-rail').hidden = false; goToStep(1);
});
const selectedJob = new URLSearchParams(location.search).get('job');
if (selectedJob && locksmithJobs.includes(selectedJob)) state.jobType = selectedJob;
renderJobs(); document.getElementById('year').textContent = String(new Date().getFullYear());
fetch('/api/config').then(r => r.json()).then(config => {
  isLive = !!config.live;
  document.getElementById('demoRibbon').hidden = isLive;
  if (config.contactPhone) {
    const link = document.getElementById('phoneLink');
    link.hidden = false; link.href = `tel:${config.contactPhone.replace(/[^\d+]/g,'')}`;
    link.textContent = `Call dispatch: ${config.contactPhone}`;
  }
}).catch(() => { document.getElementById('demoRibbon').hidden = false; });
