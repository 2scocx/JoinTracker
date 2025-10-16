import React, { useState, useEffect } from 'react';
import './EmojiEffect.css';

export default function EmojiEffect({ x, y, onComplete }) {
  const [emojis, setEmojis] = useState([]);

  useEffect(() => {
    // Create multiple emojis
    const newEmojis = Array.from({ length: 6 }, () => ({
      id: Math.random(),
      xEnd: (Math.random() - 0.5) * 150, // Wider spread
      rotation: (Math.random() - 0.5) * 180, // More rotation
      scale: 0.8 + Math.random() * 0.4, // Random sizes
      delay: Math.random() * 0.3 // Stagger the animations
    }));

    setEmojis(newEmojis);

    // Remove emojis after animation
    const timer = setTimeout(() => {
      setEmojis([]);
      onComplete?.(); // Call onComplete callback when animation is done
    }, 1500);

    return () => clearTimeout(timer);
  }, [x, y]);

  return (
    <div className="emoji-container" style={{ left: x, top: y }}>
      {emojis.map(emoji => (
        <div
          key={emoji.id}
          className="floating-emoji"
          style={{
            '--x-end': `${emoji.xEnd}px`,
            '--rotation': `${emoji.rotation}deg`,
            '--scale': emoji.scale,
            '--delay': `${emoji.delay}s`,
            transform: `scale(${emoji.scale})`,
            animationDelay: `${emoji.delay}s`
          }}
        >
          🍃
        </div>
      ))}
    </div>
  );
}