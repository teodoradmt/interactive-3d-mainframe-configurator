export const FRAME_AUTO_ID = 'auto';
export const DEFAULT_FRAME_ID = 'single-z';

export const frameConfigurations = [
  {
    id: 'single-z',
    name: 'Z Frame',
    shortName: 'Z Frame',
    tier: 1,
    frameCount: 1,
    description: 'Основен CPC frame с врата отляво, която се отваря наляво.',
  },
  {
    id: 'z-plus-a',
    name: 'Z Frame + A Frame',
    shortName: 'Z + A',
    tier: 2,
    frameCount: 2,
    description: 'Enterprise двойка: Z Frame е с врата отляво, A Frame е с врата отдясно.',
  },
];

export const frameSelectionOptions = [
  {
    id: FRAME_AUTO_ID,
    name: 'Авто',
    shortName: 'Авто',
    frameCount: 1,
    description: 'Автоматично избира Z Frame или Z Frame + A Frame според избраните модули.',
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
  coolingIndex,
  cyberSelected,
  externalCount,
  ioIndex,
  memoryIndex,
  powerIndex,
  processorIndex,
  tapeSelected,
}) {
  let tier = 1;

  if (
    processorIndex === 2
    || memoryIndex === 2
    || ioIndex === 2
    || coolingIndex === 2
    || powerIndex === 2
    || externalCount > 0
    || tapeSelected
    || cyberSelected
  ) {
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
    return 'Много висока';
  }

  if (score >= 70) {
    return 'Висока';
  }

  if (score >= 46) {
    return 'Средна';
  }

  return 'Ниска';
}

function getDisasterRecoveryTier({ cyberSelected, tapeSelected, externalDASDIndex }) {
  if (cyberSelected) {
    return 'Cyber Vault';
  }

  if (tapeSelected) {
    return 'Tape recovery';
  }

  if (externalDASDIndex !== undefined) {
    return 'DASD recovery';
  }

  return 'Няма';
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

function validateConfiguration(context) {
  const configurationWarnings = [];
  const info = [];

  if (context.externalCount === 0 && context.ioIndex >= 1) {
    configurationWarnings.push('Избраната FICON/SAN I/O свързаност изисква поне една външна система: External DASD, Tape Library или Cyber Vault.');
  } else if (context.externalCount === 0) {
    info.push('Не е избран external storage. Тази конфигурация е подходяща само за demo/development сценарии. Production работните натоварвания обикновено изискват external DASD или enterprise storage.');
  }

  if (context.processorIndex === 2 && context.coolingIndex < 2) {
    configurationWarnings.push('Избраният cooling не е достатъчен за AI-Accelerated CPC. Изберете Liquid-Cooling Ready.');
  }

  if (context.memoryIndex === 2 && context.processorIndex === 0) {
    configurationWarnings.push('12 TB RAIM изисква Enterprise Processor Complex или AI-Accelerated CPC.');
  }

  if (context.processorIndex === 1 && context.memoryIndex >= 2 && context.coolingIndex === 0) {
    configurationWarnings.push('Enterprise CPC с по-голяма memory трябва да използва Rear Door Heat Exchanger или Liquid-Cooling Ready инфраструктура.');
  }

  if (context.externalDASDIndex !== undefined && context.ioIndex < 1) {
    configurationWarnings.push('External DASD изисква FICON / Fibre Channel свързаност или по-високо ниво.');
  }

  if (context.externalDASDIndex !== undefined && context.externalDASDIndex >= 1 && context.ioIndex < 2) {
    configurationWarnings.push('External DASD се поддържа, но избраното DASD ниво изисква по-силна I/O свързаност.');
  }

  if (context.tapeSelected && context.ioIndex < 1) {
    configurationWarnings.push('Tape Library изисква FICON свързаност.');
  }

  if (context.tapeSelected && context.managementIndex < 2) {
    configurationWarnings.push('Tape Library изисква Advanced Monitoring & Control.');
  }

  if (context.cyberSelected && context.managementIndex < 2) {
    configurationWarnings.push('Cyber Vault изисква Advanced Monitoring & Control.');
  }

  if (context.cyberSelected && context.securityIndex < 2) {
    configurationWarnings.push('Cyber Vault изисква Quantum-Safe Security Suite.');
  }

  if (context.cyberSelected && context.ioIndex < 2) {
    configurationWarnings.push('Cyber Vault изисква Enterprise I/O Fabric.');
  }

  if ((context.totals?.lpars ?? 0) >= 180 && context.managementIndex < 2) {
    configurationWarnings.push('Високият LPAR капацитет изисква Advanced Monitoring & Control.');
  }

  return {
    configurationWarnings: [...new Set(configurationWarnings)],
    info,
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
    configurationValidity: isValid ? 'Валидна' : 'Невалидна',
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
  const validation = validateConfiguration(context);
  const shouldOfferAutoFrameSwitch = !isAuto && selectedFrame.tier < recommendedFrame.tier;
  const frameWarnings = shouldOfferAutoFrameSwitch
    ? [
        `Frame е избран ръчно като ${selectedFrame.name}, но тази конфигурация изисква ${recommendedFrame.name}. Сменете frame на Авто или изберете препоръчания frame.`,
      ]
    : [];
  const warnings = [...new Set([...frameWarnings, ...validation.configurationWarnings])];
  const isFrameValid = frameWarnings.length === 0;
  const isValid = warnings.length === 0;

  return {
    configurationWarnings: validation.configurationWarnings,
    effectiveFrame: selectedFrame,
    frameWarnings,
    info: validation.info,
    isAuto,
    isFrameValid,
    isRecommendedApplied: selectedFrame.id === recommendedFrame.id,
    isValid,
    metrics: buildMetrics(selectedFrame, recommendedFrame, context, isValid),
    recommendedFrame,
    selectedFrameMode: selectedFrameId,
    shouldOfferAutoFrameSwitch,
    warnings: [...new Set(warnings)],
  };
}
