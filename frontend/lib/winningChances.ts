import type { WheelGame } from '@/components/RouletteWheel';

export const MAX_DP_GAMES = 12;

export const computeWinningChances = (
  games: WheelGame[],
  coeff: number,
  zero: number
): Record<number, number> => {
  if (games.length === 0) return {};

  if (games.length > MAX_DP_GAMES) {
    // Too many games for exact computation – fall back to Monte Carlo.
    const iterations = 5000;
    const groupSizes: Record<number, number> = {};
    const winsByVoteCount: Record<number, number> = {};
    for (const game of games) {
      groupSizes[game.count] = (groupSizes[game.count] ?? 0) + 1;
    }
    for (let k = 0; k < iterations; k++) {
      let remaining = [...games];
      while (remaining.length > 1) {
        const max = remaining.reduce((m, g) => Math.max(m, g.count), 0);
        const weights = remaining.map((g) => ({
          g,
          weight: g.count === 0 ? zero : 1 + coeff * (max - g.count),
        }));
        const total = weights.reduce((s, w) => s + w.weight, 0);
        let r = Math.random() * total;
        for (const { g, weight } of weights) {
          if (r < weight) {
            remaining = remaining.filter((x) => x.id !== g.id);
            break;
          }
          r -= weight;
        }
      }
      const votes = remaining[0].count;
      winsByVoteCount[votes] = (winsByVoteCount[votes] ?? 0) + 1;
    }
    const approx: Record<number, number> = {};
    for (const game of games) {
      const groupWins = winsByVoteCount[game.count] ?? 0;
      approx[game.id] = (groupWins / iterations / groupSizes[game.count]) * 100;
    }
    return approx;
  }

  const n = games.length;
  const ids = games.map((g) => g.id);
  const counts = games.map((g) => g.count);
  const fullMask = (1 << n) - 1;
  const dp: Record<number, number> = { [fullMask]: 1 };
  const winProb: number[] = new Array(n).fill(0);

  for (let mask = fullMask; mask > 0; mask--) {
    const prob = dp[mask];
    if (!prob) continue;

    const remainingIdx: number[] = [];
    let maxCount = -Infinity;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        remainingIdx.push(i);
        if (counts[i] > maxCount) maxCount = counts[i];
      }
    }
    if (remainingIdx.length === 1) {
      winProb[remainingIdx[0]] += prob;
      continue;
    }

    const weights = remainingIdx.map((idx) => ({
      idx,
      weight: counts[idx] === 0 ? zero : 1 + coeff * (maxCount - counts[idx]),
    }));
    const total = weights.reduce((s, w) => s + w.weight, 0);
    for (const { idx, weight } of weights) {
      const nextMask = mask & ~(1 << idx);
      dp[nextMask] = (dp[nextMask] ?? 0) + prob * (weight / total);
    }
  }

  const result: Record<number, number> = {};
  for (let i = 0; i < n; i++) {
    result[ids[i]] = winProb[i] * 100;
  }
  return result;
};
