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

  // Inject translations and language selector
  if (links) {
    const LANGUAGES = [
      { code: "en", name: "English", nativeName: "English" },
      { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
      { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
      { code: "bn", name: "Bengali", nativeName: "বাংলা" },
      { code: "brx", name: "Bodo", nativeName: "बड़ो" },
      { code: "doi", name: "Dogri", nativeName: "डोगरी" },
      { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
      { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
      { code: "ks", name: "Kashmiri", nativeName: "कॉशुर / کٲشُر" },
      { code: "gom", name: "Konkani", nativeName: "कोंकणी" },
      { code: "mai", name: "Maithili", nativeName: "मैथिली" },
      { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
      { code: "mni", name: "Manipuri", nativeName: "ꯃꯤꯇꯩꯂꯣꯟ" },
      { code: "mr", name: "Marathi", nativeName: "मराठी" },
      { code: "ne", name: "Nepali", nativeName: "नेपाली" },
      { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
      { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
      { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्" },
      { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ" },
      { code: "sd", name: "Sindhi", nativeName: "सिन्धी / سنڌي" },
      { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
      { code: "te", name: "Telugu", nativeName: "తెలుగు" },
      { code: "ur", name: "Urdu", nativeName: "اردو" }
    ];

    const t = {
      en: { about: "About RAAHI", help: "How RAAHI Helps", stories: "Success Stories", dir: "ltr" },
      hi: { about: "राही के बारे में", help: "राही कैसे मदद करता है", stories: "सफलता की कहानियाँ", dir: "ltr" },
      as: { about: "ৰাহীৰ বিষয়ে", help: "ৰাহীয়ে কেনেকৈ সহায় কৰে", stories: "সফলতাৰ কাহিনী", dir: "ltr" },
      bn: { about: "রাহী সম্পর্কে", help: "রাহী কীভাবে সাহায্য করে", stories: "সাফল্যের গল্প", dir: "ltr" },
      brx: { about: "राहीनि सोमोन्दै", help: "राहीआ माबोरै हेफाजाब होयो", stories: "जाफुंसारनायनि सल'", dir: "ltr" },
      doi: { about: "राही दे बारै च", help: "राही किदियां मदद करदा ऐ", stories: "सफलता दियां कहानियां", dir: "ltr" },
      gu: { about: "રાહી વિશે", help: "રાહી કેવી રીતે મદદ કરે છે", stories: "સફળતાની વાર્તાઓ", dir: "ltr" },
      kn: { about: "ರಾಹಿಯ ಬಗ್ಗೆ", help: "ರಾಹಿ ಹೇಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ", stories: "ಯಶಸ್ಸಿನ ಕಥೆಗಳು", dir: "ltr" },
      ks: { about: "راہی متعلق", help: "راہی کِتھ کَن چُھ مَدَتھ کَران", stories: "کامیابی ہِنٛز دَلیٖل", dir: "rtl" },
      gom: { about: "राही विशीं", help: "राही कसी मदत करता", stories: "येसाच्यो काणयो", dir: "ltr" },
      mai: { about: "राही केर विषय मे", help: "राही कोना मदद करैत अछि", stories: "सफलता केर कथा", dir: "ltr" },
      ml: { about: "രാഹിയെക്കുറിച്ച്", help: "രാഹി എങ്ങനെ സഹായിക്കുന്നു", stories: "വിജയഗാഥകൾ", dir: "ltr" },
      mni: { about: "রাহিগী মতাংদা", help: "রাহীনা কমদৌনা মতেং পাংবগে", stories: "মায়পাকপগী ৱারীশিং", dir: "ltr" },
      mr: { about: "राही बद्दल", help: "राही कशी मदत करते", stories: "यशोगाथा", dir: "ltr" },
      ne: { about: "राहीको बारेमा", help: "राहीले कसरी मद्दत गर्छ", stories: "सफलताका कथाहरू", dir: "ltr" },
      or: { about: "ରାହୀ ବିଷୟରେ", help: "ରାହୀ କିପରି ସାହାଯ୍ୟ କରେ", stories: "ସଫଳତା କାହାଣୀ", dir: "ltr" },
      pa: { about: "ਰਾਹੀ ਬਾਰੇ", help: "ਰਾਹੀ ਕਿਵੇਂ ਮਦਦ ਕਰਦਾ ਹੈ", stories: "ਸਫਲਤਾ ਦੀਆਂ ਕਹਾਣੀਆਂ", dir: "ltr" },
      sa: { about: "राहीविषये", help: "राही कथं साहाय्यं करोति", stories: "साफल्यकथाः", dir: "ltr" },
      sat: { about: "ᱨᱟᱦᱤ ᱵᱟᱵᱚᱛ", help: "ᱨᱟᱦᱤ ᱪᱮᱫ ᱞᱮᱠᱟᱭ ᱜᱚᱲᱚᱣᱟᱜᱼᱟ", stories: "ᱥᱟᱠᱥᱮᱥ ᱠᱟᱹᱦᱱᱤ", dir: "ltr" },
      sd: { about: "راهي بابت", help: "راهي ڪيئن مدد ڪري ٿي", stories: "ڪاميابي جون ڪهاڻيون", dir: "rtl" },
      ta: { about: "ராஹி பற்றி", help: "ராஹி எப்படி உதவுகிறது", stories: "வெற்றிக் கதைகள்", dir: "ltr" },
      te: { about: "రాహీ గురించి", help: "రాహీ ఎలా సహాయపడుతుంది", stories: "విజయ గాథలు", dir: "ltr" },
      ur: { about: "راہی کے بارے میں", help: "راہی کیسے مدد کرتا ہے", stories: "کامیابی کی کہانیاں", dir: "rtl" }
    };

    const currentLang = localStorage.getItem("raahi_language") || "en";
    const currentLangName = LANGUAGES.find(l => l.code === currentLang)?.nativeName || "English";
    const trans = t[currentLang] || t.en;

    // Apply global lang and direction
    document.documentElement.lang = currentLang;
    document.documentElement.dir = trans.dir;
    document.documentElement.className = "lang-" + currentLang + " dir-" + trans.dir;

    links.innerHTML = `
      <a href="/RAAHI_About_Mission_Vision.html" style="display:flex;align-items:center;">
        <span class="text-fluid-nav">${trans.about}</span>
      </a>
      <a href="/RAAHI_Evidence_Gap_Bridge_.html" style="display:flex;align-items:center;">
        <span class="text-fluid-nav">${trans.help}</span>
      </a>
      <a href="/RAAHI_Success_Stories_Illustrated.html" style="display:flex;align-items:center;">
        <span class="text-fluid-nav">${trans.stories}</span>
      </a>
      <div class="language-selector" style="position:relative;display:flex;align-items:center;">
        <button id="static-lang-btn" aria-label="Select language" class="lang-btn" style="background:transparent;border:1px solid rgba(255,255,255,0.3);color:white;padding:0.5rem 1rem;border-radius:100px;cursor:pointer;display:flex;align-items:center;gap:0.5rem;font-family:var(--font-hind);">
          ${currentLangName} ▼
        </button>
        <div id="static-lang-dropdown" class="lang-dropdown" style="display:none;position:absolute;top:100%;inset-inline-end:0;margin-top:1rem;background-color:white;color:#111;border-radius:8px;padding:0.5rem;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:0.25rem;width:min(340px, calc(100vw - 24px));max-height:60vh;overflow-y:auto;overflow-x:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.5);z-index:100;">
          ${LANGUAGES.map(l => `
            <button class="static-lang-option" data-lang="${l.code}" dir="${l.code === 'ur' || l.code === 'sd' || l.code === 'ks' ? 'rtl' : 'ltr'}" style="background:${currentLang === l.code ? '#f3f4f6' : 'transparent'};border:none;padding:0.5rem 1rem;text-align:start;cursor:pointer;border-radius:4px;font-size:0.9rem;font-family:var(--font-hind);font-weight:${currentLang === l.code ? 'bold' : 'normal'};overflow-wrap:anywhere;">
              ${l.nativeName} — ${l.name}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const langBtn = document.getElementById("static-lang-btn");
    const langDropdown = document.getElementById("static-lang-dropdown");

    langBtn.addEventListener("click", () => {
      if (langDropdown.style.display === "none") {
        langDropdown.style.display = "grid";
      } else {
        langDropdown.style.display = "none";
      }
    });

    document.querySelectorAll(".static-lang-option").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const selectedLang = e.currentTarget.getAttribute("data-lang");
        localStorage.setItem("raahi_language", selectedLang);
        window.location.reload();
      });
    });

    // We also need to process any data-i18n tags on the page if they exist
    // However, translating the whole 9MB page requires a massive dictionary.
    // The user mentioned they previously added data-i18n tags, but since they want ONE language visible,
    // we can attempt a simple dual-language hide/show if the HTML contains Hindi/English blocks.
    
    // As per user's current request, we just need to ensure the language selection persists and updates the navbar.
    // The hero content on the main page is already updated via React.
  }
});
