import confetti from 'canvas-confetti';

/** Celebratory effects for winner moments (RScore-02) and small wins. */
export const fx = {
  burst(intensity = 1) {
    const count = Math.round(120 * intensity);
    confetti({
      particleCount: count,
      spread: 80,
      startVelocity: 45,
      origin: { y: 0.6 },
      colors: ['#7C5CFF', '#FF6BD6', '#2EC4B6', '#FFB23E', '#34D399'],
      scalar: 1.1,
    });
  },
  cannons() {
    const end = Date.now() + 1200;
    const colors = ['#7C5CFF', '#FF6BD6', '#2EC4B6', '#FFB23E'];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  },
  fireworks() {
    const duration = 2200;
    const end = Date.now() + duration;
    (function frame() {
      confetti({
        particleCount: 6,
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random(), y: Math.random() * 0.5 },
        colors: ['#7C5CFF', '#FF6BD6', '#2EC4B6', '#FFB23E', '#34D399'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  },
};
