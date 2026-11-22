import { Heart, Music, Pause, Play, Shield, Volume2, VolumeX } from 'lucide-react';
import type { GameState, HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  gameState: GameState;
  muted: boolean;
  musicEnabled: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
}

export function GameHud({
  hud,
  gameState,
  muted,
  musicEnabled,
  onTogglePause,
  onToggleMute,
  onToggleMusic,
}: GameHudProps) {
  const hpRatio = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
  const hpStatus =
    hud.hp <= 35 ? 'CRITICAL' : hud.hp <= 65 ? 'CAUTION' : 'STABLE';
  const hpBarColor =
    hud.hp <= 35
      ? 'bg-red-500'
      : hud.hp <= 65
        ? 'bg-amber-400'
        : 'bg-emerald-400';
  const hpTextColor =
    hud.hp <= 35
      ? 'text-red-400'
      : hud.hp <= 65
        ? 'text-amber-300'
        : 'text-emerald-300';

  const shieldFill = hud.shieldActive
    ? hud.shieldActiveRatio
    : hud.shieldCooldownRatio;

  const shieldLabel = hud.shieldActive
    ? 'ACTIVE'
    : hud.shieldReady
      ? 'READY'
      : 'CHARGING';

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-2.5 backdrop-blur-md">
        {/* Left: Health & Shield Meters */}
        <div className="flex flex-wrap items-center gap-5">
          {/* Health Bar */}
          <div className="min-w-[168px] sm:min-w-[210px]">
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Heart className={`h-3.5 w-3.5 ${hpTextColor}`} aria-hidden="true" />
                <span className="font-mono tabular-nums">
                  HP {hud.hp}/{hud.maxHp}
                </span>
              </span>
              <span className={`font-mono text-[11px] font-bold tracking-wide ${hpTextColor}`}>
                {hpStatus}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-sm bg-slate-800">
              <div
                className={`h-full transition-[width] duration-150 ${hpBarColor}`}
                style={{ width: `${hpRatio * 100}%` }}
              />
            </div>
          </div>

          {/* Energy Shield Bar */}
          <div className="hidden min-w-[145px] sm:block">
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Shield
                  className={`h-3.5 w-3.5 ${
                    hud.shieldActive || hud.shieldReady
                      ? 'text-sky-400'
                      : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span>Shield</span>
              </span>
              <span
                className={`font-mono text-[11px] font-bold tracking-wide ${
                  hud.shieldActive
                    ? 'text-sky-300'
                    : hud.shieldReady
                      ? 'text-sky-400'
                      : 'text-slate-400'
                }`}
              >
                {shieldLabel}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-sm bg-slate-800">
              <div
                className={`h-full transition-[width] duration-100 ${
                  hud.shieldActive
                    ? 'bg-sky-300'
                    : hud.shieldReady
                      ? 'bg-sky-400'
                      : 'bg-slate-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(1, shieldFill)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center/Right: Score, Combo, Best & Action Controls */}
        <div className="flex items-center gap-5 sm:gap-7">
          <div className="flex items-baseline gap-5">
            <div className="text-right">
              <div className="text-[11px] font-medium text-slate-400">Score</div>
              <div className="font-mono text-lg font-bold leading-tight text-slate-50 tabular-nums sm:text-xl">
                {hud.score.toLocaleString()}
              </div>
            </div>

            <div className="hidden text-right sm:block">
              <div className="text-[11px] font-medium text-slate-400">High Score</div>
              <div
                className={`font-mono text-lg font-bold leading-tight tabular-nums sm:text-xl ${
                  hud.isNewHighScore ? 'text-amber-300' : 'text-sky-300'
                }`}
              >
                {hud.highScore.toLocaleString()}
              </div>
            </div>

            <div className="hidden text-right md:block">
              <div className="text-[11px] font-medium text-slate-400">Distance</div>
              <div className="font-mono text-base font-bold leading-tight text-slate-200 tabular-nums">
                {hud.distance}m
              </div>
            </div>

            {hud.combo > 1 && (
              <div className="hidden text-right lg:block">
                <div className="text-[11px] font-medium text-amber-300">Combo</div>
                <div className="font-mono text-base font-bold leading-tight text-amber-300 tabular-nums">
                  x{hud.combo}
                </div>
              </div>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMusic}
              aria-label={musicEnabled ? 'Disable music' : 'Enable music'}
              title={musicEnabled ? 'Music On' : 'Music Off'}
              className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                musicEnabled && !muted
                  ? 'border-sky-500/50 bg-slate-900/90 text-sky-300 hover:border-sky-400 hover:bg-slate-800'
                  : 'border-slate-700/70 bg-slate-900/90 text-slate-500 hover:border-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              <Music className="h-4 w-4" />
              {!musicEnabled && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute h-0.5 w-6 rotate-45 rounded-full bg-slate-400"
                />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/90 text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
              <button
                type="button"
                onClick={onTogglePause}
                aria-label={gameState === 'PAUSED' ? 'Resume game' : 'Pause game'}
                title={gameState === 'PAUSED' ? 'Resume (P)' : 'Pause (P)'}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/90 text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                {gameState === 'PAUSED' ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
