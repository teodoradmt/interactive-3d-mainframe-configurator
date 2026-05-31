import { AlertTriangle, Server } from 'lucide-react';
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
      <h2>Evaluation</h2>

      {!isComplete ? (
        <p className="summary-empty">Complete the CPC modules to see the evaluation.</p>
      ) : (
        <>
          <Metric label="Total price" value={currency.format(safeTotals.total)} />
          <Metric label="Estimated power usage" value={`${safeTotals.kw.toFixed(1)} kW`} />
          <Metric label="Monthly electricity cost" value={currency.format(safeTotals.monthlyCost)} />
          <Metric label="CPC capacity score" value={`${number.format(frameMetrics.cpcCapacityScore ?? 0)}/100`} />
          <Metric label="LPAR capacity" value={number.format(frameMetrics.lparCapacity ?? safeTotals.lpars ?? 0)} />
          <Metric label="Memory capacity" value={`${number.format(frameMetrics.memoryCapacity ?? safeTotals.ram)} GB`} />
          <Metric label="I/O throughput" value={`${number.format(frameMetrics.ioThroughput ?? safeTotals.io ?? 0)} GbE`} />
          <Metric label="Storage readiness" value={`${number.format(frameMetrics.storageReadiness ?? 0)}/100`} />
          <Metric label="Security score" value={`${number.format(frameMetrics.securityScore ?? 0)}/100`} />
          <Metric label="Redundancy score" value={`${number.format(frameMetrics.redundancyScore ?? 0)}/100`} />
          <Metric label="Cooling efficiency" value={`${number.format(frameMetrics.coolingEfficiency ?? 0)}/100`} />
          <Metric label="Disaster Recovery Tier" value={frameMetrics.disasterRecoveryTier ?? 'None'} />
          <Metric label="Estimated Availability" value={frameMetrics.estimatedAvailability ?? '99.40%'} />
          <Metric label="Production readiness" value={frameMetrics.productionReadiness ?? 'Low'} />
          <Metric label="Recommended frame" value={frameMetrics.recommendedFrameName ?? frameEvaluation?.recommendedFrame?.name ?? 'Z Frame'} />
          <Metric label="Configuration validity" value={frameMetrics.configurationValidity ?? 'Valid'} />

          {(frameEvaluation?.warnings?.length > 0 || frameEvaluation?.info?.length > 0) && (
            <div className="evaluation-messages">
              {frameEvaluation.warnings.map((message) => (
                <p className="evaluation-message warning" key={message}>
                  <AlertTriangle size={15} />
                  {message}
                </p>
              ))}
              {frameEvaluation.info.map((message) => (
                <p className="evaluation-message info" key={message}>
                  <Server size={15} />
                  {message}
                </p>
              ))}
            </div>
          )}

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
