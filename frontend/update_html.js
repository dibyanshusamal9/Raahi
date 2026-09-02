const fs = require('fs');

const files = [
  'RAAHI_About_Mission_Vision.html',
  'RAAHI_Evidence_Gap_Bridge_.html',
  'RAAHI_Success_Stories_Illustrated.html'
];

const cssTarget = `.hero .bgimg{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center bottom;
    will-change:transform;}`;

const cssReplacement = `.hero .bgimg{position:absolute;inset:0;z-index:0;will-change:transform;}
  .hero .bgimg video{width:100%;height:100%;object-fit:cover;object-position:center bottom}`;

const extraScript = `
<script>
document.addEventListener("DOMContentLoaded", function() {
  const video = document.querySelector('.hero .bgimg video');
  if (!video) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReducedMotion.matches) {
    video.removeAttribute('autoplay');
    video.pause();
    return;
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          video.play().catch(e => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.0 });
    
    const hero = document.querySelector('.hero');
    if (hero) observer.observe(hero);
  }
});
</script>
</body>`;

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace CSS
  content = content.replace(cssTarget, cssReplacement);
  
  // Replace HTML hero background
  const regex = /style="background-image:url\('([^']+)'\)"><\/div>/;
  const replacement = `>
    <video autoplay muted loop playsinline preload="auto"
           poster="$1">
      <source src="/assets/video/raahi-hero-loop.mp4" type="video/mp4">
    </video>
  </div>`;
  content = content.replace(regex, replacement);

  // Add JS script before </body>
  content = content.replace('</body>', extraScript);

  fs.writeFileSync(file, content, 'utf8');
  console.log('Processed', file);
}
