import { Bot } from 'lucide-react';
import { currency, number } from '../utils/formatters.js';

export function SummaryPanel({
  aiError,
  aiModel,
  aiRecommendation,
  isAiLoading,
  isComplete,
  onRequestAiRecommendation,
  totals,
}) {
  return (
    <div className="summary">
      <h2>Оценка</h2>

      {!isComplete ? (
        <p className="summary-empty">Очаква се пълна конфигурация.</p>
      ) : (
        <>
          <Metric label="Цена" value={currency.format(totals.total)} />
          <Metric label="IBM Z капацитет" value={`${number.format(totals.cpu)} demo units`} />
          <Metric label="AI профил" value={`${number.format(totals.accelerator)} AI score`} />
          <Metric label="RAM" value={`${number.format(totals.ram)} GB`} />
          <Metric label="Storage" value={`${number.format(totals.storage)} TB`} />
          <Metric label="Електроенергия" value={`${totals.kw.toFixed(1)} kW`}   />
          <Metric label="Месечен разход" value={currency.format(totals.monthlyCost)} />
          <Metric label="Годишен разход" value={currency.format(totals.yearlyCost)} />

          <div className="ai-panel">
            <div className="ai-panel-head">
              <span>
                <Bot size={17} />
                AI анализ
              </span>
              {aiModel && <small>{aiModel}</small>}
            </div>

            <button
              className="ai-button"
              disabled={isAiLoading}
              onClick={onRequestAiRecommendation}
              type="button"
            >
              {isAiLoading ? 'AI анализира...' : 'AI анализ с Qwen3'}
            </button>

            {aiError && <p className="ai-error">{aiError}</p>}
            {aiRecommendation && <p className="ai-response">{aiRecommendation}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
