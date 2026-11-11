'use strict';
// Show only preview/live status; the referral platform is not a licensed locksmith.
fetch('/api/config').then(response => response.json()).then(data => {
  const ribbon = document.getElementById('demoRibbon');
  if (ribbon) ribbon.hidden = !!data.live;
}).catch(() => {
  const ribbon = document.getElementById('demoRibbon');
  if (ribbon) ribbon.hidden = false;
});
