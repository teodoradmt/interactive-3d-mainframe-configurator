const ollamaBaseUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const ollamaModel = process.env.OLLAMA_MODEL ?? 'qwen3:14b';
const ollamaKeepAlive = process.env.OLLAMA_KEEP_ALIVE ?? '10m';

function readPositiveNumber(envName, fallback) {
  const parsed = Number(process.env[envName]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const ollamaTimeoutMs = readPositiveNumber('OLLAMA_TIMEOUT_MS', 90_000);
const ollamaNumCtx = readPositiveNumber('OLLAMA_NUM_CTX', 1024);
const ollamaTemperature = readPositiveNumber('OLLAMA_TEMPERATURE', 0.15);
const recommendationTokens = readPositiveNumber('OLLAMA_RECOMMENDATION_TOKENS', 180);
const chatTokens = readPositiveNumber('OLLAMA_CHAT_TOKENS', 170);
const chatHistoryMessages = readPositiveNumber('OLLAMA_CHAT_HISTORY_MESSAGES', 4);
const chatHistoryChars = readPositiveNumber('OLLAMA_CHAT_HISTORY_CHARS', 520);
const cacheMaxEntries = readPositiveNumber('OLLAMA_CACHE_ENTRIES', 25);
const responseCache = new Map();
const optionOrdinals = ['първа', 'втора', 'трета'];

function stripThinkingContent(response) {
  return String(response ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*\/no_think\s*/i, '')
    .trim();
}

function getCachedResponse(cacheKey) {
  if (!cacheKey || !responseCache.has(cacheKey)) {
    return null;
  }

  const cached = responseCache.get(cacheKey);
  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, cached);

  return cached;
}

function cacheResponse(cacheKey, result) {
  if (!cacheKey || cacheMaxEntries < 1) {
    return;
  }

  responseCache.set(cacheKey, result);

  while (responseCache.size > cacheMaxEntries) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
}

function getLastUserMessage(messages = []) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function getConversationText(messages = []) {
  return messages
    .map((message) => String(message.content ?? ''))
    .join('\n');
}

function parseBudget(text) {
  const matches = String(text)
    .toLowerCase()
    .matchAll(/(\d+(?:[.,]\d+)?(?:\s*\d{3})*)\s*(млн\.?|милиона?|million|m|м|хил\.?|хиляди|k|евро|eur|€)?/g);

  let budget = null;

  for (const match of matches) {
    const rawValue = match[1].trim();
    const normalizedValue = rawValue.includes(' ')
      ? rawValue.replace(/\s/g, '').replace(',', '.')
      : rawValue.replace(',', '.');
    const value = Number(normalizedValue);
    const unit = match[2] ?? '';

    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    let amount = value;

    if (/млн|милион|million|^m$|^м$/.test(unit)) {
      amount *= 1_000_000;
    } else if (/хил|хиляди|k/.test(unit)) {
      amount *= 1_000;
    }

    if (amount >= 100_000) {
      budget = Math.max(budget ?? 0, amount);
    }
  }

  return budget;
}

function extractWorkload(text) {
  const normalized = String(text).toLowerCase();

  if (/много\s+натовар|висок[ао]?|тежк|голям[ао]?\s+(трафик|натовар)|много\s+транзак|критичн|24\/7|enterprise|production|продукцион|интензив/.test(normalized)) {
    return 'high';
  }

  if (/средн|умерен|нормал|стандарт|обичайн/.test(normalized)) {
    return 'medium';
  }

  if (/нис[ъккао]|лек[ао]?|малк|слаб|тест|dev|development|разработка|пилот|лаборатор|университет/.test(normalized)) {
    return 'low';
  }

  return null;
}

function getRecommendationGaps(text) {
  const gaps = [];

  if (!extractWorkload(text)) {
    gaps.push('очаквана натовареност - ниска, средна или висока');
  }

  return gaps;
}

function buildClarificationReply(gaps) {
  return [
    'За да предложа коректна конфигурация, моля уточнете:',
    ...gaps.map((gap, index) => `${index + 1}. ${gap}`),
    `${gaps.length + 1}. ориентировъчен бюджет, ако имате такъв`,
  ].join('\n');
}

function shouldSuggestConfiguration(text) {
  const normalized = String(text).toLowerCase();

  if (/^(да|ок|окей|добре|съглас|приложи|избери|yes|apply)\b/.test(normalized.trim())) {
    return false;
  }

  if (isComparisonRequest(text) || isExplanationRequest(text)) {
    return false;
  }

  return /конфигурац|препоръч|предлож|примерна?\s+конфигурац|сглоби|подбери\s+конфигурац|recommend\s+configuration|configuration/.test(normalized);
}

function asksForConfigurationDetails(text) {
  return /за\s+да\s+предложа\s+коректна\s+конфигурац|мога\s+да\s+предложа\s+конфигурац|очаквана\s+натовареност|ориентировъчен\s+бюджет/i.test(String(text));
}

function hasRecentConfigurationRequest(messages = []) {
  return messages.slice(-8).some((message) => (
    (message.role === 'user' && shouldSuggestConfiguration(message.content))
    || (message.role === 'assistant' && asksForConfigurationDetails(message.content))
  ));
}

function getConfigurationContextStartIndex(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === 'user' && shouldSuggestConfiguration(message.content)) {
      return index;
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === 'assistant' && asksForConfigurationDetails(message.content)) {
      return index;
    }
  }

  return Math.max(0, messages.length - 3);
}

function shouldContinueConfigurationRequest(messages = []) {
  const lastUserMessage = getLastUserMessage(messages);

  if (shouldSuggestConfiguration(lastUserMessage)) {
    return true;
  }

  const lastMessageAddsSizing =
    Boolean(extractWorkload(lastUserMessage))
    || Boolean(parseBudget(lastUserMessage))
    || hasOpenBudget(lastUserMessage)
    || wantsLowestCost(lastUserMessage)
    || /натовар|бюджет|лимит/i.test(lastUserMessage);

  return lastMessageAddsSizing && hasRecentConfigurationRequest(messages);
}

function getConfigurationContextText(messages = []) {
  const lastUserMessage = getLastUserMessage(messages);

  if (shouldSuggestConfiguration(lastUserMessage)) {
    return lastUserMessage;
  }

  const startIndex = getConfigurationContextStartIndex(messages);

  return messages
    .slice(startIndex)
    .filter((message) => message.role === 'user')
    .map((message) => String(message.content ?? ''))
    .join('\n');
}

