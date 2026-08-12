import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import balloonPink from '@/assets/balloon-pink.png';
import balloonPurple from '@/assets/balloon-purple.png';
import balloonOrange from '@/assets/balloon-orange.png';

const BrandFestivalEffects = () => {
  const [balloons, setBalloons] = useState<any[]>([]);

  useEffect(() => {
    // Initial celebration burst
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0, colors: ['#F68B1E', '#F59E0B', '#7F4CEF', '#AC80F7', '#3B82F6', '#FFFFFF'] };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    // Generate floating balloons
    const balloonImages = [balloonPink, balloonPurple, balloonOrange];
    const newBalloons = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      image: balloonImages[i % 3],
      left: Math.random() * 100,
      size: Math.random() * (120 - 60) + 60,
      delay: Math.random() * 15,
      duration: Math.random() * (25 - 15) + 15,
      opacity: Math.random() * (0.8 - 0.4) + 0.4,
    }));
    setBalloons(newBalloons);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[5] overflow-hidden">
      {/* Floating Balloons */}
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
          <img src={b.image} alt="balloon" className="w-full h-auto drop-shadow-xl" />
        </div>
      ))}

      {/* Brand Festival Text (Subtle Backdrop) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none select-none">
        <h1 className="text-[12vw] font-black text-white whitespace-nowrap uppercase tracking-tighter text-center">
          Brand Festival
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

export default BrandFestivalEffects;
