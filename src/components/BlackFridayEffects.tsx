import React, { useEffect, useState } from 'react';

// Black Friday Sales Element 1: Classic Hanging Price Tag -70% Mega Deal
const PriceTagMegaDeal = () => (
  <svg viewBox="0 0 140 190" className="w-full h-auto drop-shadow-[0_12px_24px_rgba(255,85,12,0.35)] select-none">
    <defs>
      <linearGradient id="bfTagGrad1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3B2079" />
        <stop offset="50%" stopColor="#bE1d3e" />
        <stop offset="100%" stopColor="#FF550C" />
      </linearGradient>
    </defs>
    {/* Hanging String */}
    <path d="M 70 28 Q 80 5 88 8 Q 94 12 70 18" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity="0.6" strokeDasharray="3,2" />
    {/* Tag body with clipped corners */}
    <path d="M 40 25 L 100 25 L 130 55 L 130 175 A 12 12 0 0 1 118 187 L 22 187 A 12 12 0 0 1 10 175 L 10 55 Z" fill="url(#bfTagGrad1)" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.4" />
    {/* Metallic Eyelet */}
    <circle cx="70" cy="42" r="8" fill="#1e1e1e" stroke="#E5E7EB" strokeWidth="2.5" />
    <circle cx="70" cy="42" r="4.5" fill="#0b0518" />
    {/* Inner content */}
    <rect x="24" y="60" width="92" height="19" rx="9.5" fill="#000000" fillOpacity="0.5" />
    <text x="70" y="74" textAnchor="middle" fill="#FFD700" fontSize="10.5" fontWeight="900" letterSpacing="1">MEGA DEAL</text>
    <text x="70" y="124" textAnchor="middle" fill="#FFFFFF" fontSize="38" fontWeight="900" letterSpacing="-1" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}>-70%</text>
    <text x="70" y="146" textAnchor="middle" fill="#FFA000" fontSize="13" fontWeight="800" letterSpacing="1.5">OFF</text>
    <rect x="22" y="158" width="96" height="18" rx="4" fill="#FFFFFF" fillOpacity="0.2" />
    <text x="70" y="171" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900" letterSpacing="1.5">BLACK FRIDAY</text>
  </svg>
);

// Black Friday Sales Element 2: Obsidian & Neon Orange Flash Sale Tag
const PriceTagFlashSale = () => (
  <svg viewBox="0 0 140 190" className="w-full h-auto drop-shadow-[0_12px_24px_rgba(255,85,12,0.4)] select-none">
    <defs>
      <linearGradient id="bfTagGrad2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1e0c38" />
        <stop offset="100%" stopColor="#0a0312" />
      </linearGradient>
    </defs>
    {/* String */}
    <path d="M 70 28 Q 60 6 68 3 Q 76 0 70 18" stroke="#FFA000" strokeWidth="2" fill="none" opacity="0.7" />
    {/* Tag body */}
    <path d="M 40 25 L 100 25 L 130 55 L 130 175 A 12 12 0 0 1 118 187 L 22 187 A 12 12 0 0 1 10 175 L 10 55 Z" fill="url(#bfTagGrad2)" stroke="#FF550C" strokeWidth="2.5" />
    {/* Grommet */}
    <circle cx="70" cy="42" r="8" fill="#FF550C" stroke="#FFA000" strokeWidth="2" />
    <circle cx="70" cy="42" r="4.5" fill="#000000" />
    {/* Lightning Bolt */}
    <path d="M 73 58 L 61 78 L 71 78 L 67 96 L 81 74 L 71 74 Z" fill="#FFD700" style={{ filter: "drop-shadow(0 0 6px #FFA000)" }} />
    <text x="70" y="116" textAnchor="middle" fill="#FF550C" fontSize="16" fontWeight="900" letterSpacing="1.5">FLASH</text>
    <text x="70" y="136" textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="900" letterSpacing="2">SALE</text>
    <rect x="25" y="152" width="90" height="22" rx="11" fill="#FF550C" />
    <text x="70" y="167" textAnchor="middle" fill="#FFFFFF" fontSize="10.5" fontWeight="900" letterSpacing="0.5">UP TO 80%</text>
  </svg>
);

