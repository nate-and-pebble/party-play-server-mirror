import type { PlayerEnvelope } from '@partyplay/shared';
import { QuibbleController } from './games/QuibbleController';
import { TriviaController } from './games/TriviaController';
import { DoodleController } from './games/DoodleController';
import { YouBar } from './YouBar';

export function GameController({ env }: { env: PlayerEnvelope }) {
  if (env.view.kind !== 'game') return null;
  const view = env.view.view;
  const gameId = view.gameId;
  return (
    <div className="col grow" style={{ minHeight: 0 }}>
      <YouBar you={env.you} accent={env.you.identity.color} />
      <div className="col grow" style={{ minHeight: 0 }}>
        {gameId === 'quibble' && <QuibbleController view={view} env={env} />}
        {gameId === 'trivia' && <TriviaController view={view} env={env} />}
        {gameId === 'doodle' && <DoodleController view={view} env={env} />}
      </div>
    </div>
  );
}