function hasOpenBudget(text) {
  return /нямам\s+бюджет|без\s+бюджет|няма\s+лимит|без\s+лимит|отворен\s+бюджет|unlimited|no\s+budget|no\s+limit/.test(String(text).toLowerCase());
}

function wantsLowestCost(text) {
  return /най[-\s]?нис[ъккао]|най[-\s]?евтин|минималн[ао]?|възможно\s+най[-\s]?нис[ъккао]|lowest|cheapest|minimum/.test(String(text).toLowerCase());
}

function isComparisonRequest(text) {
  return /сравни|сравнение|разлика|по\s+всичко|кое\s+е\s+най[-\s]?подходящ|кой\s+е\s+най[-\s]?подходящ|compare|difference|versus|vs\.?/i.test(String(text));
}

function isExplanationRequest(text) {
  return /обясни|какво\s+е|как\s+работи|кажи\s+ми\s+за|подробно|детайлно|explain/i.test(String(text));
}

function isOptionalModule(module) {
  return module.required === false || module.category === 'external';
}

function getOptionIndex(selection, moduleId, fallback = 0) {
  return Number(selection[moduleId] ?? fallback);
}

function getSelectedOption(module, selection) {
  if (isOptionalModule(module) && selection[module.id] === undefined) {
    return null;
  }

  return module.options[getOptionIndex(selection, module.id)] ?? null;
}

function calculateSelectionTotal(modules, selection) {
  return modules.reduce((sum, module) => {
    const option = getSelectedOption(module, selection);
    return sum + (option?.price ?? 0);
  }, 0);
}

function isSelectionCompleteForModules(modules, selection = {}) {
  return modules.length > 0 && modules.every((module) => {
    if (isOptionalModule(module) && selection[module.id] === undefined) {
      return true;
    }

    const optionIndex = Number(selection[module.id]);
    return Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < module.options.length;
  });
}

function normalizeSelection(modules, selection = {}) {
  return modules.reduce((normalizedSelection, module) => {
    if (isOptionalModule(module) && selection[module.id] === undefined) {
      return normalizedSelection;
    }

    normalizedSelection[module.id] = Math.min(
      Math.max(Number(selection[module.id] ?? 0), 0),
      module.options.length - 1,
    );
    return normalizedSelection;
  }, {});
}

function getLastSuggestedSelection(messages = [], modules = []) {
  const message = [...messages]
    .reverse()
    .find((item) => isSelectionCompleteForModules(modules, item.suggestedSelection ?? item.appliedSelection));

  return message ? normalizeSelection(modules, message.suggestedSelection ?? message.appliedSelection) : null;
}

function enumerateSelections(modules, index = 0, current = {}, results = []) {
  if (index >= modules.length) {
    results.push({ ...current });
    return results;
  }

  const module = modules[index];

  if (isOptionalModule(module)) {
    delete current[module.id];
    enumerateSelections(modules, index + 1, current, results);
  }

  module.options.forEach((_, optionIndex) => {
    current[module.id] = optionIndex;
    enumerateSelections(modules, index + 1, current, results);
  });

  delete current[module.id];
  return results;
}

function scoreSelection(modules, selection, text, budget, workload, budgetMode = 'fixed') {
  const normalized = String(text).toLowerCase();
  const total = calculateSelectionTotal(modules, selection);
  const processorIndex = getOptionIndex(selection, 'processor');
  const memoryIndex = getOptionIndex(selection, 'memory');
  const ioIndex = getOptionIndex(selection, 'storage');
  const managementIndex = getOptionIndex(selection, 'network');
  const securityIndex = getOptionIndex(selection, 'security');
  const powerIndex = getOptionIndex(selection, 'power');
  const coolingIndex = getOptionIndex(selection, 'cooling');
  const externalDASDIndex = getOptionIndex(selection, 'externalDASD', -1);
  const tapeBackupIndex = getOptionIndex(selection, 'tapeBackup', -1);
  const cyberVaultIndex = getOptionIndex(selection, 'cyberVault', -1);
  let score = 0;

  if (budget) {
    const ratio = total / budget;

    if (ratio > 1) {
      return Number.NEGATIVE_INFINITY;
    }

    if (workload === 'high') {
      score += ratio * 80;
    } else if (workload === 'medium') {
      score += 70 - Math.abs(0.72 - ratio) * 45;
    } else {
      score += 60 - ratio * 28;
    }
  } else if (budgetMode === 'lowest') {
    score -= total / 18_000;
  } else if (budgetMode === 'open') {
    score += total / 35_000;
  }

  if (workload === 'high') {
    score += processorIndex * 85;
    score += memoryIndex * 42;
    score += ioIndex * 42;
    score += managementIndex * 18;
    score += securityIndex * 34;
    score += powerIndex * 12;
    score += coolingIndex * 12;

    if (processorIndex === 2 && memoryIndex >= 1 && ioIndex >= 1) {
      score += 85;
    }

    if (processorIndex === 0 || memoryIndex === 0) {
      score -= 130;
    }
  } else if (workload === 'medium') {
    score += 80 - Math.abs(processorIndex - 1) * 34;
    score += 55 - Math.abs(memoryIndex - 1) * 24;
    score += 42 - Math.abs(ioIndex - 1) * 18;
    score += 30 - Math.abs(managementIndex - 1) * 12;
    score += 38 - Math.abs(securityIndex - 1) * 16;
    score -= Math.abs(powerIndex - 1) * 6;
    score -= Math.abs(coolingIndex - 1) * 6;
  } else {
    score += (2 - processorIndex) * 35;
    score += (2 - memoryIndex) * 22;
    score += (2 - ioIndex) * 12;
    score += (2 - managementIndex) * 8;
    score += (2 - powerIndex) * 6;
    score += (2 - coolingIndex) * 6;
    score -= budgetMode === 'open' ? total / 500_000 : total / 160_000;
  }

  if (/банка|bank|финанс|finance|плащ|payment|транзак|transaction/.test(normalized)) {
    if (workload === 'high') {
      score += processorIndex * 38;
      score += ioIndex * 18;
      score += securityIndex * 30;

      if (processorIndex >= 1 && securityIndex >= 1) {
        score += 70;
      }

      if (processorIndex === 0 && (ioIndex === 2 || securityIndex === 2)) {
        score -= 80;
      }
    } else if (workload === 'medium') {
      score += processorIndex * 18;
      score += ioIndex * 16;
      score += securityIndex * 24;
    } else {
      score += ioIndex * 8;
      score += securityIndex * 22;
      score -= processorIndex * 12;
    }
  }

  if (/университет|linux|малк|пилот|лаборатор/.test(normalized)) {
    score += (2 - processorIndex) * 10;
    score += (2 - coolingIndex) * 5;
    score -= total / 220_000;
  }

  if (/сигур|security|crypto|крипто|защит/.test(normalized)) {
    score += securityIndex * 30;
  }

  if (/ai|изкуствен|fraud|аналит/.test(normalized)) {
    score += processorIndex * 30;
    score += securityIndex * 12;
  }

  if (/storage|данни|архив|pb|съхран/.test(normalized)) {
    score += (externalDASDIndex + 1) * 36;
    score += ioIndex * 12;

    if (externalDASDIndex < 0) {
      score -= 28;
    }
  }

  if (/охлаж|cooling|liquid|висока плътност|high-density/.test(normalized)) {
    score += coolingIndex * 18;
  } else {
    score -= coolingIndex * 6;
  }

  if (/backup|tape|бекъп|архив/.test(normalized)) {
    score += (tapeBackupIndex + 1) * 28;
  }

  if (/vault|disaster|recovery|dr|cyber|възстанов|кибер/.test(normalized)) {
    score += (cyberVaultIndex + 1) * 32;
  }

  if (/иконом|евтин|нисък бюджет|ограничен/.test(normalized)) {
    score -= total / 80_000;
  }

  if (budgetMode === 'lowest') {
    score -= total / 45_000;
  }

  return score;
}

