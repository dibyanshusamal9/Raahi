"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { PhoneCall } from "lucide-react";

const FRAME_COUNT = 100;

export default function ScrollSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Load images
  useEffect(() => {
    let loadedCount = 0;
    const loadedImages: HTMLImageElement[] = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      const paddedIndex = i.toString().padStart(3, "0");
      img.src = `/new_frames/Villager_rides_motorbike_to_store_202609012312_gwr_video_mvp_${paddedIndex}.jpg`;
      
      const handleLoadOrError = () => {
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / FRAME_COUNT) * 100));
        
        if (loadedCount === FRAME_COUNT) {
          // Sort to ensure sequential order in the array
          loadedImages.sort((a, b) => {
            const numA = parseInt(a.src.match(/mvp_(\d+)/)?.[1] || "0", 10);
            const numB = parseInt(b.src.match(/mvp_(\d+)/)?.[1] || "0", 10);
            return numA - numB;
          });
          setImages(loadedImages);
          setLoaded(true);
        }
      };

      img.onload = handleLoadOrError;
      img.onerror = handleLoadOrError;
      loadedImages.push(img);
    }
  }, []);

  // Draw frame on scroll
  useEffect(() => {
    if (!loaded || !canvasRef.current || images.length !== FRAME_COUNT) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderFrame = (progress: number) => {
      const frameIndex = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.floor(progress * (FRAME_COUNT - 1)))
      );
      
      const img = images[frameIndex];
      if (!img) return;

      // High-DPI canvas rendering
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const physicalWidth = Math.round(rect.width * dpr);
      const physicalHeight = Math.round(rect.height * dpr);

      if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Implement object-fit: cover math manually
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width / 2) - (img.width / 2) * scale;
      const y = (canvas.height / 2) - (img.height / 2) * scale;

      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    };

    // Draw initial frame
    renderFrame(scrollYProgress.get());

    const unsubscribe = scrollYProgress.on("change", (latest) => {
      requestAnimationFrame(() => renderFrame(latest));
    });

    return () => {
      unsubscribe();
    };
  }, [loaded, images, scrollYProgress]);

  // Framer Motion transforms based on scrollYProgress (0 to 1)
  
  // 0–15% · frames 000–035 — HERO
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12, 0.15], [1, 1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -50]);

  // 15–40% · frames 036–098 — THE ROAD
  const roadOpacity = useTransform(scrollYProgress, [0.15, 0.2, 0.35, 0.4], [0, 1, 1, 0]);
  const roadY = useTransform(scrollYProgress, [0.15, 0.2, 0.35, 0.4], [50, 0, 0, -50]);

  // 40–55% · frames 099–118 — THE DISCOVERY
  const discOpacity = useTransform(scrollYProgress, [0.4, 0.45, 0.52, 0.55], [0, 1, 1, 0]);
  const discY = useTransform(scrollYProgress, [0.4, 0.45, 0.52, 0.55], [50, 0, 0, -50]);

  // 65–80% · frames 140–178 — THE CALL
  const callOpacity = useTransform(scrollYProgress, [0.65, 0.7, 0.77, 0.8], [0, 1, 1, 0]);
  const callY = useTransform(scrollYProgress, [0.65, 0.7, 0.77, 0.8], [50, 0, 0, -50]);

  // 80–100% · frames 179–239 — CONNECTED
  const connectedOpacity = useTransform(scrollYProgress, [0.8, 0.85, 1], [0, 1, 1]);
  const connectedY = useTransform(scrollYProgress, [0.8, 0.85, 1], [50, 0, 0]);


  return (
    <div ref={containerRef} style={{ height: "600vh", position: "relative" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", width: "100vw", overflow: "hidden", backgroundColor: "#000" }}>
        
        {!loaded && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white", zIndex: 50, backgroundColor: "#111" }}>
            <h2 className="brand-font" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>RAAHI</h2>
            <div style={{ fontFamily: "var(--font-hind)", fontSize: "1.2rem", marginBottom: "0.25rem", color: "rgba(255,255,255,0.9)" }}>आपका रास्ता तैयार हो रहा है...</div>
            <div style={{ fontSize: "0.9rem", marginBottom: "1.5rem", color: "rgba(255,255,255,0.7)" }}>Preparing your journey...</div>
            <div style={{ width: "200px", height: "4px", backgroundColor: "#333", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ width: `${loadProgress}%`, height: "100%", backgroundColor: "var(--color-accent)", transition: "width 0.2s" }} />
            </div>
          </div>
        )}

        {/* Canvas for rendering frames */}
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />


        {/* OVERLAYS */}
        <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
          
          {/* HERO */}
          {/* Hero text removed as requested */}

          {/* THE ROAD */}
          <motion.div className="overlay-container overlay-road" style={{ position: "absolute", top: "55%", translate: "0 -50%", opacity: roadOpacity, y: roadY }}>
            <h2 className="text-fluid-hero" style={{ fontFamily: "var(--font-yatra-one)", color: "white", textShadow: "0 2px 12px rgba(0,0,0,0.5)", marginBottom: "0.75rem" }}>
              कोई फॉर्म नहीं।<br/>कोई ऐप नहीं।<br/>पढ़ने की जरूरत नहीं।
            </h2>
            <h3 className="text-fluid-subhero" style={{ fontFamily: "var(--font-baloo)", color: "rgba(255,255,255,0.9)", textShadow: "0 2px 12px rgba(0,0,0,0.5)", margin: 0 }}>
              No forms. No apps.<br/>No reading required.
            </h3>
            <p className="text-fluid-body" style={{ fontFamily: "var(--font-hind)", color: "white", textShadow: "0 1px 6px rgba(0,0,0,0.6)", marginTop: "1.5rem" }}>
              बस एक रास्ता, एक फोन नंबर, और कोई जो आपकी अपनी भाषा में सुनता है।
            </p>
            <p className="text-fluid-small" style={{ fontFamily: "var(--font-hind)", color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.6)", marginTop: "0.25rem" }}>
              Just a road, a phone number, and someone who listens in your own language.
            </p>
          </motion.div>

          {/* THE DISCOVERY */}
          <motion.div className="overlay-container overlay-discovery" style={{ position: "absolute", top: "50%", translate: "0 -50%", opacity: discOpacity, y: discY }}>
            <h2 className="text-fluid-hero" style={{ fontFamily: "var(--font-yatra-one)", color: "white", textShadow: "0 2px 12px rgba(0,0,0,0.5)", marginBottom: "0.75rem" }}>
              मदद हमेशा<br/>इतनी करीब थी।
            </h2>
            <h3 className="text-fluid-subhero" style={{ fontFamily: "var(--font-baloo)", color: "rgba(255,255,255,0.9)", textShadow: "0 2px 12px rgba(0,0,0,0.5)", margin: 0 }}>
              Help was always this close.
            </h3>
            <p className="text-fluid-body" style={{ fontFamily: "var(--font-hind)", color: "white", textShadow: "0 1px 6px rgba(0,0,0,0.6)", marginTop: "1.5rem", marginLeft: "auto" }}>
              राही सुनता है, समझता है, और ऐसा प्रशिक्षण ढूंढता है जो आपके जीवन के अनुकूल हो।
            </p>
            <p className="text-fluid-small" style={{ fontFamily: "var(--font-hind)", color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.6)", marginTop: "0.25rem", marginLeft: "auto" }}>
              RAAHI listens, understands, and finds the training that fits your life.
            </p>
          </motion.div>

          {/* THE CALL block removed */}

          {/* CONNECTED */}
          <motion.div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-end", paddingRight: "5%", paddingBottom: "5%", opacity: connectedOpacity, y: connectedY }}>
            <a 
              href="tel:1800-000-0000"
              className="connected-btn"
              style={{
                pointerEvents: "auto",
                display: "inline-flex",
                alignItems: "center",
                backgroundColor: "var(--color-accent)",
                color: "white",
                borderRadius: "9999px",
                fontWeight: "bold",
                boxShadow: "0 8px 30px rgba(232, 128, 31, 0.4)",
                transition: "transform 0.2s, background-color 0.2s",
                cursor: "pointer",
                textDecoration: "none"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.backgroundColor = "#ff9333";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.backgroundColor = "var(--color-accent)";
              }}
            >
              <PhoneCall size={32} style={{ marginRight: "16px", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
                <span className="connected-btn-title" style={{ fontFamily: "var(--font-yatra-one)", lineHeight: 1, marginBottom: "0.25rem" }}>राही को मुफ्त कॉल करें</span>
                <span className="connected-btn-sub" style={{ opacity: 0.9 }}>Call RAAHI toll-free — 1800-XXXXXXX</span>
              </div>
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
