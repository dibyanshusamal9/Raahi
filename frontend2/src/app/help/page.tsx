
"use client";
import React, { useEffect, useRef, useState } from 'react';
import './styles.css';
import PageLoader from '@/components/PageLoader';
import CallExperience from '@/components/CallExperience';

export default function HelpPage() {
  const [isCallActive, setIsCallActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Scroll reveal logic for .rv elements
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    document.querySelectorAll('.rv').forEach(el => observer.observe(el));
    
    // Parallax logic for hero image
    const heroimg = document.getElementById('heroimg');
    const onScroll = () => {
      if(heroimg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        heroimg.style.transform = 'translateY(' + (window.scrollY * 0.18) + 'px)';
      }
    };
    window.addEventListener('scroll', onScroll);
    onScroll();

    // Video autoplay logic
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
    }
    
    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div id="help-page" className="raahi-static-page" dir="ltr">
      <PageLoader />
<canvas id="bg3d"></canvas>

<div className="app">



<header className="hero">
  <div className="bgimg" id="heroimg">
    <video ref={videoRef} muted loop preload="auto" poster="data:image/jpeg;base64,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" autoPlay playsInline>
      <source src="/assets/video/raahi-hero-loop.mp4" type="video/mp4" />
    </video>
  </div>
  <div className="veil"></div>
  <div className="inner"><div className="wrap">
    <h1>
      <div className="dev" style={{ display: 'block' }}>राही कैसे मदद करता है</div>
      <div className="en" style={{ display: 'block' }}>How RAAHI Helps</div>
    </h1>
    <a className="cta" href="#" onClick={(e) => { e.preventDefault(); setIsCallActive(true); }}><svg className="cta-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"></circle></svg>Call RAAHI toll-free — 1800-XXXXXXX</a>
  </div></div>
  <div className="scrollhint dev">नीचे देखें ↓</div>
</header>


<section className="paper-sec" id="facts"><div className="wrap">
  <div className="kick rv">THE EVIDENCE · सबूत</div>
  <h2 className="rv"><span className="dev">समस्या कितनी बड़ी है?</span>The opportunity is large. So is the access gap.</h2>
  <p className="lead rv d1 narrow">These figures use different populations and dates and must not be added together. Together they show why better discovery, profiling and matching matter.</p>
  <div className="stats rv d1" style={{"marginTop":"42px"}}>
    <div className="s"><div className="n">20.14 Cr</div><div className="l"><b>Scheduled Caste population</b><br />Census 2011 · 16.6% of India<br /><a className="cite" href="https://censusindia.gov.in/nada/index.php/catalog/5048/study-description" target="_blank">Open exact Census PCA (SC) dataset record · 2011</a></div></div>
    <div className="s"><div className="n">78.86 L</div><div className="l"><b>New NCS jobseekers</b><br />Registered during FY 2025–26 as on 20 Jan 2026<br /><a className="cite" href="https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2223849&reg=3&lang=1" target="_blank">Official PIB release · 5 Feb 2026</a></div></div>
    <div className="s"><div className="n">3.43 Cr</div><div className="l"><b>NCS vacancies mobilised</b><br />During FY 2025–26 as on 20 Jan 2026<br /><a className="cite" href="https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2223849&reg=3&lang=1" target="_blank">Official PIB release · 5 Feb 2026</a></div></div>
    <div className="s"><div className="n">43%</div><div className="l"><b>Reported PMKVY placement</b><br />Tracked STT-certified cohorts through 3.0<br /><a className="cite" href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2115272&reg=3&lang=2" target="_blank">MSDE / PIB · 26 Mar 2025</a></div></div>
  </div>
  <div className="data-note rv">There is no defensible current national headcount of “unemployed SC individuals” in the cited sources. PLFS unemployment rates and the Census 2011 SC population describe different periods and definitions. The scenario estimate below is therefore labelled as a model—not an official count.</div>
</div></section>


<section className="band" id="gap"><div className="wrap">
  <div className="kick rv">THE MISSING CONNECTION · छूटी हुई कड़ी</div>
  <h2 className="rv"><span className="dev">नौकरियाँ हैं। लोग हैं। फिर भी मेल नहीं होता।</span>A vacancy is not a livelihood until the right person can reach it.</h2>
  <div className="bridge-compare rv d1">
    <article><span className="bc-icon">◫</span><h3>What the system publishes</h3><ul><li>Course codes and eligibility rules</li><li>Training-centre and vacancy listings</li><li>Formal forms and occupational categories</li><li>Scheme and subsidy guidelines</li></ul></article>
    <div className="gap-orb">GAP</div>
    <article className="human"><span className="bc-icon">◉</span><h3>What a beneficiary says</h3><ul><li>“I studied till class 8.”</li><li>“I cannot travel far.”</li><li>“My family has always woven cloth.”</li><li>“I need to earn from home.”</li></ul></article>
  </div>
  <div className="access-bars rv d1">
    <div><span>Rural households estimated digitally literate</span><b>25%</b><i><u style={{"width":"25%"}}></u></i><a className="cite" href="https://www.ideasforindia.in/topics/governance/the-digital-dream-upskilling-india-for-the-future" target="_blank">NSS 75th round analysis · Ideas for India, 2021</a></div>
    <div><span>Rural women owning a phone they use themselves</span><b>46.6%</b><i><u style={{"width":"46.6%"}}></u></i><a className="cite" href="https://india.unfpa.org/sites/default/files/pub-pdf/analytical_paper_6_-_asset_ownership_among_women_in_india_-_insights_from_nfhs_data_-_final_1.pdf" target="_blank">UNFPA analysis of NFHS-5 · 2023</a></div>
    <div><span>Internet users preferring Indian-language access</span><b>57%</b><i><u className="green" style={{"width":"57%"}}></u></i><a className="cite" href="https://www.business-standard.com/india-news/use-of-indian-languages-key-for-increasing-internet-access-in-india-report-124031000395_1.html" target="_blank">IAMAI–Kantar reporting · 10 Mar 2024</a></div>
  </div>
</div></section>


<section className="paper-sec"><div className="wrap">
  <div className="kick rv">WHERE THE PIPELINE LEAKS · कहाँ रुकावट आती है</div>
  <h2 className="rv">The loss starts before training begins.</h2>
  <div className="leakflow rv d1">
    <div><b>01</b><h3>Awareness</h3><p>Did the person hear about a relevant programme?</p><em>Language loss</em></div>
    <span>→</span><div><b>02</b><h3>Intake</h3><p>Can they read, type and interpret the form?</p><em>Access loss</em></div>
    <span>→</span><div><b>03</b><h3>Course fit</h3><p>Does it match ability, interest and mobility?</p><em>Profiling loss</em></div>
    <span>→</span><div><b>04</b><h3>Completion</h3><p>Can travel, care and income needs be managed?</p><em>Dropout risk</em></div>
    <span>→</span><div><b>05</b><h3>Livelihood</h3><p>Is there verified local demand?</p><em>Placement loss</em></div>
  </div>
</div></section>


<section className="paper-sec" id="signals"><div className="wrap">
  <div className="kick rv">ADDITIONAL RESEARCH SIGNALS · अतिरिक्त संकेत</div>
  <h2 className="rv"><span className="dev">एक संख्या पूरी कहानी नहीं बताती।</span>Placement changes when the denominator and reporting window change.</h2>
  <p className="lead rv d1 narrow">The earlier RAAHI research page contains useful historical signals. They are retained here with their scope made explicit, rather than blended into one headline rate.</p>
  <div className="signal-grid rv d1">
    <figure className="signal-card"><h3>PMKVY placement figures reported at different points</h3>
      <div className="comparebar"><header><span>PMKVY overall analysis reported in Dec 2023</span><b>~18%</b></header><i><u style={{"width":"18%"}}></u></i></div>
      <div className="comparebar"><header><span>PMKVY 3.0 figure reported in the same analysis</span><b>5.8%</b></header><i><u className="red" style={{"width":"5.8%"}}></u></i></div>
      <div className="comparebar"><header><span>Later official reported rate for tracked STT-certified cohorts through 3.0</span><b>43%</b></header><i><u className="green" style={{"width":"43%"}}></u></i></div>
      <figcaption>These are not directly interchangeable. Publication date, certification status, phase coverage and placement-tracking scope differ.<span className="cite-row"><a className="cite" href="https://www.thehindubusinessline.com/opinion/making-skilling-more-effective/article67651539.ece" target="_blank">Hindu BusinessLine · 18 Dec 2023 (18% and 5.8%)</a><a className="cite" href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2115272&reg=3&lang=2" target="_blank">MSDE / PIB · 26 Mar 2025 (43%)</a></span></figcaption>
    </figure>
    <figure className="signal-card"><h3>Why enrolment alone overstates success</h3><div className="mini-funnel"><div><span className="dev">दर्ज</span>100<br />enrolled</div><div><span className="dev">उपयुक्त?</span>course<br />fit?</div><div><span className="dev">पूर्ण व प्रमाणित?</span>completed<br />& certified?</div><div><span className="dev">आजीविका सत्यापित?</span>livelihood<br />verified?</div></div>
      <p style={{"fontSize":"13px","color":"var(--ink2)"}}>The source page illustrated that only a small fraction may reach employment in a weakly matched pipeline. RAAHI should not reuse “6 out of 100” as a universal forecast; it should measure each conversion locally.</p>
      <figcaption>Recommended district dashboard: started profile → eligible match → enrolled → completed → engaged at 3/6 months → income change. <span className="evidence-label proposal-label">RAAHI MEASUREMENT PROPOSAL</span></figcaption>
    </figure>
  </div>
  <div className="whybox rv d2"><div><b>Literacy</b>Literacy and educational attainment vary across communities and districts; RAAHI therefore avoids literacy-dependent intake.<a className="cite" href="https://censusindia.gov.in/nada/index.php/catalog/5048/study-description" target="_blank">Open exact Census PCA (SC) dataset record · 2011</a></div><div><b>Device access</b>Independent phone ownership is not universal; shared-device and feature-phone journeys remain essential.</div><div><b>Language</b>A person may speak confidently but still be unable to translate experience into formal trade categories.</div><div><b>Local reality</b>Distance, care duties, disability, seasonality and family occupation can determine whether a course is usable.</div></div>
</div></section>


<section className="softblue" id="bridge"><div className="wrap">
  <div className="kick rv">THE RAAHI BRIDGE · राही का समाधान</div>
  <h2 className="rv"><span className="dev">फॉर्म की जगह बातचीत। अनुमान की जगह प्रमाण।</span>Turn a human story into an evidence-backed next step.</h2>
  <p className="lead rv d1 narrow">RAAHI keeps the request order fixed so the recommendation remains understandable, testable and auditable.</p>
  <div className="raahi-flow rv d1">
    <div><b>◐</b><strong><span className="dev">आवाज़ इनपुट</span>Audio in</strong><small>IVR · WhatsApp · kiosk</small></div><i>→</i><div><b>अ</b><strong><span className="dev">समझना</span>Understand</strong><small>Regional-language STT</small></div><i>→</i><div><b>◇</b><strong><span className="dev">विवरण</span>Profile</strong><small>Typed beneficiary patch</small></div><i>→</i><div><b>⌁</b><strong><span className="dev">मिलान</span>Match</strong><small>NSQF + constraints</small></div><i>→</i><div><b>⌖</b><strong><span className="dev">स्थानीय जांच</span>Ground</strong><small>District demand + distance</small></div><i>→</i><div><b>◖</b><strong><span className="dev">जवाब</span>Reply</strong><small>3 spoken pathways</small></div>
  </div>
  <div className="two rv d2" style={{"marginTop":"42px"}}>
    <div className="fig outcome"><h3>Proposed district-pilot targets</h3><p>Targets for validation—not achieved results.</p><span className="evidence-label proposal-label">TEAM RAAHI PROPOSAL · REQUIRES PILOT VALIDATION</span><div className="target"><b>80%</b><span>of consenting callers complete a voice profile</span></div><div className="target"><b>70%</b><span>receive at least one eligible, reachable pathway</span></div><div className="target"><b>60%</b><span>complete counselling, enrolment or referral within 30 days</span></div></div>
    <div className="fig outcome"><h3>Evidence guardrails</h3><p>What keeps a recommendation trustworthy.</p><div className="rule">✓ No demand row without a source URL and date</div><div className="rule">✓ Vacancies are never presented as placements</div><div className="rule">✓ Every recommendation states why it fits</div><div className="rule">✓ Outcomes tracked at enrolment, 3 and 6 months</div></div>
  </div>
</div></section>


<section className="paper-sec" id="benchmarks"><div className="wrap">
  <div className="kick rv">LEARNING FROM WHAT WORKS · सीख</div>
  <h2 className="rv">Build on proven public-delivery patterns.</h2>
  <div className="scheme-grid rv d1">
    <article><div className="scheme-num">82%</div><h3>Jan Shikshan Sansthan</h3><p>An evaluation reported about 82% of trained beneficiaries gainfully engaged within six months and around 90% using acquired skills. Its doorstep, non-formal model shows the value of local access.</p><b>RAAHI adds:</b> voice profiling + demand-backed referral.<a className="cite" href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2241731&reg=3&lang=1" target="_blank">MSDE / PIB · 18 Mar 2026 (82%, 90%)</a></article>
    <article><div className="scheme-num">1.60 Cr</div><h3>PMKVY</h3><p>Candidates trained or oriented from 2015 to Dec 2024. Its national NSQF infrastructure demonstrates scale, while tracked placement outcomes show why fit and follow-through matter.</p><b>RAAHI adds:</b> life-constraint matching before enrolment.<a className="cite" href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2115272&reg=3&lang=2" target="_blank">MSDE / PIB · 26 Mar 2025 (1.60 crore)</a></article>
    <article><div className="scheme-num">3.43 Cr</div><h3>National Career Service</h3><p>Vacancies mobilised during FY 2025–26 as of 20 January 2026. NCS demonstrates supply visibility—but listings still need local, personal interpretation.</p><b>RAAHI adds:</b> district evidence spoken in plain language.<a className="cite" href="https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2223849&reg=3&lang=1" target="_blank">Official PIB release · 5 Feb 2026</a></article>
  </div>
  </div>
</section>


<section className="source-sec" id="sources"><div className="wrap">
  <div className="kick rv">SOURCES · स्रोत</div><h2 className="rv">Every figure opens its exact source page.</h2>
  <div className="source-grid rv d1">
    <a href="https://censusindia.gov.in/nada/index.php/catalog/5048/study-description" target="_blank"><b>Census of India 2011</b><span>SC population baseline</span></a>
    <a href="https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2223849&reg=3&lang=1" target="_blank"><b>Official NCS release · 5 February 2026</b><span>Jobseekers and vacancies</span></a>
    <a href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2115272&reg=3&lang=2" target="_blank"><b>MSDE / PIB · March 2025</b><span>PMKVY training and placement</span></a>
    <a href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2241731&reg=3&lang=1" target="_blank"><b>MSDE / PIB · March 2026</b><span>JSS evaluation outcomes</span></a>
    <a href="https://www.ideasforindia.in/topics/governance/the-digital-dream-upskilling-india-for-the-future" target="_blank"><b>NSS 75th-round analysis</b><span>Rural digital literacy</span></a>
    <a href="https://india.unfpa.org/sites/default/files/pub-pdf/analytical_paper_6_-_asset_ownership_among_women_in_india_-_insights_from_nfhs_data_-_final_1.pdf" target="_blank"><b>UNFPA analysis of NFHS-5</b><span>Women’s mobile ownership</span></a>
    <a href="https://www.business-standard.com/india-news/use-of-indian-languages-key-for-increasing-internet-access-in-india-report-124031000395_1.html" target="_blank"><b>IAMAI–Kantar reporting · 2024</b><span>Language and internet access</span></a>
    <a href="https://www.thehindubusinessline.com/opinion/making-skilling-more-effective/article67651539.ece" target="_blank"><b>Hindu BusinessLine · December 2023</b><span>Historical PMKVY placement analysis and local-economy alignment</span></a>
    <a href="https://www.mospi.gov.in/sites/default/files/press_release/Press_note_MB01_Monthly_bulletin_Final.pdf" target="_blank"><b>PLFS bulletin · May 2025</b><span>Labour-market definitions and rates</span></a>
  </div>
  <p className="method rv"><b>Link note:</b> Each source label is a direct hyperlink to the exact publication, official press release, report, dataset record or article used—not to a general homepage. Links open in a new browser tab.<br /><br />Method note: “registered jobseekers” is not identical to “unemployed persons” under PLFS. “Vacancies mobilised” is a cumulative flow, while “active vacancies” is a point-in-time stock. Proposed RAAHI targets are pilot hypotheses, not forecasts or achieved outcomes.</p>
</div></section>

<div className="callbar">
  <span className="dev">राही को मुफ्त कॉल करें</span> — Call RAAHI toll-free: <a href="#" onClick={(e) => { e.preventDefault(); setIsCallActive(true); }}>1800-XXXXXXX</a>
  &nbsp;·&nbsp; Live demo: <a href="https://call-raahi.vercel.app/">call-raahi.vercel.app</a>
</div>

<footer><div className="wrap">
  <div className="fgrid" style={{"gridTemplateColumns":"1fr","maxWidth":"720px"}}>
    <div>
      <h4>राही · RAAHI</h4>
      <p>Rural AI Advisor for Household Income. A voice-first assistant for livelihood mapping & NSQF-aligned skilling for SC communities under the GIA component of PM-AJAY.</p>
      <p style={{"marginTop":"12px"}}>Built for Smart India Hackathon 2026.</p>
    </div>
  </div>
  <hr className="frule" />
  <p style={{"fontSize":"12px","color":"#8a7c63"}}>© 2026 Team RAAHI · Evidence, proposed targets and assumptions are clearly labelled on this page.</p>
</div></footer>










    </div>
      <CallExperience isActive={isCallActive} onClose={() => setIsCallActive(false)} />
    </div>
  );
}