function getSelectionRank(module, selection) {
  if (isOptionalModule(module) && selection[module.id] === undefined) {
    return -1;
  }

  return Number(selection[module.id] ?? 0);
}

function getSelectionChangeCount(modules, firstSelection, secondSelection) {
  return modules.reduce((count, module) => (
    getSelectionRank(module, firstSelection) === getSelectionRank(module, secondSelection) ? count : count + 1
  ), 0);
}

function getUpgradeScore(modules, baseSelection, candidateSelection) {
  const weights = {
    processor: 5,
    memory: 3,
    storage: 2.5,
    network: 1.4,
    security: 2,
    power: 0.8,
    cooling: 0.8,
    externalDASD: 2.5,
    tapeBackup: 1.2,
    cyberVault: 1.8,
  };

  return modules.reduce((score, module) => {
    const delta = getSelectionRank(module, candidateSelection) - getSelectionRank(module, baseSelection);

    return score + Math.max(0, delta) * (weights[module.id] ?? 1);
  }, 0);
}

function hasNoDowngrades(modules, baseSelection, candidateSelection) {
  return modules.every((module) => getSelectionRank(module, candidateSelection) >= getSelectionRank(module, baseSelection));
}

function canUpgradeModule(modules, selection, moduleId) {
  const module = modules.find((item) => item.id === moduleId);

  return module ? getSelectionRank(module, selection) < module.options.length - 1 : false;
}

function formatEuro(value) {
  return `${Math.round(value).toLocaleString('bg-BG')} EUR`;
}

function getOptionOrdinal(index) {
  return optionOrdinals[index] ?? `${index + 1}.`;
}

function findLowestCostSelection(modules) {
  return enumerateSelections(modules).reduce((best, candidate) => (
    calculateSelectionTotal(modules, candidate) < calculateSelectionTotal(modules, best) ? candidate : best
  ));
}

function buildBudgetTooLowReply({ budget, minimumTotal }) {
  return [
    `Зададеният бюджет ${formatEuro(budget)} е под най-ниската възможна конфигурация в текущия каталог.`,
    `Минималната конфигурация започва приблизително от ${formatEuro(minimumTotal)}.`,
    'Моля увеличете бюджета или уточнете дали да покажа най-ниската възможна конфигурация въпреки разликата.',
  ].join('\n');
}

function resolveBudgetMode(text) {
  if (wantsLowestCost(text)) {
    return 'lowest';
  }

  if (hasOpenBudget(text)) {
    return 'open';
  }

  return 'fixed';
}

function buildSuggestedConfiguration({ modules, messages }) {
  const configurationText = getConfigurationContextText(messages);

  if (!shouldContinueConfigurationRequest(messages) || modules.length === 0) {
    return null;
  }

  const budget = parseBudget(configurationText);
  const budgetMode = resolveBudgetMode(configurationText);
  const workload = extractWorkload(configurationText);
  const candidates = enumerateSelections(modules);
  const eligibleCandidates = budget
    ? candidates.filter((candidate) => calculateSelectionTotal(modules, candidate) <= budget)
    : candidates;

  if (eligibleCandidates.length === 0) {
    const lowestSelection = findLowestCostSelection(modules);

    return {
      budget,
      insufficientBudget: true,
      minimumTotal: calculateSelectionTotal(modules, lowestSelection),
    };
  }

  const selection = eligibleCandidates.reduce((best, candidate) => (
    scoreSelection(modules, candidate, configurationText, budget, workload, budgetMode) > scoreSelection(modules, best, configurationText, budget, workload, budgetMode)
      ? candidate
      : best
  ), eligibleCandidates[0]);

  return {
    budget,
    budgetMode,
    ...createSuggestionFromSelection({
      budget,
      budgetMode,
      modules,
      selection,
      workload,
    }),
    workload,
  };
}

function formatSuggestedConfiguration(suggestion) {
  return suggestion.items
    .map((item, index) => `${index + 1}. ${item.optionName} (${item.optionOrdinal} опция за ${item.moduleShort})`)
    .join('\n');
}

function createSuggestionFromSelection({ budget = null, budgetMode = 'fixed', modules, selection, workload }) {
  const normalizedSelection = normalizeSelection(modules, selection);

  return {
    budget,
    budgetMode,
    selection: normalizedSelection,
    total: calculateSelectionTotal(modules, normalizedSelection),
    workload,
    items: modules.flatMap((module) => {
      if (isOptionalModule(module) && normalizedSelection[module.id] === undefined) {
        return [];
      }

      const optionIndex = getOptionIndex(normalizedSelection, module.id);
      const option = module.options[optionIndex];

      return [{
        moduleId: module.id,
        moduleTitle: module.title,
        moduleShort: module.short,
        optionIndex,
        optionName: option.name,
        optionOrdinal: getOptionOrdinal(optionIndex),
      }];
    }),
  };
}

