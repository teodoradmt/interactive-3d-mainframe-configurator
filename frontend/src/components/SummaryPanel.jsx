import { currency, number } from '../utils/formatters.js';

const metricValueTranslations = new Map([
  ['DASD recovery', 'DASD възстановяване'],
  ['Invalid', 'Невалидна'],
  ['Low', 'Ниска'],
  ['None', 'Няма'],
  ['Tape recovery', 'Tape възстановяване'],
  ['Valid', 'Валидна'],
]);

function translateMetricValue(value) {
  return metricValueTranslations.get(value) ?? value;
}

export function SummaryPanel({
  frameEvaluation,
  isComplete,
  totals,
}) {
  const frameMetrics = frameEvaluation?.metrics ?? {};
  const safeTotals = totals ?? {
    total: 0,
    kw: 0,
    monthlyCost: 0,
    lpars: 0,
    ram: 0,
    io: 0,
  };

  return (
    <div className="summary">
      <h2>Оценка</h2>

      {!isComplete ? (
        <p className="summary-empty">Завърши CPC модулите, за да видиш оценката.</p>
      ) : (
        <>
          <Metric label="Обща цена" value={currency.format(safeTotals.total)} />
          <Metric label="Очаквана консумация" value={`${safeTotals.kw.toFixed(1)} kW`} />
          <Metric label="Месечен разход за електроенергия" value={currency.format(safeTotals.monthlyCost)} />
          <Metric label="CPC капацитет" value={`${number.format(frameMetrics.cpcCapacityScore ?? 0)}/100`} />
          <Metric label="LPAR капацитет" value={number.format(frameMetrics.lparCapacity ?? safeTotals.lpars ?? 0)} />
          <Metric label="Капацитет на паметта" value={`${number.format(frameMetrics.memoryCapacity ?? safeTotals.ram)} GB`} />
          <Metric label="I/O пропускателност" value={`${number.format(frameMetrics.ioThroughput ?? safeTotals.io ?? 0)} GbE`} />
          <Metric label="Storage готовност" value={`${number.format(frameMetrics.storageReadiness ?? 0)}/100`} />
          <Metric label="Оценка на сигурността" value={`${number.format(frameMetrics.securityScore ?? 0)}/100`} />
          <Metric label="Оценка на резервираност" value={`${number.format(frameMetrics.redundancyScore ?? 0)}/100`} />
          <Metric label="Ефективност на охлаждането" value={`${number.format(frameMetrics.coolingEfficiency ?? 0)}/100`} />
          <Metric label="Ниво на Disaster Recovery" value={translateMetricValue(frameMetrics.disasterRecoveryTier ?? 'None')} />
          <Metric label="Очаквана наличност" value={frameMetrics.estimatedAvailability ?? '99.40%'} />
          <Metric label="Production готовност" value={translateMetricValue(frameMetrics.productionReadiness ?? 'Low')} />
          <Metric label="Препоръчан frame" value={frameMetrics.recommendedFrameName ?? frameEvaluation?.recommendedFrame?.name ?? 'Z Frame'} />
          <Metric label="Статус на конфигурацията" value={translateMetricValue(frameMetrics.configurationValidity ?? 'Valid')} />

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
