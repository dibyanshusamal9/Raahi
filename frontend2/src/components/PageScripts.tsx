"use client";
import { useEffect } from "react";

export default function PageScripts() {
  useEffect(() => {
    /* ---------- self-contained 3D particle background (no libraries) ---------- */
    let frameId: number;
    (function(){
      var c = document.getElementById('bg3d') as HTMLCanvasElement;
      if (!c) return;
      var x = c.getContext('2d');
      if (!x) return;
      var W: number, H: number, DPR = Math.min(window.devicePixelRatio||1, 2);
      var N = 140, P: any[] = [], FOV = 340;
      function rnd(a: number, b: number){return a+Math.random()*(b-a);}
      function reset(p: any, far: boolean){
        p.x = rnd(-900, 900); p.y = rnd(-560, 560);
        p.z = far ? rnd(600, 1200) : rnd(60, 1200);
        p.r = rnd(1.1, 3.4); p.spd = rnd(.25, .85);
        var pal = [[245,196,81], [232,163,61], [201,121,27], [79,157,107], [125,178,214]];
        p.col = pal[(Math.random()*pal.length)|0];
        p.a = rnd(.25, .8);
      }
      function init(){ P = []; for(var i=0; i<N; i++){ var p: any={}; reset(p, false); P.push(p); } }
      function size(){ if(!c)return; W = c.width = innerWidth*DPR; H = c.height = innerHeight*DPR; c.style.width = innerWidth+'px'; c.style.height = innerHeight+'px'; }
      var scrollY = 0;
      const onScroll = function(){ scrollY = window.scrollY; };
      window.addEventListener('scroll', onScroll);
      function frame(){
        if (!document.getElementById('bg3d')) return;
        if (!x) return;
        x.clearRect(0,0,W,H);
        var cx = W/2, cy = H/2 - scrollY*0.15*DPR;
        for(var i=0; i<P.length; i++){
          var p = P[i]; p.z -= p.spd*2.4;
          if(p.z<40){ reset(p, true); }
          var s = FOV/(FOV+p.z);
          var sx = cx + p.x*s*DPR;
          var sy = cy + p.y*s*DPR;
          var rad = p.r*s*DPR*1.6;
          if(sx<-40 || sx>W+40 || sy<-40 || sy>H+40) continue;
          var al = p.a*Math.min(1, (1200-p.z)/900);
          x.beginPath();
          x.fillStyle = 'rgba('+p.col[0]+','+p.col[1]+','+p.col[2]+','+al+')';
          x.arc(sx, sy, Math.max(.4, rad), 0, 6.283);
          x.fill();
        }
        frameId = requestAnimationFrame(frame);
      }
      size(); init(); frame();
      window.addEventListener('resize', size);
      
      // Cleanup for hot reloads / navigation
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', size);
        cancelAnimationFrame(frameId);
      };
    })();

    /* ---------- scroll reveal ---------- */
    (function(){
      var io = new IntersectionObserver(function(es){
        es.forEach(function(e){
          if(e.isIntersecting){
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: .14 });
      document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });
    })();

    /* ---------- hero parallax ---------- */
    let onScrollParallax: () => void;
    (function(){
      var hero = document.getElementById('heroimg');
      onScrollParallax = function(){
        var y = window.scrollY;
        if(hero) hero.style.transform = 'translateY('+(y*0.28)+'px) scale(1.06)';
      }
      window.addEventListener('scroll', onScrollParallax); 
      onScrollParallax();
    })();

    return () => {
      cancelAnimationFrame(frameId);
      if (onScrollParallax) window.removeEventListener('scroll', onScrollParallax);
    };
  }, []);

  return null;
}
