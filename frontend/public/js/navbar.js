// navbar.js - Unified Navbar JS for RAAHI static HTML pages
document.addEventListener("DOMContentLoaded", function() {
  const btn = document.getElementById("mobile-menu-btn");
  const links = document.getElementById("nav-links");
  const navContainer = document.getElementById("global-nav-container");

  // Mobile menu toggle
  if (btn && links) {
    btn.addEventListener("click", () => {
      links.classList.toggle("open");
    });
  }

  // Scroll darkening effect
  if (navContainer) {
    const handleScroll = () => {
      // Calculate opacity similarly to the framer-motion approach in Next.js
      // from 0 to 50 pixels scrolled, it goes from 0 to 0.8 opacity.
      // We can just add a CSS class when scrolled past a small threshold, or apply exact style.
      const scrollY = window.scrollY;
      
      if (scrollY > 10) {
        navContainer.classList.add("scrolled");
      } else {
        navContainer.classList.remove("scrolled");
      }
    };
    
    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Trigger once on load
  }
});
