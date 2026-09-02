const fs = require('fs');

const files = [
  'RAAHI_About_Mission_Vision.html',
  'RAAHI_Evidence_Gap_Bridge_.html',
  'RAAHI_Success_Stories_Illustrated.html'
];

const sharedNavLinksHTML = (activeIndex) => `
  <div class="menu-toggle" id="mobile-menu-btn">☰</div>
  <div class="navlinks" id="nav-links">
    <a href="RAAHI_About_Mission_Vision.html"${activeIndex === 0 ? ' class="active"' : ''}><span class="h dev">राही के बारे में</span><span class="e">About RAAHI</span></a>
    <a href="RAAHI_Evidence_Gap_Bridge_.html"${activeIndex === 1 ? ' class="active"' : ''}><span class="h dev">राही कैसे मदद करता है</span><span class="e">How RAAHI helps</span></a>
    <a href="RAAHI_Success_Stories_Illustrated.html"${activeIndex === 2 ? ' class="active"' : ''}><span class="h dev">सफलता की कहानियाँ</span><span class="e">Success stories</span></a>
  </div>
`;

const jsSnippet = `
<script>
document.addEventListener("DOMContentLoaded", function() {
  const btn = document.getElementById("mobile-menu-btn");
  const links = document.getElementById("nav-links");
  if(btn && links) {
    btn.addEventListener("click", () => {
      links.classList.toggle("open");
    });
  }
});
</script>
</body>`;

files.forEach((file, idx) => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace CSS
  content = content.replace(
    /\.navlinks a:hover\{color:var\(--gold\)\}\s*@media\(max-width:760px\)\{\.navlinks\{display:none\}\}/,
    `.navlinks a:hover, .navlinks a.active{color:var(--gold)}
  .menu-toggle { display: none; font-size: 26px; color: #fff; cursor: pointer; transition: .35s; user-select: none; }
  nav.solid .menu-toggle { color: var(--ink); }
  @media(max-width:760px){
    .menu-toggle { display: block; }
    .navlinks {
      position: absolute; top: 66px; left: 0; right: 0;
      background: rgba(251,246,236,.96); backdrop-filter: blur(10px);
      flex-direction: column; padding: 20px 26px; gap: 20px;
      box-shadow: 0 10px 20px rgba(60,45,20,.1);
      display: none;
    }
    .navlinks.open { display: flex; }
    .navlinks a { color: var(--ink); }
  }`
  );

  // Replace HTML navlinks
  const htmlRegex = /<div class="navlinks">[\s\S]*?<\/div>\s*<\/div><\/nav>/;
  content = content.replace(htmlRegex, sharedNavLinksHTML(idx) + '\n</div></nav>');

  // Add JS before </body>
  content = content.replace(/<\/body>/, jsSnippet);

  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated ' + file);
});
