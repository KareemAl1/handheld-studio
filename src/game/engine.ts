export type GamePhase = 'ready' | 'running' | 'paused' | 'over';
export type Lane = 0 | 1 | 2;
export type GameEntity = Readonly<{
  id: number;
  kind: 'signal' | 'hazard';
  lane: Lane;
  born: number;
  progress: number;
}>;

export type GameState = Readonly<{
  phase: GamePhase;
  score: number;
  lane: Lane;
  elapsed: number;
  entities: readonly GameEntity[];
  seed: number;
  nextEntity: number;
  nextSpawn: number;
}>;

export type GameAction =
  | { type: 'start' | 'restart' | 'pause' | 'resume' }
  | { type: 'move'; direction: -1 | 1 }
  | { type: 'tick'; seconds: number };

const INITIAL_SEED = 0x48533031;
const TRAVEL_SECONDS = 2;
const EPSILON = 1e-9;

/** A fresh run always starts with the same approachable, learnable sequence. */
export function createGame(): GameState {
  return {
    phase: 'ready', score: 0, lane: 1, elapsed: 0, entities: [],
    seed: INITIAL_SEED, nextEntity: 0, nextSpawn: 0,
  };
}

function random(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function spawn(state: GameState, elapsed: number): Pick<GameState, 'entities' | 'nextSpawn' | 'nextEntity' | 'seed'> {
  let { seed, nextEntity, nextSpawn } = state;
  const entities = [...state.entities];
  while (nextSpawn <= elapsed + EPSILON) {
    let kind: GameEntity['kind'];
    let lane: Lane;
    if (nextEntity < 4) {
      // The opening teaches collecting before asking the player to dodge.
      kind = nextEntity === 3 ? 'hazard' : 'signal';
      lane = ([1, 0, 2, 1] as const)[nextEntity];
    } else {
      seed = random(seed);
      lane = (seed % 3) as Lane;
      kind = nextEntity % 3 === 1 ? 'signal' : 'hazard';
    }
    entities.push({ id: nextEntity, kind, lane, born: nextSpawn, progress: 0 });
    nextEntity += 1;
    if (nextEntity === 1) nextSpawn = 1.1;
    else if (nextEntity === 2) nextSpawn = 2.2;
    else if (nextEntity === 3) nextSpawn = 3;
    else nextSpawn += Math.max(0.72, 1.14 - Math.floor(nextEntity / 12) * 0.06);
  }
  return { entities, nextSpawn, nextEntity, seed };
}

/**
 * Pure simulation; the browser owns input and the fixed-step clock. Oversized
 * deltas are ignored rather than teleporting entities after a background tab.
 */
export function updateGame(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready'
        ? { ...state, phase: 'running', ...spawn(state, 0) }
        : state;
    case 'restart': {
      const fresh = createGame();
      return { ...fresh, phase: 'running', ...spawn(fresh, 0) };
    }
    case 'pause':
      return state.phase === 'running' ? { ...state, phase: 'paused' } : state;
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'running' } : state;
    case 'move': {
      if (state.phase !== 'running' || (action.direction !== -1 && action.direction !== 1)) return state;
      const lane = Math.max(0, Math.min(2, state.lane + action.direction)) as Lane;
      return lane === state.lane ? state : { ...state, lane };
    }
    case 'tick': {
      if (state.phase !== 'running' || !Number.isFinite(action.seconds) || action.seconds <= 0 || action.seconds > 0.25) return state;
      const elapsed = state.elapsed + action.seconds;
      const spawned = spawn(state, elapsed);
      const entities: GameEntity[] = [];
      let score = state.score;
      let collision: GameEntity | undefined;

      // Absolute birth times keep speed independent of spawn boundaries and
      // frame partitioning. Crossing tests also prevent tunneling at low FPS.
      for (const entity of spawned.entities) {
        const progress = (elapsed - entity.born) / TRAVEL_SECONDS;
        if (progress >= 1 - EPSILON) {
          if (entity.lane === state.lane) {
            if (entity.kind === 'hazard') {
              collision = { ...entity, progress: 1 };
              break;
            }
            score += 10;
          }
        } else {
          entities.push({ ...entity, progress });
        }
      }

      if (collision) {
        const collisionTime = collision.born + TRAVEL_SECONDS;
        // End the random/spawn clock at the collision itself, even if a coarse
        // frame extended past it; replay state must not depend on frame size.
        const stopped = spawn(state, collisionTime);
        return {
          ...state, ...stopped, phase: 'over', score, elapsed: collisionTime,
          entities: stopped.entities
            .filter((entity) => entity.id >= collision.id && entity.born <= collisionTime)
            .map((entity) => ({ ...entity, progress: (collisionTime - entity.born) / TRAVEL_SECONDS })),
        };
      }
      return { ...state, ...spawned, elapsed, score, entities };
    }
  }
}
