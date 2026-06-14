import { QRCodeSVG } from 'qrcode.react';
import type { ScreenEnvelope } from '@partyplay/shared';
import type { HostFn } from './Screen';
import { QuibbleScreen } from './games/QuibbleScreen';
import { TriviaScreen } from './games/TriviaScreen';
import { DoodleScreen } from './games/DoodleScreen';

export function GameScreen({ env, host }: { env: ScreenEnvelope; host: HostFn }) {
  if (env.view.kind !== 'game') return null;
  const view = env.view.view;
  const paused = Boolean((view as any).paused);

  return (
    <div className="grow rel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {view.gameId === 'quibble' && <QuibbleScreen view={view} env={env} />}
      {view.gameId === 'trivia' && <TriviaScreen view={view} env={env} />}
      {view.gameId === 'doodle' && <DoodleScreen view={view} env={env} />}

      <JoinBadge env={env} />
      <HostDock host={host} paused={paused} />
    </div>
  );
}

/** Small persistent join affordance so people can still hop in mid-game (SCR-02 / JOIN-05). */
function JoinBadge({ env }: { env: ScreenEnvelope }) {
  if (env.session.locked) return null;
  return (
    <div
      className="card row gap-sm"
      style={{ position: 'absolute', top: 14, right: 14, padding: 8, alignItems: 'center', zIndex: 20, opacity: 0.92 }}
    >
      <div style={{ background: '#fff', padding: 5, borderRadius: 8 }}>
        <QRCodeSVG value={env.session.joinUrl} size={44} bgColor="#ffffff" fgColor="#0b0b1a" />
      </div>
      <div className="col" style={{ lineHeight: 1.1 }}>
        <span className="faint" style={{ fontSize: 10 }}>
          JOIN
        </span>
        <span className="roomcode" style={{ fontSize: 20, letterSpacing: '0.1em' }}>
          {env.session.roomCode}
        </span>
      </div>
    </div>
  );
}

function HostDock({ host, paused }: { host: HostFn; paused: boolean }) {
  return (
    <div
      className="card row gap-xs"
      style={{
        position: 'absolute',
        bottom: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: 8,
        zIndex: 20,
        alignItems: 'center',
      }}
    >
      <button
        className="btn btn-ghost"
        style={dockBtn}
        onClick={() => host(paused ? { type: 'resume' } : { type: 'pause' })}
        title={paused ? 'Resume (R)' : 'Pause (P)'}
      >
        {paused ? '▶' : '⏸'}
      </button>
      <button className="btn btn-ghost" style={dockBtn} onClick={() => host({ type: 'skip' })} title="Skip">
        ⏭
      </button>
      <button className="btn btn-primary" style={{ ...dockBtn, padding: '8px 18px' }} onClick={() => host({ type: 'advance' })} title="Next (Space)">
        Next →
      </button>
      <div style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 4px' }} />
      <button className="btn btn-ghost btn-danger" style={dockBtn} onClick={() => host({ type: 'endGame' })} title="End game">
        ⏹
      </button>
    </div>
  );
}

const dockBtn: React.CSSProperties = { padding: '8px 12px', fontSize: 16, minWidth: 40 };
