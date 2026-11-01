import { useState } from "react";

export interface ChanceRound {
  game: { id: number; name: string };
  winByGame: Record<number, number>;
  riskByGame: Record<number, number>;
  approximate: boolean;
}

const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function ChanceBar({ label, value, approximate, risk }: {
  label: string; value: number; approximate?: boolean; risk?: boolean;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
      <span className="break-words">{label}</span>
      <span className="tabular-nums">{approximate && "≈"}{percent.format(value)}%</span>
      <div aria-hidden="true" className="col-span-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={risk ? "h-full bg-rose-500" : "h-full bg-violet-500"} style={{ width: `${value}%` }} />
      </div>
    </li>
  );
}

export default function RoundChanceCharts({ rounds, winner }: {
  rounds: ChanceRound[]; winner: { id: number; name: string };
}) {
  const [gameId, setGameId] = useState(winner.id);
  const [roundIndex, setRoundIndex] = useState(rounds.length - 1);
  const games = [winner, ...rounds.map(round => round.game).filter(game => game.id !== winner.id)];
  const selected = rounds[roundIndex];
  return (
    <section className="mt-4 space-y-5 rounded-lg border bg-background p-4 text-sm">
      <h2 className="text-lg font-semibold">Шансы по итогам рулетки</h2>
      <p className="text-muted-foreground">Значения перед каждым вращением. Знак ≈ означает приблизительный расчёт.</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Как менялся шанс победы</h3>
        <label className="block">Игра
          <select className="block w-full rounded border bg-background p-2" value={gameId} onChange={event => setGameId(Number(event.target.value))}>
            {games.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}
          </select>
        </label>
        <ol className="space-y-2">
          {rounds.map((round, index) => round.winByGame[gameId] !== undefined && (
            <ChanceBar key={index} label={`Раунд ${index + 1}${round.game.id === gameId && winner.id !== gameId ? " · выбыла" : ""}`}
              value={round.winByGame[gameId]} approximate={round.approximate} />
          ))}
        </ol>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Риск выбывания по играм</h3>
        <label className="block">Раунд
          <select className="block w-full rounded border bg-background p-2" value={roundIndex} onChange={event => setRoundIndex(Number(event.target.value))}>
            {rounds.map((_, index) => <option key={index} value={index}>Раунд {index + 1}</option>)}
          </select>
        </label>
        <ul className="space-y-2">
          {games.filter(game => selected.riskByGame[game.id] !== undefined).map(game => (
            <ChanceBar key={game.id} label={`${game.name}${selected.game.id === game.id && winner.id !== game.id ? " · выбыла" : ""}`}
              value={selected.riskByGame[game.id]} risk />
          ))}
        </ul>
      </div>
    </section>
  );
}
