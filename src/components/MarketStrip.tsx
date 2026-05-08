import type { MarketIndex } from "../types/domain";

interface Props {
  indexes: MarketIndex[];
}

export function MarketStrip({ indexes }: Props) {
  return (
    <div className="market-strip" aria-label="Major market indexes">
      {indexes.map((index) => (
        <div className={`market-card ${index.change >= 0 ? "market-card--up" : "market-card--down"}`} key={index.symbol}>
          <span className="market-card__name">{index.name}</span>
          <strong>{index.value}</strong>
          <span>{index.change >= 0 ? "+" : ""}{index.change.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}
