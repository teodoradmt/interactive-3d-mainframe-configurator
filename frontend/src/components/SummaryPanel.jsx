import { Zap } from 'lucide-react';
import { currency, number } from '../utils/formatters.js';

export function SummaryPanel({ isComplete, totals }) {
  return (
    <div className="summary">
      <h2>Оценка</h2>

      {!isComplete ? (
        <p className="summary-empty">Очаква се пълна конфигурация.</p>
      ) : (
        <>
          <Metric label="Цена" value={currency.format(totals.total)} />
          <Metric label="CPU капацитет" value={`${number.format(totals.cpu)} MIPS`} />
          <Metric label="GPU/accelerator" value={`${number.format(totals.accelerator)} AI units`} />
          <Metric label="RAM" value={`${number.format(totals.ram)} GB`} />
          <Metric label="Storage" value={`${number.format(totals.storage)} TB`} />
          <Metric label="Електроенергия" value={`${totals.kw.toFixed(1)} kW`} icon={<Zap size={16} />} />
          <Metric label="Месечен разход" value={currency.format(totals.monthlyCost)} />
          <Metric label="Годишен разход" value={currency.format(totals.yearlyCost)} />
          <p className="recommendation">
            Подходяща конфигурация за: <strong>{totals.recommendation || '...'}</strong>.
          </p>
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