function describeSuggestionReason(suggestion) {
  const cpu = suggestion.items.find((item) => item.moduleId === 'processor')?.optionName;
  const memory = suggestion.items.find((item) => item.moduleId === 'memory')?.optionName;
  const io = suggestion.items.find((item) => item.moduleId === 'storage')?.optionName;
  const security = suggestion.items.find((item) => item.moduleId === 'security')?.optionName;
  const externalStorage = suggestion.items.find((item) => item.moduleId === 'externalDASD')?.optionName;
  const network = externalStorage ? `${io}; External DASD: ${externalStorage}` : io;
  const workloadText = {
    low: 'ниска натовареност',
    medium: 'средна натовареност',
    high: 'висока натовареност',
  }[suggestion.workload] ?? 'посоченото натоварване';
  const budgetText = suggestion.budget
    ? ` Предложението е в рамките на бюджета ${formatEuro(suggestion.budget)}.`
    : suggestion.budgetMode === 'lowest'
      ? ' Избран е възможно най-нисък разход според текущия каталог.'
      : suggestion.budgetMode === 'open'
        ? ' Тъй като няма зададен бюджетен таван, приоритетът е технически по-силна конфигурация.'
        : '';

  return `Комбинацията е избрана за ${workloadText} и балансира ${cpu}, ${memory}, ${network} и ${security}.${budgetText}`;
}

function buildFallbackChatRecommendation({ suggestion }) {
  return [
    'Разбира се. Като примерна клиентска конфигурация бих предложил:',
    '',
    'Примерна конфигурация:',
    formatSuggestedConfiguration(suggestion),
    '',
    `Ориентировъчна цена: ${formatEuro(suggestion.total)}.`,
    `Причина: ${describeSuggestionReason(suggestion)}`,
    'Искате ли да приложа тази конфигурация в конфигуратора?',
  ].join('\n');
}

function getMoneyAdjustmentDirection(text) {
  const normalized = String(text).toLowerCase();

  if (/по[-\s]?малко\s+пари|по[-\s]?евтин|по[-\s]?ниска\s+цена|намали|свали|по[-\s]?бюджетн|икономичн|по[-\s]?нис[ъккао]\s+бюджет|cheaper|less\s+money|lower\s+budget/.test(normalized)) {
    return 'cheaper';
  }

  if (/повече\s+(пари|мощност|производителност|капацитет|ресурс)|още\s+(мощност|производителност|капацитет|ресурс)|по[-\s]?скъп|по[-\s]?мощ|по[-\s]?сил|по[-\s]?производителн|по[-\s]?висок\s+бюджет|увеличи|вдигни|качи|ъпгрейд|upgrade|more\s+(money|power|performance|capacity|resources)|higher\s+budget|more\s+powerful/.test(normalized)) {
    return 'stronger';
  }

  if (/бюджет|цена|пари|евро|eur|€/.test(normalized) && parseBudget(normalized)) {
    return 'budget';
  }

  return null;
}

function wantsMoreComputePower(text) {
  return /повече\s+(мощност|производителност|изчислителна\s+мощ|compute)|още\s+(мощност|производителност)|по[-\s]?мощ|по[-\s]?сил|по[-\s]?производителн|more\s+(power|performance|compute)|more\s+powerful/i.test(String(text));
}

function buildAdjustedConfiguration({ messages, modules, selection }) {
  const lastUserMessage = getLastUserMessage(messages);
  const direction = getMoneyAdjustmentDirection(lastUserMessage);
  const preferComputeUpgrade = direction === 'stronger' && wantsMoreComputePower(lastUserMessage);

  if (!direction) {
    return null;
  }

  const lastSuggestedSelection = getLastSuggestedSelection(messages, modules);

  if (direction === 'budget' && shouldSuggestConfiguration(lastUserMessage) && !lastSuggestedSelection) {
    return null;
  }

  const baseSelection = lastSuggestedSelection
    ?? (isSelectionCompleteForModules(modules, selection) ? normalizeSelection(modules, selection) : null);

  if (!baseSelection) {
    return {
      missingBase: true,
    };
  }

  const configurationText = getConfigurationContextText(messages);
  const workload = extractWorkload(configurationText);
  const baseTotal = calculateSelectionTotal(modules, baseSelection);
  const explicitBudget = parseBudget(lastUserMessage);
  const targetBudget = explicitBudget
    ?? (direction === 'cheaper'
      ? Math.round(baseTotal * 0.82)
      : direction === 'stronger'
        ? Math.round(baseTotal * 1.35)
        : null);
  const candidates = enumerateSelections(modules)
    .filter((candidate) => {
      const total = calculateSelectionTotal(modules, candidate);
      const isSame = getSelectionChangeCount(modules, baseSelection, candidate) === 0;

      if (isSame) {
        return false;
      }

      if (direction === 'cheaper') {
        return total < baseTotal && (!targetBudget || total <= targetBudget);
      }

      if (direction === 'stronger') {
        return total > baseTotal
          && hasNoDowngrades(modules, baseSelection, candidate)
          && getUpgradeScore(modules, baseSelection, candidate) > 0
          && (!preferComputeUpgrade || !canUpgradeModule(modules, baseSelection, 'processor') || Number(candidate.processor) > Number(baseSelection.processor))
          && (!targetBudget || total <= targetBudget);
      }

      return targetBudget ? total <= targetBudget : false;
    });
  const fallbackCandidates = candidates.length
    ? candidates
    : enumerateSelections(modules).filter((candidate) => {
      const total = calculateSelectionTotal(modules, candidate);

      if (direction === 'cheaper') {
        return total < baseTotal;
      }

      if (direction === 'stronger') {
        return total > baseTotal
          && hasNoDowngrades(modules, baseSelection, candidate)
          && getUpgradeScore(modules, baseSelection, candidate) > 0
          && (!preferComputeUpgrade || !canUpgradeModule(modules, baseSelection, 'processor') || Number(candidate.processor) > Number(baseSelection.processor));
      }

      return targetBudget ? total <= targetBudget : false;
    });

  if (fallbackCandidates.length === 0) {
    return {
      direction,
      noCandidate: true,
    };
  }

  const budgetMode = direction === 'cheaper'
    ? 'lowest'
    : direction === 'stronger'
      ? 'open'
      : 'fixed';
  const budgetForScore = targetBudget ?? explicitBudget;
  const adjustedSelection = fallbackCandidates.reduce((best, candidate) => {
    const candidateScore =
      scoreSelection(modules, candidate, configurationText, budgetForScore, workload, budgetMode)
      + (direction === 'stronger' ? getUpgradeScore(modules, baseSelection, candidate) * 24 : 0)
      + (preferComputeUpgrade ? (Number(candidate.processor) - Number(baseSelection.processor)) * 140 : 0)
      - getSelectionChangeCount(modules, baseSelection, candidate) * 4;
    const bestScore =
      scoreSelection(modules, best, configurationText, budgetForScore, workload, budgetMode)
      + (direction === 'stronger' ? getUpgradeScore(modules, baseSelection, best) * 24 : 0)
      + (preferComputeUpgrade ? (Number(best.processor) - Number(baseSelection.processor)) * 140 : 0)
      - getSelectionChangeCount(modules, baseSelection, best) * 4;

    return candidateScore > bestScore ? candidate : best;
  }, fallbackCandidates[0]);
  const suggestion = createSuggestionFromSelection({
    budget: explicitBudget,
    budgetMode,
    modules,
    selection: adjustedSelection,
    workload,
  });

  return {
    baseTotal,
    direction,
    suggestion,
    targetBudget,
  };
}