// Black Friday Sales Element 3: Luxury Matte Black Shopping Bag with Orange Rope Handles
const ShoppingBagBlackFriday = () => (
  <svg viewBox="0 0 150 180" className="w-full h-auto drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)] select-none">
    <defs>
      <linearGradient id="bfBagGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#25123d" />
        <stop offset="50%" stopColor="#120621" />
        <stop offset="100%" stopColor="#05010a" />
      </linearGradient>
      <linearGradient id="bfOrangeGlow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#FF550C" />
        <stop offset="100%" stopColor="#FFA000" />
      </linearGradient>
    </defs>
    {/* Braided Rope Handles */}
    <path d="M 50 58 C 50 14, 100 14, 100 58" fill="none" stroke="url(#bfOrangeGlow)" strokeWidth="5.5" strokeLinecap="round" />
    <path d="M 54 60 C 54 20, 96 20, 96 60" fill="none" stroke="#FF550C" strokeWidth="2" strokeOpacity="0.5" strokeLinecap="round" />
    {/* Bag Body */}
    <polygon points="25,58 125,58 135,170 15,170" fill="url(#bfBagGrad)" stroke="#3B2079" strokeWidth="2" />
    {/* Left side fold crease */}
    <polygon points="25,58 40,62 32,170 15,170" fill="#000000" fillOpacity="0.45" />
    {/* Top Rim Highlight */}
    <line x1="25" y1="58" x2="125" y2="58" stroke="#FF550C" strokeWidth="2.5" />
    {/* Eyelets */}
    <circle cx="50" cy="68" r="3.5" fill="#FF550C" />
    <circle cx="100" cy="68" r="3.5" fill="#FF550C" />
    {/* Center Typography */}
    <text x="75" y="102" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="900" letterSpacing="2">BLACK</text>
    <text x="75" y="119" textAnchor="middle" fill="#FF550C" fontSize="14" fontWeight="900" letterSpacing="2.5">FRIDAY</text>
    {/* Percent Badge */}
    <circle cx="75" cy="144" r="15" fill="#bE1d3e" stroke="#FF550C" strokeWidth="2" />
    <text x="75" y="150" textAnchor="middle" fill="#FFFFFF" fontSize="15" fontWeight="900">%</text>
  </svg>
);

// Black Friday Sales Element 4: Crimson Hot Drop Price Tag
const PriceTagHotDrop = () => (
  <svg viewBox="0 0 140 190" className="w-full h-auto drop-shadow-[0_12px_24px_rgba(190,29,62,0.4)] select-none">
    <defs>
      <linearGradient id="bfTagGrad3" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#bE1d3e" />
        <stop offset="60%" stopColor="#7a0a20" />
        <stop offset="100%" stopColor="#2a0008" />
      </linearGradient>
    </defs>
    {/* String */}
    <path d="M 70 28 Q 78 8 70 0 Q 62 4 70 18" stroke="#FF550C" strokeWidth="2" fill="none" opacity="0.7" />
    <path d="M 40 25 L 100 25 L 130 55 L 130 175 A 12 12 0 0 1 118 187 L 22 187 A 12 12 0 0 1 10 175 L 10 55 Z" fill="url(#bfTagGrad3)" stroke="#FFA000" strokeWidth="2" />
    <circle cx="70" cy="42" r="8" fill="#180005" stroke="#FFA000" strokeWidth="2.5" />
    <circle cx="70" cy="42" r="4" fill="#FF550C" />
    {/* Flame & Content */}
    <text x="70" y="74" textAnchor="middle" fill="#FFA000" fontSize="22" style={{ filter: "drop-shadow(0 0 8px rgba(255,160,0,0.6))" }}>🔥</text>
    <text x="70" y="100" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900" letterSpacing="1.5">HOT DROP</text>
    <text x="70" y="138" textAnchor="middle" fill="#FFD700" fontSize="36" fontWeight="900" letterSpacing="-1">-50%</text>
    <rect x="25" y="154" width="90" height="20" rx="10" fill="#000000" fillOpacity="0.5" />
    <text x="70" y="168" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="800" letterSpacing="1">DOORBUSTER</text>
  </svg>
);

// Black Friday Sales Element 5: Electric Flash Deal Shield
const BadgeFlashDeal = () => (
  <svg viewBox="0 0 150 170" className="w-full h-auto drop-shadow-[0_0_25px_rgba(255,85,12,0.45)] select-none">
    <defs>
      <linearGradient id="bfBoltGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFF275" />
        <stop offset="50%" stopColor="#FFA000" />
        <stop offset="100%" stopColor="#FF550C" />
      </linearGradient>
    </defs>
    {/* Outer Shield */}
    <polygon points="75,10 135,38 118,125 75,165 32,125 15,38" fill="#150826" stroke="#FF550C" strokeWidth="3" />
    {/* Lightning Bolt */}
    <path d="M 85 28 L 52 82 L 74 82 L 62 142 L 102 74 L 80 74 Z" fill="url(#bfBoltGrad)" style={{ filter: "drop-shadow(0 0 10px #FF550C)" }} />
    <text x="75" y="122" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900" letterSpacing="2">FLASH</text>
    <text x="75" y="138" textAnchor="middle" fill="#FFD700" fontSize="11" fontWeight="900" letterSpacing="2.5">DEAL</text>
  </svg>
);

