import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Shield } from 'lucide-react';
import { GameHud } from './components/GameHud';
import { GameOverlays } from './components/GameOverlays';
import { IronCrownEngine, type InputState } from './game/engine';
import { sound } from './game/sound';
import { loadGameSprites } from './game/sprites';
import { loadHighScoreRecord } from './game/storage';
import type { GameState, HudSnapshot } from './game/types';

function createInitialHud(): HudSnapshot {
  const rec = loadHighScoreRecord();
  return {
    score: 0,
    highScore: rec.highScore,
    isNewHighScore: false,
    distance: 0,
    kills: 0,
    combo: 1,
    comboTimerRatio: 0,
    hp: 100,
    maxHp: 100,
    shieldActive: false,
    shieldActiveRatio: 0,
    shieldReady: true,
    shieldCooldownRatio: 1,
    speedMultiplier: 1,
    bestDistance: rec.bestDistance,
    bestKills: rec.bestKills,
    bestCombo: rec.bestCombo,
    deathReason: '',
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<IronCrownEngine | null>(null);

  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
    down: false,
    shoot: false,
    shieldPressed: false,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud());
  const [muted, setMuted] = useState<boolean>(() => sound.isMuted());

  const gameOverAtRef = useRef<number>(0);

  const syncHudFromEngine = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const nextState = engine.getState();
    setGameState((prev) => {
      if (prev !== 'GAME_OVER' && nextState === 'GAME_OVER') {
        gameOverAtRef.current = performance.now();
      }
      return nextState;
    });
    setHud(engine.getHudSnapshot());
  }, []);

  const handleStart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.startNewRun();
    syncHudFromEngine();
  }, [syncHudFromEngine]);

  const handleTogglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const current = engine.getState();
    if (current === 'PLAYING') {
      engine.setState('PAUSED');
      syncHudFromEngine();
    } else if (current === 'PAUSED') {
      engine.setState('PLAYING');
      syncHudFromEngine();
    }
  }, [syncHudFromEngine]);

  const handleResume = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setState('PLAYING');
    syncHudFromEngine();
  }, [syncHudFromEngine]);

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.startNewRun();
    syncHudFromEngine();
  }, [syncHudFromEngine]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = sound.toggleMute();
    setMuted(nextMuted);
  }, []);

  // Initialize sprites, engine, and main animation loop
  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    const setup = async () => {
      try {
        const sprites = await loadGameSprites();
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setLoadError('Unable to initialize 2D graphics context.');
          setLoading(false);
          return;
        }

        const updateCanvasSize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = window.innerWidth;
          const h = window.innerHeight;
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          engineRef.current?.resize(w, h);
        };

        const engine = new IronCrownEngine(sprites, window.innerWidth, window.innerHeight);
        engineRef.current = engine;
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);

        setLoading(false);
        syncHudFromEngine();

        let lastTime = performance.now();
        let hudSyncAccumulator = 0;

        const tick = (now: number) => {
          if (cancelled) return;
          const dt = (now - lastTime) / 1000;
          lastTime = now;

          const currentInput = inputRef.current;
          const prevState = engine.getState();

          engine.update(dt, currentInput);

          // Consume single-frame edge triggers
          currentInput.jumpPressed = false;
          currentInput.shieldPressed = false;

          engine.render(ctx);

          const nextState = engine.getState();
          hudSyncAccumulator += dt;
          if (nextState !== prevState || hudSyncAccumulator >= 0.065) {
            hudSyncAccumulator = 0;
            syncHudFromEngine();
          }

          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);

        return () => {
          window.removeEventListener('resize', updateCanvasSize);
        };
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Failed to load game sprites.'
          );
          setLoading(false);
        }
      }
      return undefined;
    };

    let cleanupResize: (() => void) | undefined;
    setup().then((fn) => {
      cleanupResize = fn;
    });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (cleanupResize) cleanupResize();
    };
  }, [syncHudFromEngine]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const engine = engineRef.current;
      const state = engine?.getState();

      if (
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      if (code === 'KeyM' && !e.repeat) {
        handleToggleMute();
        return;
      }

      if ((code === 'KeyP' || code === 'Escape') && !e.repeat) {
        if (state === 'PLAYING' || state === 'PAUSED') {
          handleTogglePause();
        }
        return;
      }

      if (state === 'TITLE_MENU' && (code === 'Enter' || code === 'Space') && !e.repeat) {
        handleStart();
        return;
      }

      if (
        state === 'GAME_OVER' &&
        (code === 'Enter' || code === 'Space') &&
        !e.repeat &&
        performance.now() - gameOverAtRef.current > 450
      ) {
        handleRestart();
        return;
      }

      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') inputRef.current.right = true;
      if (code === 'KeyS' || code === 'ArrowDown') inputRef.current.down = true;
      if (code === 'KeyJ' || code === 'KeyF' || code === 'Enter') {
        inputRef.current.shoot = true;
      }

      if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        if (!inputRef.current.jumpHeld) {
          inputRef.current.jumpPressed = true;
        }
        inputRef.current.jumpHeld = true;
      }

      if ((code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK') && !e.repeat) {
        inputRef.current.shieldPressed = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') inputRef.current.right = false;
      if (code === 'KeyS' || code === 'ArrowDown') inputRef.current.down = false;
      if (code === 'KeyJ' || code === 'KeyF' || code === 'Enter') {
        inputRef.current.shoot = false;
      }
      if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        inputRef.current.jumpHeld = false;
      }
    };

    const onBlur = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.down = false;
      inputRef.current.shoot = false;
      inputRef.current.jumpHeld = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleRestart, handleStart, handleToggleMute, handleTogglePause]);

  return (
    <main className="game-canvas-lock relative h-screen w-screen overflow-hidden bg-[#080D18]">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onMouseDown={(e) => {
          if (gameState !== 'PLAYING') return;
          if (e.button === 0) {
            inputRef.current.shoot = true;
          } else if (e.button === 2) {
            inputRef.current.shieldPressed = true;
          }
        }}
        onMouseUp={(e) => {
          if (e.button === 0) {
            inputRef.current.shoot = false;
          }
        }}
        onMouseLeave={() => {
          inputRef.current.shoot = false;
        }}
        onContextMenu={(e) => {
          e.preventDefault();
        }}
      />

      {!loading && !loadError && (
        <GameHud
          hud={hud}
          gameState={gameState}
          muted={muted}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
        />
      )}

      {!loading && !loadError && (
        <GameOverlays
          gameState={gameState}
          hud={hud}
          onStart={handleStart}
          onResume={handleResume}
          onRestart={handleRestart}
        />
      )}

      {/* Touch controls for mobile / tablet viewports during active play */}
      {!loading && !loadError && gameState === 'PLAYING' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-end justify-between px-4 lg:hidden">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Move Left"
              onPointerDown={() => {
                inputRef.current.left = true;
              }}
              onPointerUp={() => {
                inputRef.current.left = false;
              }}
              onPointerCancel={() => {
                inputRef.current.left = false;
              }}
              onPointerLeave={() => {
                inputRef.current.left = false;
              }}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 text-slate-100 active:bg-slate-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Drop Down"
              onPointerDown={() => {
                inputRef.current.down = true;
              }}
              onPointerUp={() => {
                inputRef.current.down = false;
              }}
              onPointerCancel={() => {
                inputRef.current.down = false;
              }}
              onPointerLeave={() => {
                inputRef.current.down = false;
              }}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 text-slate-100 active:bg-slate-700"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Move Right"
              onPointerDown={() => {
                inputRef.current.right = true;
              }}
              onPointerUp={() => {
                inputRef.current.right = false;
              }}
              onPointerCancel={() => {
                inputRef.current.right = false;
              }}
              onPointerLeave={() => {
                inputRef.current.right = false;
              }}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 text-slate-100 active:bg-slate-700"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <div className="pointer-events-auto flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Activate Shield"
              onPointerDown={() => {
                inputRef.current.shieldPressed = true;
              }}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-500/60 bg-slate-900/85 text-sky-300 active:bg-sky-900/60"
            >
              <Shield className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Fire Cannon"
              onPointerDown={() => {
                inputRef.current.shoot = true;
              }}
              onPointerUp={() => {
                inputRef.current.shoot = false;
              }}
              onPointerCancel={() => {
                inputRef.current.shoot = false;
              }}
              onPointerLeave={() => {
                inputRef.current.shoot = false;
              }}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/60 bg-slate-900/85 text-amber-300 active:bg-amber-900/60"
            >
              <Crosshair className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Jump"
              onPointerDown={() => {
                inputRef.current.jumpPressed = true;
                inputRef.current.jumpHeld = true;
              }}
              onPointerUp={() => {
                inputRef.current.jumpHeld = false;
              }}
              onPointerCancel={() => {
                inputRef.current.jumpHeld = false;
              }}
              onPointerLeave={() => {
                inputRef.current.jumpHeld = false;
              }}
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500 text-slate-950 active:bg-sky-400"
            >
              <ArrowUp className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#080D18]">
          <div className="text-center">
            <div
              className="text-3xl font-bold text-slate-100"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Iron Crown
            </div>
            <p className="mt-2 text-sm text-slate-400">Loading tactical assets…</p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#080D18] p-6">
          <div className="max-w-md rounded-xl border border-red-500/40 bg-slate-900 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-300">Unable to Load Assets</h2>
            <p className="mt-2 text-sm text-slate-300">{loadError}</p>
          </div>
        </div>
      )}
    </main>
  );
}