function buildAdjustedConfigurationReply(adjustment) {
  if (adjustment.missingBase) {
    return 'Мога, но първо ми трябва базова конфигурация. Напишете каква натовареност очаквате и примерен бюджет, за да предложа начална конфигурация.';
  }

  if (adjustment.noCandidate) {
    return adjustment.direction === 'cheaper'
      ? 'Текущата конфигурация вече е близо до най-ниската възможна цена в каталога. Мога да предложа компромиси, но ще трябва да се намали капацитет или клас на модул.'
      : 'Текущата конфигурация вече е близо до най-високия клас в каталога. Няма по-силен вариант със зададените модули.';
  }

  const { baseTotal, direction, suggestion } = adjustment;
  const difference = suggestion.total - baseTotal;
  const directionText = direction === 'cheaper'
    ? 'по-ниска цена'
    : direction === 'stronger'
      ? 'по-висок бюджет и повече капацитет'
      : 'новия бюджет';
  const differenceText = difference < 0
    ? `Това е с около ${formatEuro(Math.abs(difference))} по-малко от предишното предложение.`
    : difference > 0
      ? `Това е с около ${formatEuro(difference)} повече от предишното предложение.`
      : 'Цената остава приблизително същата, но модулите са пренаредени.';

  return [
    `Да, мога. За ${directionText} бих променил конфигурацията така:`,
    '',
    'Примерна конфигурация:',
    formatSuggestedConfiguration(suggestion),
    '',
    `Ориентировъчна цена: ${formatEuro(suggestion.total)}. ${differenceText}`,
    `Причина: ${describeSuggestionReason(suggestion)}`,
    'Искате ли да приложа тази конфигурация в конфигуратора?',
  ].join('\n');
}

function findModuleByText(modules, text) {
  const normalized = String(text).toLowerCase();
  const aliases = [
    ['externalDASD', /storage|dasd|disk|data|ds8900/],
    ['cyberVault', /vault|disaster|recovery|dr|cyber/],
    ['tapeBackup', /tape|backup|archive/],
    ['cooling', /cooling|liquid|heat exchanger|thermal/],
    ['network', /management|hmc|support element|monitoring|control/],
    ['processor', /cpu|процесор|generation|z15|z16|z17|telum/],
    ['memory', /ram|памет|memory|raim/],
    ['storage', /storage|диск|данни|архив|ds8900|vault/],
    ['network', /network|мреж|i\/o|io|ficon|roce|транзак/],
    ['security', /security|сигур|crypto|крипто|защит|quantum/],
    ['power', /power|ток|енерг|cooling|охлаж|liquid/],
  ];
  const match = aliases.find(([, pattern]) => pattern.test(normalized));

  if (!match) {
    return null;
  }

  return modules.find((module) => module.id === match[0]) ?? null;
}

function findModuleFromConversation(modules, messages, text) {
  return findModuleByText(modules, text) ?? findModuleByText(modules, getConversationText(messages));
}

function hasBroadAllIntent(text) {
  return /всички|всичките|всичко|цялостн|общо|заедно|целия\s+каталог|целият\s+каталог|all|everything|overall/i.test(String(text));
}

function wantsAllModulesComparison(text) {
  return /всички\s+модули|всичките\s+модули|модулите\s+заедно|сравни\s+модулите|обясни\s+модулите|опиши\s+модулите|сравнение\s+на\s+модулите|описание\s+на\s+модулите|всички\s+заедно|цялостно\s+(сравнение|описание)|all\s+modules|everything\s+together|overall\s+(comparison|description)/i.test(String(text));
}

function formatModuleOptions(module) {
  return module.options
    .map((option, index) => `${index + 1}. ${option.name} - ${formatEuro(option.price)}; ${option.spec ?? `${option.watts} kW`}`)
    .join('\n');
}

function getRecommendedOptionIndexForModule(module, workload, text) {
  if (wantsLowestCost(text)) {
    return 0;
  }

  if (workload === 'high') {
    return Math.min(2, module.options.length - 1);
  }

  if (workload === 'medium') {
    return Math.min(1, module.options.length - 1);
  }

  if (!workload) {
    return Math.min(1, module.options.length - 1);
  }

  return 0;
}

function describeOptionFit(module, index) {
  if (index === 0) {
    return 'ниска натовареност, тестови среди или по-ограничен бюджет';
  }

  if (index === 1) {
    return 'средна продукционна натовареност и балансиран бюджет';
  }

  return 'висока натовареност, голям капацитет или по-взискателни среди';
}