const SALE_COMPONENTS = [
  PriceTagMegaDeal,
  PriceTagFlashSale,
  ShoppingBagBlackFriday,
  PriceTagHotDrop,
  BadgeFlashDeal,
];

const EMBER_COLORS = ['#FF550C', '#FFA000', '#FFD700', '#bE1d3e', '#FFFFFF'];

const BlackFridayEffects = () => {
  const [elements, setElements] = useState<any[]>([]);
  const [embers, setEmbers] = useState<any[]>([]);

  useEffect(() => {
    // 7 Floating Black Friday sales motifs (price tags, shopping bags, flash shields)
    const newElements = Array.from({ length: 7 }).map((_, i) => ({
      id: i,
      Component: SALE_COMPONENTS[i % SALE_COMPONENTS.length],
      left: Math.random() * 88 + 6, // 6% to 94% across the screen
      size: Math.random() * (100 - 65) + 65, // 65px to 100px
      delay: Math.random() * 12,
      duration: Math.random() * (32 - 20) + 20, // 20s to 32s graceful float
      opacity: Math.random() * (0.65 - 0.35) + 0.35,
      tilt: Math.random() * 24 - 12, // -12deg to +12deg initial tilt
    }));
    setElements(newElements);

    // 22 ambient hot deal glowing ember sparks
    const newEmbers = Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 4 + 3, // 3px to 7px
      color: EMBER_COLORS[i % EMBER_COLORS.length],
      delay: Math.random() * 10,
      duration: Math.random() * 14 + 10, // 10s to 24s
      opacity: Math.random() * 0.6 + 0.2,
    }));
    setEmbers(newEmbers);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[5] overflow-hidden select-none">
      {/* Ambient Hot Deal Glowing Sparks / Embers */}
      {embers.map((ember) => (
        <div
          key={`ember-${ember.id}`}
          className="absolute bottom-[-20px] rounded-full animate-float-ember pointer-events-none select-none"
          style={{
            left: `${ember.left}%`,
            width: `${ember.size}px`,
            height: `${ember.size}px`,
            backgroundColor: ember.color,
            boxShadow: `0 0 ${ember.size * 2}px ${ember.color}`,
            opacity: ember.opacity,
            animationDuration: `${ember.duration}s`,
            animationDelay: `${ember.delay}s`,
          }}
        />
      ))}

      {/* Floating Black Friday Sales Motifs (Tags, Bags, Flash Shields) */}
      {elements.map((el) => {
        const Comp = el.Component;
        return (
          <div
            key={el.id}
            className="absolute bottom-[-160px] animate-float-sale-item pointer-events-none select-none"
            style={{
              left: `${el.left}%`,
              width: `${el.size}px`,
              opacity: el.opacity,
              animationDuration: `${el.duration}s`,
              animationDelay: `${el.delay}s`,
              transform: `rotate(${el.tilt}deg)`,
            }}
          >
            <Comp />
          </div>
        );
      })}

      {/* Subtle Black Friday Backdrop Typography */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15 md:opacity-20 pointer-events-none select-none w-full flex flex-col md:flex-row items-center justify-center gap-1 md:gap-6 px-4">
        <span className="text-[15vw] md:text-[13vw] font-black uppercase tracking-tighter text-center whitespace-nowrap text-white/20 select-none drop-shadow-[0_0_40px_rgba(255,85,12,0.15)] leading-none">
          BLACK
        </span>
        <span className="text-[15vw] md:text-[13vw] font-black uppercase tracking-tighter text-center whitespace-nowrap text-white/20 select-none drop-shadow-[0_0_40px_rgba(190,29,62,0.15)] leading-none">
          FRIDAY
        </span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float-sale-item {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-60vh) rotate(8deg);
          }
          100% {
            transform: translateY(-130vh) rotate(-10deg);
          }
        }
        .animate-float-sale-item {
          animation-name: float-sale-item;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        @keyframes float-ember {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-115vh) translateX(25px);
            opacity: 0;
          }
        }
        .animate-float-ember {
          animation-name: float-ember;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}} />
    </div>
  );
};

export default BlackFridayEffects;
