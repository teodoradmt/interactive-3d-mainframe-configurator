export const FRAME_AUTO_ID = 'auto';
export const DEFAULT_FRAME_ID = 'single-z';

export const frameConfigurations = [
  {
    id: 'single-z',
    name: 'Z Frame',
    shortName: 'Z Frame',
    tier: 1,
    frameCount: 1,
    description: 'Primary CPC frame with a left-side door that opens to the left.',
  },
  {
    id: 'z-plus-a',
    name: 'Z Frame + A Frame',
    shortName: 'Z + A',
    tier: 2,
    frameCount: 2,
    description: 'Enterprise pair with the Z Frame door on the left and the A Frame door on the right.',
  },
];

export const frameSelectionOptions = [
  {
    id: FRAME_AUTO_ID,
    name: 'Auto',
    shortName: 'Auto',
    frameCount: 1,
    description: 'Automatically selects Z Frame or Z Frame + A Frame based on the selected modules.',
  },
  ...frameConfigurations,
];

export function getFrameConfiguration(frameId) {
  return frameConfigurations.find((frame) => frame.id === frameId) ?? frameConfigurations[0];
}

export function getFrameSelectionOption(frameId) {
  return frameSelectionOptions.find((frame) => frame.id === frameId) ?? frameSelectionOptions[0];
}

function isExternalModule(module) {
  return module.required === false || module.category === 'external';
}

function getModule(modules, moduleId) {
  return modules.find((module) => module.id === moduleId);
}

function getSelectedIndex(selection, moduleId) {
  const value = selection[moduleId];
  const optionIndex = Number(value);

  return Number.isInteger(optionIndex) ? optionIndex : undefined;
}

function getSelectedOption(modules, selection, moduleId) {
  const module = getModule(modules, moduleId);
  const optionIndex = getSelectedIndex(selection, moduleId);

  return module && optionIndex !== undefined ? module.options[optionIndex] : null;
}

function hasSelection(selection, moduleId) {
  return getSelectedIndex(selection, moduleId) !== undefined;
}

function getSelectedExternalModules(modules, selection) {
  return modules.filter((module) => isExternalModule(module) && hasSelection(selection, module.id));
}

function getRecommendedFrameTier({
  cyberSelected,
  externalCount,
  ioIndex,
  memoryIndex,
  powerIndex,
  processorIndex,
  tapeSelected,
}) {
  let tier = 1;

  if (processorIndex === 2 || memoryIndex === 2 || ioIndex === 2 || powerIndex === 2 || externalCount > 0 || tapeSelected || cyberSelected) {
    tier = 2;
  }

  return tier;
}

