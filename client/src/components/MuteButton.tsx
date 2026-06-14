import { useState } from 'react';
import { sound } from '../lib/sound';

export function MuteButton() {
  const [muted, setMuted] = useState(sound.muted);
  return (
    <button
      className="btn btn-ghost"
      aria-label={muted ? 'Unmute' : 'Mute'}
      onClick={() => {
        const m = sound.toggleMute();
        setMuted(m);
        if (!m) sound.pop();
      }}
      style={{ padding: 10, width: 44, height: 44 }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
