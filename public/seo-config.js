'use strict';
// Show verified provider credentials from the SAME server configuration as the intake form.
fetch('/api/config').then(response => response.json()).then(data => {
  const ribbon = document.getElementById('demoRibbon');
  if (ribbon) ribbon.hidden = !!data.live;
  const license = document.getElementById('licenseText');
  if (license && data.licenseNumber && data.providerName) {
    license.textContent = `Service inquiries handled by or routed through ${data.providerName}. Maryland locksmith license #${data.licenseNumber}.`;
  }
}).catch(() => {
  const ribbon = document.getElementById('demoRibbon');
  if (ribbon) ribbon.hidden = false;
});
