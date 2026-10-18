import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import balloonPink from '@/assets/balloon-pink.png';
import balloonPurple from '@/assets/balloon-purple.png';
import balloonOrange from '@/assets/balloon-orange.png';

const BlackFridayEffects = () => {
  const [balloons, setBalloons] = useState<any[]>([]);

  useEffect(() => {
    // Initial celebration burst with Black Friday colors: Orange-550 (#FF550C), Purple-900 (#3B2079), Red-500 (#bE1d3e), Black (#000000)
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
      colors: ['#FF550C', '#3B2079', '#bE1d3e', '#FFA000', '#000000', '#FFFFFF']
    };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // Confetti burst from both sides
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    // Floating balloons in Black Friday theme (Orange-550, Purple-900, Red-500)
    const balloonList = [
      { image: balloonOrange, filter: 'none' }, // Orange-550 (#FF550C)
      { image: balloonPurple, filter: 'none' }, // Purple-900 (#3B2079)
      { image: balloonPink, filter: 'hue-rotate(315deg) saturate(1.5) brightness(0.9)' } // Red-500 (#bE1d3e)
    ];

    const newBalloons = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      item: balloonList[i % balloonList.length],
      left: Math.random() * 100,
      size: Math.random() * (120 - 60) + 60,
      delay: Math.random() * 15,
      duration: Math.random() * (25 - 15) + 15,
      opacity: Math.random() * (0.75 - 0.35) + 0.35,
    }));
    setBalloons(newBalloons);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[5] overflow-hidden">
      {/* Floating Themed Balloons */}
      {balloons.map((b) => (
        <div
          key={b.id}
          className="absolute bottom-[-150px] animate-float-up"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            opacity: b.opacity,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        >
          <img
            src={b.item.image}
            alt="balloon"
            className="w-full h-auto drop-shadow-2xl"
            style={{ filter: b.item.filter }}
          />
        </div>
      ))}

      {/* Black Friday Text (Subtle Backdrop) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none select-none w-full flex justify-center">
        <h1 className="text-[13vw] font-black uppercase tracking-tighter text-center whitespace-nowrap text-white/20 select-none drop-shadow-[0_0_40px_rgba(255,85,12,0.15)]">
          Black Friday
        </h1>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float-up {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          100% {
            transform: translateY(-120vh) rotate(${Math.random() > 0.5 ? 20 : -20}deg);
          }
        }
        .animate-float-up {
          animation-name: float-up;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}} />
    </div>
  );
};

export default BlackFridayEffects;
