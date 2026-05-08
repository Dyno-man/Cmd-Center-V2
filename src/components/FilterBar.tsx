import { SlidersHorizontal } from "lucide-react";
import { continents, newsTypes } from "../data/sampleData";

interface Props {
  activeContinents: string[];
  activeNewsTypes: string[];
  onContinentsChange: (continents: string[]) => void;
  onNewsTypesChange: (types: string[]) => void;
}

export function FilterBar({ activeContinents, activeNewsTypes, onContinentsChange, onNewsTypesChange }: Props) {
  const toggle = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  return (
    <div className="filter-bar">
      <details className="filter-popover">
        <summary>
          <SlidersHorizontal size={18} />
          Filters
        </summary>
        <div className="filter-panel">
          <div>
            <h3>News Type</h3>
            {newsTypes.map((type) => (
              <label key={type}>
                <input
                  checked={activeNewsTypes.includes(type)}
                  onChange={() => toggle(type, activeNewsTypes, onNewsTypesChange)}
                  type="checkbox"
                />
                {type}
              </label>
            ))}
          </div>
          <div>
            <h3>Continents</h3>
            {continents.map((continent) => (
              <label key={continent}>
                <input
                  checked={activeContinents.includes(continent)}
                  onChange={() => toggle(continent, activeContinents, onContinentsChange)}
                  type="checkbox"
                />
                {continent}
              </label>
            ))}
          </div>
        </div>
      </details>
      <button className="toolbar-button" type="button">Continent Filter</button>
      <div className="toolbar-spacer">Reserved for additional filters</div>
    </div>
  );
}