function buildModuleComparisonReply({ module, text, workload }) {
  const recommendedIndex = getRecommendedOptionIndexForModule(module, workload, text);
  const recommended = module.options[recommendedIndex];
  const workloadText = {
    low: 'ниска натовареност',
    medium: 'средна натовареност',
    high: 'висока натовареност',
  }[workload];
  const rows = module.options.map((option, index) => (
    `${index + 1}. ${option.name} - ${formatEuro(option.price)}; ${option.spec ?? `${option.watts} kW`}. Подходящ е за ${describeOptionFit(module, index)}.`
  ));
  const recommendationLine = workloadText
    ? `За ${workloadText} най-подходящият избор е ${recommended.name}, защото дава най-добър баланс между цена и капацитет в този клас.`
    : `Без конкретна натовареност най-балансираният избор е ${recommended.name}. За ниска натовареност бих слязъл към първата опция, а за висока - към третата.`;

  return [
    `Разбира се. Ето сравнение на вариантите за ${module.title}:`,
    ...rows,
    '',
    recommendationLine,
    'Ако ми дадете и примерен бюджет, мога да кажа дали този избор е разумен финансово или трябва да се слезе/качим с една опция.',
  ].join('\n');
}

function getModuleRoleDescription(module) {
  const descriptions = {
    processor:
      'CPU генерацията определя основната изчислителна мощност, възможностите за модерни работни натоварвания и колко добре системата ще поеме транзакции, аналитика и виртуализация.',
    memory:
      'Memory/RAIM модулът определя колко големи LPAR-и, бази данни и in-memory процеси могат да работят стабилно без недостиг на RAM.',
    storage:
      'Storage модулът покрива постоянните данни, архивите, recovery сценариите и скоростта на достъп до критична информация.',
    network:
      'I/O и network модулът е важен за връзките към storage, външни системи, транзакционен трафик и латентност при интеграции.',
    security:
      'Security модулът добавя криптографски възможности, защита на данните и по-високо ниво на устойчивост срещу модерни заплахи.',
    power:
      'Power & Cooling модулът описва как системата се захранва и охлажда, което влияе на експлоатационния разход и възможността за по-плътна конфигурация.',
  };

  descriptions.storage = 'I/O connectivity модулите определят OSA, FICON, Fibre Channel и high-throughput fabric връзките към външни системи.';
  descriptions.network = 'Management & Control покрива HMC, Support Elements, monitoring и operational manageability.';
  descriptions.power = 'Power инфраструктурата покрива redundant power, battery support и shutdown protection в CPC frame.';
  descriptions.cooling = 'Cooling инфраструктурата контролира thermal headroom, енергийната ефективност и максималната поддържана производителност.';
  descriptions.externalDASD = 'External DASD storage е отделен storage cabinet, свързан чрез FICON / SAN, а не вътрешен CPC drawer.';
  descriptions.tapeBackup = 'Tape Library е опционална външна система за backup и retention workflows.';
  descriptions.cyberVault = 'Cyber Vault е опционална външна recovery и cyber-resilience система.';

  return descriptions[module.id] ?? 'Този модул участва в цялостната IBM Z конфигурация и влияе на капацитета, цената и приложимостта на системата.';
}

function buildAllModulesComparisonReply({ modules, text, workload }) {
  const workloadText = {
    low: 'ниска натовареност',
    medium: 'средна натовареност',
    high: 'висока натовареност',
  }[workload];
  const rows = modules.map((module, index) => {
    const recommendedIndex = getRecommendedOptionIndexForModule(module, workload, text);
    const recommended = module.options[recommendedIndex];
    const options = module.options
      .map((option, optionIndex) => `${optionIndex + 1}. ${option.name} - ${formatEuro(option.price)}; ${option.spec ?? `${option.watts} kW`}. Подходящ е за ${describeOptionFit(module, optionIndex)}.`)
      .join('\n');
    const fit = workloadText
      ? `За ${workloadText} бих гледал ${recommended.name}.`
      : `Без уточнена натовареност най-балансираната отправна точка е ${recommended.name}.`;

    return [
      `${index + 1}. ${module.title} (${module.short})`,
      `Роля: ${getModuleRoleDescription(module)}`,
      'Варианти:',
      options,
      `Избор: ${fit}`,
    ].join('\n');
  });
  const summary = workloadText
    ? `Общо: за ${workloadText} най-често е разумно да се тръгне от препоръчаните варианти по-горе, а после да се коригира според бюджета и приоритета - производителност, данни, сигурност или разход.`
    : 'Общо: първите опции са за нисък разход, вторите са балансирани, а третите са за по-тежки и критични среди.';

  return [
    'Разбира се. Ето подробно описание на всички основни модули:',
    ...rows,
    '',
    summary,
    'Ако искате, мога след това да предложа цяла примерна конфигурация по натовареност и примерен бюджет.',
  ].join('\n');
}

function getCurrentSelectionSummary(modules, selection) {
  const selected = modules
    .map((module) => {
      const option = module.options[Number(selection[module.id])];
      return option ? `${module.short}: ${option.name}` : null;
    })
    .filter(Boolean);

  return selected.length ? selected.join('; ') : 'в момента няма избрана пълна конфигурация';
}

