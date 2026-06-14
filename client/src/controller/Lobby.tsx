import type { PlayerEnvelope } from '@partyplay/shared';
import { motion } from 'framer-motion';
import { Avatar, Dots } from '../components/ui';
import { send } from '../lib/socket';
import { sound } from '../lib/sound';
import { AVATAR_POOL } from '@partyplay/shared';
import { YouBar } from './YouBar';

export function ControllerLobby({ env }: { env: PlayerEnvelope }) {
  const you = env.you;
  const others = env.session.players.filter((p) => p.id !== you.id);

  const changeAvatar = () => {
    const idx = AVATAR_POOL.indexOf(you.identity.avatar);
    const next = AVATAR_POOL[(idx + 1) % AVATAR_POOL.length];
    send('player:setIdentity', { avatar: next });
    sound.tap();
  };
  const cycleColor = () => {
    send('player:setIdentity', { cycleColor: true });
    sound.tap();
  };

  return (
    <div className="col grow" style={{ minHeight: 0 }}>
      <YouBar you={you} accent={you.identity.color} />
      <div className="col grow scroll gap-md" style={{ padding: 16, alignItems: 'center' }}>
        <motion.div className="col center-all gap-sm" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Avatar identity={you.identity} size={120} />
          <h2 style={{ fontSize: 26 }}>{you.name}</h2>
        </motion.div>

        <div className="row gap-sm">
          <button className="btn" onClick={changeAvatar}>
            🎭 Avatar
          </button>
          <button className="btn" onClick={cycleColor}>
            🎨 Color
          </button>
        </div>

        <div className="card card-pad col center-all gap-sm" style={{ width: '100%' }}>
          <div className="row center-all gap-sm muted" style={{ fontWeight: 600 }}>
            Waiting for the host to start <Dots />
          </div>
          <div className="faint" style={{ fontSize: 13 }}>
            Look up at the big screen 👆
          </div>
        </div>

        {others.length > 0 && (
          <div className="card card-pad col gap-sm" style={{ width: '100%' }}>
            <div className="tag">In the room · {env.session.players.length}</div>
            <div className="row wrap gap-md">
              {others.map((p) => (
                <div key={p.id} className="col center-all" style={{ width: 64, gap: 4 }}>
                  <Avatar identity={p.identity} size={42} dim={!p.connected} />
                  <span style={{ fontSize: 11, fontWeight: 600 }} className="clip full nowrap">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
