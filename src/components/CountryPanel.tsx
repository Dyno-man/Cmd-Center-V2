import { ArrowLeft, Plus } from "lucide-react";
import type { ArticleContext, CountryContext, MarketCategory, ScoreBand } from "../types/domain";

interface Props {
  country: CountryContext;
  selectedCategory: MarketCategory | null;
  selectedArticle: ArticleContext | null;
  onSelectCategory: (category: MarketCategory | null) => void;
  onSelectArticle: (article: ArticleContext | null) => void;
  onAddContext: (label: string, content: string) => void;
}

const bandForScore = (score: number): ScoreBand => {
  if (score <= 50) return "low";
  if (score <= 75) return "medium";
  return "great";
};

export function CountryPanel({
  country,
  selectedCategory,
  selectedArticle,
  onSelectCategory,
  onSelectArticle,
  onAddContext
}: Props) {
  if (selectedArticle) {
    return (
      <aside className="country-panel">
        <PanelHeader
          title={selectedArticle.title}
          onBack={() => onSelectArticle(null)}
          onAdd={() => onAddContext(selectedArticle.title, articleContext(selectedArticle))}
        />
        <div className="article-detail">
          <div className="detail-block detail-block--blue">
            <h3>Market Impact</h3>
            <p>{selectedArticle.summary}</p>
            <p>{selectedArticle.marketReason}</p>
          </div>
          <div className="detail-block detail-block--tan">
            <h3>Weight {selectedArticle.weight.toFixed(2)}</h3>
            <p>
              This article contributes to the category score based on recency, source relevance, country specificity,
              and direct market linkage.
            </p>
            <a href={selectedArticle.url} rel="noreferrer" target="_blank">Open original article</a>
          </div>
        </div>
      </aside>
    );
  }

  if (selectedCategory) {
    return (
      <aside className="country-panel">
        <PanelHeader
          title={selectedCategory.label}
          onBack={() => onSelectCategory(null)}
          onAdd={() => onAddContext(selectedCategory.label, categoryContext(selectedCategory))}
        />
        <div className="detail-block detail-block--green">
          <h3>Current Market Impacts</h3>
          <p>{selectedCategory.impactSummary}</p>
        </div>
        <div className="article-list">
          {selectedCategory.articles.map((article) => (
            <button key={article.id} onClick={() => onSelectArticle(article)} type="button">
              <span>{article.title}</span>
              <strong>{article.weight.toFixed(2)}</strong>
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="country-panel">
      <PanelHeader
        title={country.name}
        onAdd={() => onAddContext(country.name, countryContext(country))}
      />
      <div className="score-list">
        {country.categories.map((category) => {
          const band = bandForScore(category.score);
          return (
            <button className="score-card" key={category.id} onClick={() => onSelectCategory(category)} type="button">
              <span className={`score-pill score-pill--${band}`}>{category.score}</span>
              <span>
                <strong>{category.label}</strong>
                <small>{category.summary}</small>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function PanelHeader({ title, onBack, onAdd }: { title: string; onBack?: () => void; onAdd?: () => void }) {
  return (
    <div className="panel-header">
      {onBack ? (
        <button aria-label="Back" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={18} />
        </button>
      ) : <span />}
      <h2>{title}</h2>
      {onAdd ? (
        <button aria-label="Add context to chat" className="icon-button" onClick={onAdd} type="button">
          <Plus size={18} />
        </button>
      ) : <span />}
    </div>
  );
}

function countryContext(country: CountryContext) {
  return `${country.name}\n${country.categories.map((category) => `${category.label}: ${category.score} - ${category.summary}`).join("\n")}`;
}

function categoryContext(category: MarketCategory) {
  return `${category.label} score ${category.score}\n${category.impactSummary}\nArticles:\n${category.articles.map((article) => `- ${article.title} (${article.weight.toFixed(2)}): ${article.summary}`).join("\n")}`;
}

function articleContext(article: ArticleContext) {
  return `${article.title}\nSource: ${article.source}\nWeight: ${article.weight.toFixed(2)}\n${article.summary}\n${article.marketReason}\n${article.url}`;
}