function buildContextualFallbackChatReply({ estimate, messages = [], modules, selection, text }) {
  const normalized = String(text).toLowerCase();
  const conversationText = getConversationText(messages);
  const directModule = findModuleByText(modules, text);
  const wantsAllComparison =
    ((isComparisonRequest(text) || isExplanationRequest(text)) && wantsAllModulesComparison(text))
    || ((isComparisonRequest(text) || isExplanationRequest(text)) && hasBroadAllIntent(text) && !directModule);
  const module = wantsAllComparison ? null : directModule ?? findModuleByText(modules, conversationText);
  const workload = extractWorkload(`${conversationText}\n${text}`);

  if (/здрав|hello|hi|hey/.test(normalized)) {
    return 'Здравейте. Кажете ми дали искате обща информация за IBM Z, сравнение между модулите или примерна конфигурация. Ако търсите конфигурация, най-полезни са натовареност, бюджет и приоритет.';
  }

  if (wantsAllComparison) {
    return buildAllModulesComparisonReply({
      modules,
      text: `${conversationText}\n${text}`,
      workload,
    });
  }

  if (isComparisonRequest(text) && module) {
    return buildModuleComparisonReply({
      module,
      text: `${conversationText}\n${text}`,
      workload,
    });
  }

  if (/какво\s+е|обясни|как\s+работи|разлика|защо|какъв\s+е|сравни|сравнение/.test(normalized) && module) {
    return [
      `${module.title} е частта от конфигуратора, която отговаря за ${module.short}. Наличните варианти са:`,
      formatModuleOptions(module),
      'Мога да ги сравня по цена, производителност или подходяща натовареност, ако кажете кое е по-важно за Вас.',
    ].join('\n');
  }

  if (/цена|цени|price|cost|струва/.test(normalized) && module) {
    return [
      `Цените за ${module.title} в текущия каталог са:`,
      formatModuleOptions(module),
      'Това са примерни demo стойности в приложението, не официална IBM оферта.',
    ].join('\n');
  }

  if (/ai\s*профил|ai score|accelerator|ускорител/.test(normalized)) {
    return 'AI профилът е вътрешна demo метрика в приложението. Тя сравнява колко AI-ориентирана е избраната CPU генерация, но не е официален IBM benchmark. Реалните IBM Z системи имат AI възможности чрез Telum/Telum II, но тук числото служи за сравнение в конфигуратора.';
  }

  if (/оценка|текущ|избрана|какво\s+съм\s+избрал|summary/.test(normalized)) {
    const estimateText = estimate
      ? `Оценката е ${formatEuro(estimate.total)}, ${estimate.ram} GB RAM, ${estimate.storage} TB storage и около ${estimate.kw.toFixed(1)} kW.`
      : 'Още няма пълна оценка, защото не всички модули са избрани.';

    return `Текущ избор: ${getCurrentSelectionSummary(modules, selection)}.\n${estimateText}`;
  }

  if (/бюджет|натовар|конфигурац|препоръч|предлож/.test(normalized)) {
    if (!workload) {
      return 'Мога да предложа конфигурация, но ми трябва очаквана натовареност: ниска, средна или висока. Ако имате примерен бюджет, добавете го; ако не, ще приема, че бюджетът е отворен.';
    }

    return 'Имам натовареността. Ако искате пълна конфигурация, напишете “предложи конфигурация” и по желание добавете примерен бюджет. Ако няма бюджетен лимит, ще избера технически по-силен вариант.';
  }

  return 'Разбирам. Мога да помогна с обяснение на модулите, сравнение на варианти, бюджетна проверка или примерна конфигурация. Попитайте ме например “каква е разликата между z16 и z17” или “предложи конфигурация за висока натовареност без лимит”.';
}

function ensureApplyQuestion(reply, suggestion) {
  if (!suggestion || /прилож/i.test(reply)) {
    return reply;
  }

  return `${reply.trim()}\n\nИскате ли да приложа тази конфигурация в конфигуратора?`;
}

function buildFallbackChatReply(context) {
  return buildContextualFallbackChatReply(context);
}

function hasNumberedConfiguration(reply) {
  return /примерна конфигурация/i.test(reply) && /(^|\n)\s*1\./.test(reply);
}

function formatCompactModuleCatalog(modules) {
  return modules
    .map((module) => {
      const options = module.options
        .map((option, index) => `${index}:${option.name}=${option.price}EUR`)
        .join('; ');

      return `${module.short}: ${options}`;
    })
    .join('\n');
}

function formatCompactSelection(modules, selection) {
  const selected = modules
    .map((module) => {
      const option = module.options[Number(selection[module.id])];
      return option ? `${module.short}: ${option.name}` : null;
    })
    .filter(Boolean);

  return selected.length ? selected.join('; ') : 'няма избрани модули';
}

function formatCompactChatMessages(messages = []) {
  return messages
    .slice(-chatHistoryMessages)
    .map((message) => {
      const role = message.role === 'assistant' ? 'AI' : 'Потребител';
      return `${role}: ${String(message.content ?? '').slice(0, chatHistoryChars)}`;
    })
    .join('\n');
}

function buildFastRecommendationPrompt({ estimate, modules, selection }) {
  return `
Ти си професионален IBM Z консултант, който говори с клиент.
Не показвай вътрешни разсъждения, thinking steps или <think> блокове.
Отговори на български, учтиво, делово и ясно. Използвай обръщение на "Вие".
Не използвай груб, прекалено фамилиарен или жаргонен тон.
Не измисляй компоненти извън каталога.
Дай точно 4 номерирани точки в този формат:
1. Подходящост: Тази конфигурация е подходяща за ...
2. Баланс: Тя е добре балансирана, защото ...
3. Внимание: ...
4. Следваща стъпка: За повече съвети попитайте Mainframe4o.

Каталог:
${formatCompactModuleCatalog(modules)}

Избор: ${formatCompactSelection(modules, selection)}
Цена: ${estimate.total} EUR
CPU: ${estimate.cpu}; RAM: ${estimate.ram} GB; Storage: ${estimate.storage} TB; Power: ${estimate.kw.toFixed(1)} kW
Пиши спокойно, без технически жаргон.
`.trim();
}

function buildFallbackRecommendation({ estimate }) {
  const yearlyCost = Math.round(estimate.yearlyCost);

  return [
    `1. Подходящост: Тази конфигурация е подходяща за клиентска IBM Z среда с нужда от ${estimate.cpu} demo CPU единици и ${estimate.storage} TB storage.`,
    `2. Баланс: Тя е добре балансирана, защото комбинира ${estimate.ram} GB RAM, ${estimate.storage} TB storage и ${estimate.kw.toFixed(1)} kW приблизителна мощност.`,
    `3. Внимание: Планирайте приблизително ${yearlyCost} EUR годишен разход за електроенергия.`,
    '4. Следваща стъпка: За повече съвети попитайте Mainframe4o.',
  ].join('\n');
}

function isCompleteRecommendation(response) {
  const trimmed = response.trim();

  if (!trimmed || !/[.!?]$/.test(trimmed)) {
    return false;
  }

  return ['1. Подходящост:', '2. Баланс:', '3. Внимание:', '4. Следваща стъпка:'].every((label) => trimmed.includes(label));
}