function getFrameForTier(tier) {
  return frameConfigurations.find((frame) => frame.tier >= tier) ?? frameConfigurations[frameConfigurations.length - 1];
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getReadinessLabel(score) {
  if (score >= 86) {
    return 'Very High';
  }

  if (score >= 70) {
    return 'High';
  }

  if (score >= 46) {
    return 'Medium';
  }

  return 'Low';
}

function getDisasterRecoveryTier({ cyberSelected, tapeSelected, externalDASDIndex }) {
  if (cyberSelected) {
    return 'Cyber Vault';
  }

  if (tapeSelected) {
    return 'Tape Recovery';
  }

  if (externalDASDIndex !== undefined) {
    return 'DASD Recovery';
  }

  return 'None';
}

function getStorageReadiness({ externalCount, externalDASDIndex, tapeSelected, cyberSelected }) {
  if (externalCount === 0) {
    return 15;
  }

  let score = externalDASDIndex === undefined ? 35 : [58, 76, 88][externalDASDIndex] ?? 58;

  if (tapeSelected) {
    score += 8;
  }

  if (cyberSelected) {
    score += 10;
  }

  return clampScore(score);
}

function buildContext({ modules, selection, totals }) {
  const selectedExternalModules = getSelectedExternalModules(modules, selection);

  return {
    coolingIndex: getSelectedIndex(selection, 'cooling') ?? 0,
    coolingOption: getSelectedOption(modules, selection, 'cooling'),
    cyberSelected: hasSelection(selection, 'cyberVault'),
    externalCount: selectedExternalModules.length,
    externalDASDIndex: getSelectedIndex(selection, 'externalDASD'),
    ioIndex: getSelectedIndex(selection, 'storage') ?? 0,
    ioOption: getSelectedOption(modules, selection, 'storage'),
    managementIndex: getSelectedIndex(selection, 'network') ?? 0,
    managementOption: getSelectedOption(modules, selection, 'network'),
    memoryIndex: getSelectedIndex(selection, 'memory') ?? 0,
    memoryOption: getSelectedOption(modules, selection, 'memory'),
    powerIndex: getSelectedIndex(selection, 'power') ?? 0,
    powerOption: getSelectedOption(modules, selection, 'power'),
    processorIndex: getSelectedIndex(selection, 'processor') ?? 0,
    processorOption: getSelectedOption(modules, selection, 'processor'),
    securityIndex: getSelectedIndex(selection, 'security') ?? 0,
    securityOption: getSelectedOption(modules, selection, 'security'),
    selectedExternalModules,
    tapeSelected: hasSelection(selection, 'tapeBackup'),
    totals,
  };
}

function validateFrame(selectedFrame, context) {
  const warnings = [];
  const info = [];

  if (context.externalCount === 0) {
    info.push('No external storage selected. This configuration is suitable for demo/development only. Production workloads usually require external DASD or enterprise storage.');
  }

  if (context.processorIndex === 2 && selectedFrame.tier < 2) {
    warnings.push('AI-Accelerated CPC requires Z Frame + A Frame.');
  }

  if (context.processorIndex === 2 && context.coolingIndex < 2) {
    warnings.push('Selected cooling is not sufficient for AI-Accelerated CPC. Please choose Liquid-Cooling Ready or upgrade the frame.');
  }

  if (context.memoryIndex === 2 && context.processorIndex === 0) {
    warnings.push('12 TB RAIM requires Enterprise Processor Complex or AI-Accelerated CPC.');
  }

  if (context.memoryIndex === 2 && selectedFrame.tier < 2) {
    warnings.push('This configuration requires a larger frame because the selected CPC and memory exceed Z Frame capacity.');
  }

  if (context.processorIndex === 1 && context.memoryIndex >= 2 && context.coolingIndex === 0) {
    warnings.push('Enterprise CPC with higher memory should use Rear Door Heat Exchanger or Liquid-Cooling Ready infrastructure.');
  }

  if (context.ioIndex === 2 && selectedFrame.tier < 2) {
    warnings.push('Enterprise I/O Fabric requires additional PCIe I/O drawer capacity. Upgrade the frame.');
  }

  if (context.coolingIndex === 2 && selectedFrame.tier < 2) {
    warnings.push('Liquid cooling requires Z Frame + A Frame.');
  }

  if (context.powerIndex === 2 && selectedFrame.tier < 2) {
    warnings.push('UPS-backed enterprise power requires Z Frame + A Frame.');
  }

  if (context.externalDASDIndex !== undefined && context.ioIndex < 1) {
    warnings.push('External DASD requires FICON / Fibre Channel connectivity or better.');
  }

  if (context.externalDASDIndex !== undefined && context.externalDASDIndex >= 1 && context.ioIndex < 2) {
    warnings.push('External DASD is supported, but this selected DASD tier requires stronger I/O connectivity.');
  }

  if (context.tapeSelected && context.ioIndex < 1) {
    warnings.push('Tape Library requires FICON connectivity.');
  }

  if (context.tapeSelected && context.managementIndex < 2) {
    warnings.push('Tape Library requires Advanced Monitoring & Control.');
  }

  if (context.cyberSelected && context.managementIndex < 2) {
    warnings.push('Cyber Vault requires Advanced Monitoring & Control.');
  }

  if (context.cyberSelected && context.securityIndex < 2) {
    warnings.push('Cyber Vault requires Quantum-Safe Security Suite.');
  }

  if (context.cyberSelected && context.ioIndex < 2) {
    warnings.push('Cyber Vault requires Enterprise I/O Fabric.');
  }

  if (context.cyberSelected && selectedFrame.tier < 2) {
    warnings.push('Cyber Vault requires a larger enterprise frame infrastructure.');
  }

  if (context.externalCount > 1 && selectedFrame.tier < 2) {
    warnings.push('Multiple external systems require Z Frame + A Frame.');
  }

  if (selectedFrame.tier === 1) {
    if (context.processorIndex === 1 && (context.memoryIndex > 1 || context.ioIndex > 1)) {
      warnings.push('Enterprise Processor Complex works with Z Frame only when memory and I/O are not too high.');
    }

    if (context.externalDASDIndex !== undefined && context.externalDASDIndex > 0) {
      warnings.push('Flash Enterprise Storage and 2 PB DASD require a larger frame than Z Frame.');
    }

    if (context.tapeSelected || context.cyberSelected) {
      warnings.push('Tape Library and Cyber Vault are not supported by Z Frame.');
    }
  }

  if ((context.totals?.lpars ?? 0) >= 180 && context.managementIndex < 2) {
    warnings.push('High LPAR capacity requires Advanced Monitoring & Control.');
  }

  return {
    info,
    warnings: [...new Set(warnings)],
  };
}

function buildMetrics(selectedFrame, recommendedFrame, context, isValid) {
  const cpcCapacityScore = context.processorOption?.capacityScore ?? Math.round((context.totals?.cpu ?? 0) / 1800);
  const processorReadiness = [35, 74, 94][context.processorIndex] ?? 35;
  const memoryReadiness = [42, 74, 95][context.memoryIndex] ?? 42;
  const ioReadiness = [32, 72, 94][context.ioIndex] ?? 32;
  const managementReadiness = [38, 70, 94][context.managementIndex] ?? 38;
  const storageReadiness = getStorageReadiness(context);
  const securityScore = clampScore((context.securityOption?.compliance ?? 0) + (context.cyberSelected ? 8 : 0));
  const redundancyScore = clampScore(
    (context.managementOption?.monitoring ?? 0) * 0.35
    + (context.powerOption?.uptimeScore ?? 0) * 0.35
    + selectedFrame.tier * 10
    + (context.tapeSelected ? 4 : 0)
    + (context.cyberSelected ? 8 : 0),
  );
  const coolingEfficiency = clampScore(context.coolingOption?.thermalScore ?? 35);
  const frameScore = [0, 38, 86][selectedFrame.tier] ?? 38;
  const validityPenalty = isValid ? 0 : 32;
  const productionReadinessScore = clampScore(
    processorReadiness * 0.16
    + memoryReadiness * 0.13
    + ioReadiness * 0.13
    + storageReadiness * 0.13
    + securityScore * 0.1
    + redundancyScore * 0.12
    + coolingEfficiency * 0.1
    + managementReadiness * 0.08
    + frameScore * 0.15
    - validityPenalty,
  );
  const availabilityBase = 99.4 + redundancyScore * 0.0048 + selectedFrame.tier * 0.035;

  return {
    configurationValidity: isValid ? 'Valid' : 'Invalid',
    coolingEfficiency,
    cpcCapacityScore: clampScore(cpcCapacityScore),
    disasterRecoveryTier: getDisasterRecoveryTier(context),
    estimatedAvailability: `${Math.min(99.99, availabilityBase).toFixed(2)}%`,
    ioThroughput: context.totals?.io ?? 0,
    lparCapacity: context.totals?.lpars ?? 0,
    memoryCapacity: context.totals?.ram ?? 0,
    productionReadiness: getReadinessLabel(productionReadinessScore),
    productionReadinessScore,
    recommendedFrameName: recommendedFrame.name,
    redundancyLevel: getReadinessLabel(redundancyScore),
    redundancyScore,
    securityComplianceScore: securityScore,
    securityScore,
    storageReadiness,
  };
}

export function evaluateFrameConfiguration({
  modules,
  selectedFrameId = FRAME_AUTO_ID,
  selection,
  totals,
}) {
  const context = buildContext({ modules, selection, totals });
  const recommendedTier = getRecommendedFrameTier(context);
  const recommendedFrame = getFrameForTier(recommendedTier);
  const isAuto = selectedFrameId === FRAME_AUTO_ID;
  const selectedFrame = isAuto ? recommendedFrame : getFrameConfiguration(selectedFrameId);
  const validation = validateFrame(selectedFrame, context);
  const isValid = validation.warnings.length === 0;

  return {
    effectiveFrame: selectedFrame,
    info: validation.info,
    isAuto,
    isRecommendedApplied: selectedFrame.id === recommendedFrame.id,
    isValid,
    metrics: buildMetrics(selectedFrame, recommendedFrame, context, isValid),
    recommendedFrame,
    selectedFrameMode: selectedFrameId,
    warnings: validation.warnings,
  };
}
