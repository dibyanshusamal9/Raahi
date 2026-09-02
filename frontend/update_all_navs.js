const fs = require('fs');
const path = require('path');

const files = [
  'public/RAAHI_About_Mission_Vision.html',
  'public/RAAHI_Evidence_Gap_Bridge_.html',
  'public/RAAHI_Success_Stories_Illustrated.html'
];

const sharedNavHTML = (activeIndex) => `
<!-- ================= GLOBAL NAVBAR ================= -->
<div class="navbar-scrim"></div>
<header id="global-nav-container" class="nav-container">
  <a href="/" class="nav-logo-link">
    <div class="text-fluid-logo">राही</div>
    <div class="text-fluid-logo-sub">RAAHI - Rural AI Advisor for Household Income</div>
  </a>
  <div class="mobile-menu-btn" id="mobile-menu-btn">☰</div>
  <div class="nav-links" id="nav-links">
    <a href="RAAHI_About_Mission_Vision.html"${activeIndex === 0 ? ' class="active"' : ''}>
      <span class="text-fluid-nav">राही के बारे में</span>
      <span class="text-fluid-nav-sub">About RAAHI</span>
    </a>
    <a href="RAAHI_Evidence_Gap_Bridge_.html"${activeIndex === 1 ? ' class="active"' : ''}>
      <span class="text-fluid-nav">राही कैसे मदद करता है</span>
      <span class="text-fluid-nav-sub">How RAAHI helps</span>
    </a>
    <a href="RAAHI_Success_Stories_Illustrated.html"${activeIndex === 2 ? ' class="active"' : ''}>
      <span class="text-fluid-nav">सफलता की कहानियाँ</span>
      <span class="text-fluid-nav-sub">Success stories</span>
    </a>
  </div>
</header>
<!-- ================= END NAVBAR ================= -->
`;

files.forEach((file, idx) => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove old CSS related to nav
  // We can just inject the new CSS link in <head>
  if (!content.includes('navbar.css')) {
    content = content.replace('</head>', '  <link rel="stylesheet" href="css/navbar.css">\n</head>');
  }

  // 2. Replace the entire <nav> block
  const navRegex = /<nav id="nav">[\s\S]*?<\/nav>/;
  if (navRegex.test(content)) {
    content = content.replace(navRegex, sharedNavHTML(idx));
  } else {
    // Check if the global nav is already there
    const globalNavRegex = /<!-- ================= GLOBAL NAVBAR ================= -->[\s\S]*?<!-- ================= END NAVBAR ================= -->/;
    if (globalNavRegex.test(content)) {
      content = content.replace(globalNavRegex, sharedNavHTML(idx));
    } else {
      console.warn("Could not find <nav id=\"nav\"> in " + file);
    }
  }

  // 3. Add JS script
  if (!content.includes('navbar.js')) {
    // If update_nav.js previously added an inline script, let's remove it
    const inlineScriptRegex = /<script>\s*document\.addEventListener\("DOMContentLoaded", function\(\) \{[\s\S]*?<\/script>/;
    content = content.replace(inlineScriptRegex, '');
    
    content = content.replace('</body>', '  <script src="js/navbar.js"></script>\n</body>');
  } else {
    // Remove inline script if it still exists alongside
    const inlineScriptRegex = /<script>\s*document\.addEventListener\("DOMContentLoaded", function\(\) \{[\s\S]*?<\/script>/;
    content = content.replace(inlineScriptRegex, '');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated ' + file);
});