function buildFastChatPrompt({ estimate, messages, modules, selection, suggestion }) {
  const estimateLine = estimate
    ? `Цена ${estimate.total} EUR; CPU ${estimate.cpu}; RAM ${estimate.ram} GB; Storage ${estimate.storage} TB; Power ${estimate.kw.toFixed(1)} kW`
    : 'няма пълна оценка';
  const suggestionText = suggestion
    ? `
Препоръчана конфигурация, която трябва да използвате точно ако предлагате пример:
${formatSuggestedConfiguration(suggestion)}
Ориентировъчна цена: ${formatEuro(suggestion.total)}
`.trim()
    : 'Няма подготвена примерна конфигурация за този въпрос.';

  return `
Ти си Mainframe4o - професионален IBM Z консултант за клиенти.
Не показвай вътрешни разсъждения, thinking steps или <think> блокове.
Говори на български, учтиво, делово и ясно. Използвай обръщение на "Вие".
Не използвай груб, прекалено фамилиарен, подигравателен или жаргонен тон.
Използвай само модулите от каталога. Не измисляй компоненти, цени или имена.
Ако липсват важни данни, задай до 2 кратки уточняващи въпроса.
Когато предлагаш примерна конфигурация, задължително използвай този формат:
Примерна конфигурация:
1. <име на опция> (<първа/втора/трета> опция за <модул>)
2. ...
След списъка добави цена, кратка причина и въпроса: "Искате ли да приложа тази конфигурация в конфигуратора?"
Отговори с максимум 140 думи.

Каталог:
${formatCompactModuleCatalog(modules)}

${suggestionText}

Избор: ${formatCompactSelection(modules, selection)}
Оценка: ${estimateLine}
Разговор:
${formatCompactChatMessages(messages)}

Mainframe4o:
`.trim();
}

async function requestOllama(prompt, options = {}) {
  const { cacheKey, ...generationOptions } = options;
  const cached = getCachedResponse(cacheKey);

  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        raw: true,
        stream: false,
        keep_alive: ollamaKeepAlive,
        options: {
          temperature: ollamaTemperature,
          num_ctx: ollamaNumCtx,
          num_predict: chatTokens,
          stop: ['\nUser:', '\nAI:', '\nПотребител:', '\nMainframe4o:'],
          ...generationOptions,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with ${response.status}`);
    }

    const data = await response.json();

    const result = {
      model: data.model ?? ollamaModel,
      response: stripThinkingContent(data.response),
      elapsedMs: Math.round(performance.now() - startedAt),
    };

    cacheResponse(cacheKey, result);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAiRecommendation({ estimate, modules, selection }) {
  let result;

  try {
    result = await requestOllama(buildFastRecommendationPrompt({ estimate, modules, selection }), {
      cacheKey: `recommendation:${JSON.stringify(selection)}:${estimate.total}`,
      num_predict: recommendationTokens,
    });
  } catch {
    return {
      elapsedMs: 0,
      model: 'local-fallback',
      recommendation: buildFallbackRecommendation({ estimate }),
    };
  }

  const recommendation = isCompleteRecommendation(result.response)
    ? result.response
    : buildFallbackRecommendation({ estimate });

  return {
    elapsedMs: result.elapsedMs,
    model: result.model,
    recommendation,
  };
}

export async function generateMainframeChatReply({ estimate, messages, modules, selection }) {
  const lastUserMessage = getLastUserMessage(messages);
  const configurationText = getConfigurationContextText(messages);
  const directCatalogModule = findModuleByText(modules, lastUserMessage);
  const broadAllCatalogRequest =
    wantsAllModulesComparison(lastUserMessage)
    || ((isComparisonRequest(lastUserMessage) || isExplanationRequest(lastUserMessage)) && hasBroadAllIntent(lastUserMessage) && !directCatalogModule);
  const catalogModule = broadAllCatalogRequest ? null : findModuleFromConversation(modules, messages, lastUserMessage);
  const adjustedConfiguration = buildAdjustedConfiguration({
    messages,
    modules,
    selection,
  });

  if (adjustedConfiguration) {
    return {
      elapsedMs: 0,
      model: 'configuration-rules',
      reply: buildAdjustedConfigurationReply(adjustedConfiguration),
      suggestedConfiguration: adjustedConfiguration.suggestion?.items ?? null,
      suggestedSelection: adjustedConfiguration.suggestion?.selection ?? null,
    };
  }

  if (shouldContinueConfigurationRequest(messages)) {
    const gaps = getRecommendationGaps(configurationText);

    if (gaps.length > 0) {
      return {
        elapsedMs: 0,
        model: 'configuration-rules',
        reply: buildClarificationReply(gaps),
        suggestedConfiguration: null,
        suggestedSelection: null,
      };
    }
  }

  const suggestion = buildSuggestedConfiguration({ modules, messages });

  if (suggestion?.insufficientBudget) {
    return {
      elapsedMs: 0,
      model: 'configuration-rules',
      reply: buildBudgetTooLowReply({
        budget: suggestion.budget,
        minimumTotal: suggestion.minimumTotal,
      }),
      suggestedConfiguration: null,
      suggestedSelection: null,
    };
  }

  if (suggestion) {
    return {
      elapsedMs: 0,
      model: 'configuration-rules',
      reply: buildFallbackChatRecommendation({ suggestion }),
      suggestedConfiguration: suggestion.items,
      suggestedSelection: suggestion.selection,
    };
  }

  if (
    isComparisonRequest(lastUserMessage)
    || broadAllCatalogRequest
    || (isExplanationRequest(lastUserMessage) && catalogModule)
    || /цена|цени|price|cost|струва|ai\s*профил|ai score|accelerator|ускорител|оценка|текущ|избрана|какво\s+съм\s+избрал|summary/i.test(lastUserMessage)
  ) {
    return {
      elapsedMs: 0,
      model: 'catalog-rules',
      reply: buildFallbackChatReply({
        estimate,
        messages,
        modules,
        selection,
        text: lastUserMessage,
      }),
      suggestedConfiguration: null,
      suggestedSelection: null,
    };
  }

  let result;

  try {
    result = await requestOllama(buildFastChatPrompt({ estimate, messages, modules, selection, suggestion }), {
      cacheKey: `chat:${JSON.stringify(selection)}:${JSON.stringify(messages.slice(-chatHistoryMessages))}:${JSON.stringify(suggestion?.selection ?? null)}`,
      num_predict: chatTokens,
    });
  } catch {
    return {
      elapsedMs: 0,
      model: 'local-fallback',
      reply: buildFallbackChatReply({
        estimate,
        messages,
        modules,
        selection,
        text: lastUserMessage,
      }),
      suggestedConfiguration: null,
      suggestedSelection: null,
    };
  }

  const reply = suggestion && !hasNumberedConfiguration(result.response)
    ? buildFallbackChatRecommendation({ suggestion })
    : ensureApplyQuestion(result.response, suggestion);

  return {
    elapsedMs: result.elapsedMs,
    model: result.model,
    reply,
    suggestedConfiguration: suggestion?.items ?? null,
    suggestedSelection: suggestion?.selection ?? null,
  };
}
