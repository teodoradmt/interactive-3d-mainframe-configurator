import { currency, number } from '../utils/formatters.js';

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
        <p className="summary-empty">Завършете CPC модулите, за да видите оценката.</p>
      ) : (
        <>
          <Metric label="Обща цена" value={currency.format(safeTotals.total)} />
          <Metric label="Ориентировъчна консумация" value={`${safeTotals.kw.toFixed(1)} kW`} />
          <Metric label="Месечен разход за електроенергия" value={currency.format(safeTotals.monthlyCost)} />
          <Metric label="CPC capacity оценка" value={`${number.format(frameMetrics.cpcCapacityScore ?? 0)}/100`} />
          <Metric label="LPAR капацитет" value={number.format(frameMetrics.lparCapacity ?? safeTotals.lpars ?? 0)} />
          <Metric label="Memory капацитет" value={`${number.format(frameMetrics.memoryCapacity ?? safeTotals.ram)} GB`} />
          <Metric label="I/O пропускателност" value={`${number.format(frameMetrics.ioThroughput ?? safeTotals.io ?? 0)} GbE`} />
          <Metric label="Storage готовност" value={`${number.format(frameMetrics.storageReadiness ?? 0)}/100`} />
          <Metric label="Security оценка" value={`${number.format(frameMetrics.securityScore ?? 0)}/100`} />
          <Metric label="Redundancy оценка" value={`${number.format(frameMetrics.redundancyScore ?? 0)}/100`} />
          <Metric label="Cooling ефективност" value={`${number.format(frameMetrics.coolingEfficiency ?? 0)}/100`} />
          <Metric label="Disaster Recovery ниво" value={frameMetrics.disasterRecoveryTier ?? 'Няма'} />
          <Metric label="Очаквана availability" value={frameMetrics.estimatedAvailability ?? '99.40%'} />
          <Metric label="Production готовност" value={frameMetrics.productionReadiness ?? 'Ниска'} />
          <Metric label="Препоръчан frame" value={frameMetrics.recommendedFrameName ?? frameEvaluation?.recommendedFrame?.name ?? 'Z Frame'} />
          <Metric label="Валидност на конфигурацията" value={frameMetrics.configurationValidity ?? 'Валидна'} />

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
