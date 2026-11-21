import { Play, RotateCcw, Shield, Trophy } from 'lucide-react';
import type { GameState, HudSnapshot } from '../game/types';

interface GameOverlaysProps {
  gameState: GameState;
  hud: HudSnapshot;
  onStart: () => void;
  onResume: () => void;
  onRestart: () => void;
}

export function GameOverlays({
  gameState,
  hud,
  onStart,
  onResume,
  onRestart,
}: GameOverlaysProps) {
  if (gameState === 'PLAYING') return null;

  if (gameState === 'TITLE_MENU') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-950/70 p-3">
              <img
                src="./assets/aistudio/hero_78bebaf3.png"
                alt="Iron Crown tank hero"
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h1
                className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl"
                style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
              >
                Iron Crown
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Pilot your armored cannon-bot across endless orbital decks. Leap over
                deep chasms with jet thrusters, deflect incoming fire with your shield,
                and blast mechanical enemies for combo multipliers.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-slate-400 sm:justify-start tabular-nums">
                <span>Best Score: {hud.highScore.toLocaleString()}</span>
                <span aria-hidden="true">·</span>
                <span>Best Distance: {hud.bestDistance}m</span>
                <span aria-hidden="true">·</span>
                <span>Best Combo: x{Math.max(1, hud.bestCombo)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-800 pt-5 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="font-semibold text-slate-100">Move</div>
              <div className="mt-1 font-mono text-slate-400">A / D or Arrows</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="font-semibold text-slate-100">Jump &amp; Boost</div>
              <div className="mt-1 font-mono text-slate-400">Space / W (x2)</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="font-semibold text-slate-100">Fire Cannon</div>
              <div className="mt-1 font-mono text-slate-400">L-Click / J / F</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="font-semibold text-slate-100">Energy Shield</div>
              <div className="mt-1 font-mono text-slate-400">R-Click / Shift / K</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              Collect emerald medkits to restore health and cyan cells to recharge your shield.
            </p>
            <button
              type="button"
              onClick={onStart}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-500 px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start Game</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'PAUSED') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 text-center shadow-2xl">
          <h2
            className="text-3xl font-bold text-slate-50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Game Paused
          </h2>
          <p className="mt-1.5 text-sm text-slate-300">
            Current score: <span className="font-mono font-semibold tabular-nums">{hud.score.toLocaleString()}</span>
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onResume}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Resume</span>
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Restart</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // GAME_OVER
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-3xl font-bold text-slate-50 sm:text-4xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Run Complete
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              {hud.deathReason || 'Armor integrity depleted'}
            </p>
          </div>

          {hud.isNewHighScore ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 whitespace-nowrap">
              <Trophy className="h-4 w-4" />
              <span>New High Score</span>
            </div>
          ) : (
            <Shield className="h-6 w-6 text-slate-500 shrink-0" aria-hidden="true" />
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-800 py-4">
          <div>
            <div className="text-xs text-slate-400">Final Score</div>
            <div className="mt-0.5 font-mono text-2xl font-bold text-slate-50 tabular-nums">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">High Score</div>
            <div className="mt-0.5 font-mono text-2xl font-bold text-sky-300 tabular-nums">
              {hud.highScore.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Distance</div>
            <div className="mt-0.5 font-mono text-lg font-bold text-slate-200 tabular-nums">
              {hud.distance}m
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Enemies Destroyed</div>
            <div className="mt-0.5 font-mono text-lg font-bold text-slate-200 tabular-nums">
              {hud.kills}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            Best Combo: x{Math.max(1, hud.bestCombo)}
          </span>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-500 px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
