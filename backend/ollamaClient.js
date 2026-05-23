const ollamaBaseUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const ollamaModel = process.env.OLLAMA_MODEL ?? 'mistral';

function formatSelectedModules(modules, selection) {
  return modules
    .map((module) => {
      const option = module.options[Number(selection[module.id])];

      if (!option) {
        return null;
      }

      return `- ${module.title}: ${option.name}, цена ${option.price} EUR, консумация ${option.watts} kW`;
    })
    .filter(Boolean)
    .join('\n');
}

function formatModuleCatalog(modules) {
  return modules
    .map((module) => {
      const options = module.options
        .map((option, index) => {
          const specs = [
            option.cpu ? `${option.cpu} MIPS` : null,
            option.ram ? `${option.ram} GB RAM` : null,
            option.storage ? `${option.storage} TB` : null,
            option.io ? `${option.io} GbE` : null,
            option.security ? `security ${option.security}` : null,
            option.cooling ? `cooling ${option.cooling}` : null,
            `${option.price} EUR`,
          ]
            .filter(Boolean)
            .join(', ');

          return `  ${index + 1}. ${option.name}: ${specs}`;
        })
        .join('\n');

      return `${module.title} (${module.short})\n${options}`;
    })
    .join('\n\n');
}

function formatChatMessages(messages = []) {
  return messages
    .slice(-8)
    .map((message) => {
      const role = message.role === 'assistant' ? 'Mainframe4o' : 'Потребител';
      return `${role}: ${String(message.content ?? '').slice(0, 1200)}`;
    })
    .join('\n');
}

function buildRecommendationPrompt({ estimate, modules, selection }) {
  return `
Ти си AI асистент за конфигуриране на mainframe инфраструктура.
Отговори на български, кратко и практично.
Не измисляй нови цени или компоненти извън дадените данни.
Отговори с максимум 90 думи, без въведение.

Избрани компоненти:
${formatSelectedModules(modules, selection)}

Изчислена оценка:
- Обща цена: ${estimate.total} EUR
- CPU: ${estimate.cpu} MIPS
- Accelerator: ${estimate.accelerator} AI units
- RAM: ${estimate.ram} GB
- Storage: ${estimate.storage} TB
- Електроенергия: ${estimate.kw.toFixed(1)} kW
- Месечен разход за ток: ${estimate.monthlyCost.toFixed(0)} EUR
- Годишен разход за ток: ${estimate.yearlyCost.toFixed(0)} EUR
- Подходящ клиент: ${estimate.recommendation}

Дай точно 4 кратки точки:
1. Баланс
2. Предимство
3. Риск
4. Препоръка
`.trim();
}

function buildChatPrompt({ estimate, messages, modules, selection }) {
  const selectedModules = formatSelectedModules(modules, selection) || 'Няма пълна текуща селекция.';
  const estimateText = estimate
    ? `
- Обща цена: ${estimate.total} EUR
- CPU: ${estimate.cpu} MIPS
- Accelerator: ${estimate.accelerator} AI units
- RAM: ${estimate.ram} GB
- Storage: ${estimate.storage} TB
- Електроенергия: ${estimate.kw.toFixed(1)} kW
- Месечен разход за ток: ${estimate.monthlyCost.toFixed(0)} EUR
- Годишен разход за ток: ${estimate.yearlyCost.toFixed(0)} EUR
- Подходящ клиент: ${estimate.recommendation}
`.trim()
    : 'Няма изчислена оценка за текуща селекция.';

  return `
Ти си Mainframe4o - локален AI консултант за избор на mainframe конфигурация.
Отговаряй на български, ясно и практично.
Използвай само модулите и цените от каталога. Не измисляй компоненти.
Ако потребителят даде бюджет, препоръчай конфигурация, която е под или близо до бюджета.
Ако липсва важна информация, задай 1-2 уточняващи въпроса.
Когато препоръчваш конфигурация, използвай този кратък формат:
Конфигурация: CPU=...; RAM=...; Storage=...; I/O=...; Security=...; Power=...
Цена: ... EUR
Причина: ...
Компромис: ...
Отговори с максимум 75 думи.

Каталог на наличните модули:
${formatModuleCatalog(modules)}

Текуща селекция в конфигуратора:
${selectedModules}

Текуща оценка:
${estimateText}

История на разговора:
${formatChatMessages(messages)}

Mainframe4o:
`.trim();
}

async function requestOllama(prompt, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.25,
          num_predict: 180,
          ...options,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with ${response.status}`);
    }

    const data = await response.json();

    return {
      model: data.model ?? ollamaModel,
      response: data.response?.trim() ?? '',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAiRecommendation({ estimate, modules, selection }) {
  const result = await requestOllama(buildRecommendationPrompt({ estimate, modules, selection }), {
    num_predict: 220,
  });

  return {
    model: result.model,
    recommendation: result.response,
  };
}

export async function generateMainframeChatReply({ estimate, messages, modules, selection }) {
  const result = await requestOllama(buildChatPrompt({ estimate, messages, modules, selection }), {
    num_predict: 180,
  });

  return {
    model: result.model,
    reply: result.response,
  };
}
