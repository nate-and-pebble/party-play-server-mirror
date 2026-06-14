import type { PlayerPublic } from '@partyplay/shared';
import { Avatar } from '../components/ui';

/** The persistent "this is you" strip at the top of the phone controller. */
export function YouBar({ you, accent }: { you: PlayerPublic; accent?: string }) {
  return (
    <div
      className="row"
      style={{
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: accent ? `${accent}22` : 'transparent',
      }}
    >
      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        <Avatar identity={you.identity} size={36} />
        <div className="col" style={{ lineHeight: 1.1 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{you.name}</span>
          <span className="faint" style={{ fontSize: 11 }}>
            {you.identity.colorName}
          </span>
        </div>
      </div>
      <div className="pill mono" style={{ fontSize: 13 }}>
        {(you.sessionScore + you.score).toLocaleString()} pts
      </div>
    </div>
  );
}
