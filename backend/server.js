import http from 'node:http';
import { URL } from 'node:url';
import './env.js';
import {
  createSessionToken,
  getBearerToken,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  normalizeEmail,
  validatePassword,
  verifyPassword,
} from './auth.js';
import { calculateEstimate } from './mainframeData.js';
import {
  createSession,
  createUser,
  deleteSessionByTokenHash,
  deleteUserConfiguration,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  getDatabaseStatus,
  getGlossaryTerms,
  getModules,
  getPublicUserById,
  getUserConfigurationById,
  getUserConfigurations,
  saveUserConfiguration,
  updateUserProfile,
} from './mongoStore.js';
import {
  completeInfrastructureSelection,
  generateAiRecommendation,
  generateMainframeChatReply,
} from './ollamaClient.js';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3001);
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const defaultAvatarColors = ['#2ea698', '#88d9ef', '#f5c15c', '#d86c61', '#7d8df1'];
const duplicateConfigurationNameMessage = 'Такава конфигурация вече съществува. Моля изберете друго име';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function isOptionalModule(module) {
  return module.required === false || module.category === 'external';
}

function isSelectionComplete(selection, modules) {
  return modules
    .filter((module) => !isOptionalModule(module))
    .every((module) => selection[module.id] !== undefined);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendNoContent(response) {
  response.writeHead(204, corsHeaders);
  response.end();
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new HttpError(413, 'Заявката е твърде голяма.'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function readJsonPayload(request) {
  const body = await readRequestBody(request);

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'Невалиден JSON payload.');
  }
}

function sendError(response, error) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;

  if (!(error instanceof HttpError)) {
    console.error(error);
  }

  sendJson(response, statusCode, {
    error: error instanceof Error ? error.message : 'Възникна неочаквана грешка.',
    ...(error.details ? { details: error.details } : {}),
  });
}

function sanitizeText(value, { fallback = '', maxLength = 120 } = {}) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');

  if (!text) {
    return String(fallback ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
  }

  return text.slice(0, maxLength);
}

function sanitizeAvatarColor(value, seed = '') {
  const color = String(value ?? '').trim();

  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % defaultAvatarColors.length;
  return defaultAvatarColors[index];
}

function sanitizeAvatarImage(value) {
  const image = String(value ?? '').trim();

  if (!image) {
    return '';
  }

  if (image.length > 250_000) {
    throw new HttpError(400, 'Профилната снимка е твърде голяма. Избери по-малък файл.');
  }

  if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image)) {
    throw new HttpError(400, 'Профилната снимка трябва да е PNG, JPG или WebP.');
  }

  return image;
}

function buildProfileName(value, email) {
  return sanitizeText(value, {
    fallback: email.split('@')[0],
    maxLength: 64,
  });
}

function getDuplicateEmailError(error) {
  return error?.code === 11000
    ? new HttpError(409, 'Вече има профил с този email.')
    : error;
}

async function createUserSession(userId) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + sessionDurationMs);

  await createSession({
    expiresAt,
    tokenHash: hashSessionToken(token),
    userId,
  });

  return {
    expiresAt,
    token,
  };
}

async function getAuthenticatedUser(request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new HttpError(401, 'Необходимо е да влезеш в профила си.');
  }

  const tokenHash = hashSessionToken(token);
  const session = await findSessionByTokenHash(tokenHash);

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await deleteSessionByTokenHash(tokenHash);
    }

    throw new HttpError(401, 'Сесията е изтекла. Влез отново.');
  }

  const user = await findUserById(session.userId);

  if (!user) {
    await deleteSessionByTokenHash(tokenHash);
    throw new HttpError(401, 'Профилът не беше намерен.');
  }

  return {
    tokenHash,
    user,
  };
}

function validateSelection(selection, modules) {
  if (!selection || typeof selection !== 'object') {
    throw new HttpError(400, 'Липсва конфигурация за запазване.');
  }

  const normalizedSelection = {};

  for (const module of modules) {
    if (isOptionalModule(module) && selection[module.id] === undefined) {
      continue;
    }

    const optionIndex = Number(selection[module.id]);

    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= module.options.length) {
      throw new HttpError(400, `Избери валидна опция за "${module.title}".`);
    }

    normalizedSelection[module.id] = optionIndex;
  }

  return normalizedSelection;
}

function buildConfigurationSnapshot(modules, selection) {
  return modules
    .filter((module) => !isOptionalModule(module) || selection[module.id] !== undefined)
    .map((module) => {
      const selectedIndex = selection[module.id];
      const option = module.options[selectedIndex];

      return {
        moduleId: module.id,
        moduleTitle: module.title,
        moduleShort: module.short,
        selectedIndex,
        option: {
          ...option,
        },
      };
    });
}

function sanitizeBackground(background) {
  if (!background || typeof background !== 'object') {
    return {
      color: '#101113',
      type: 'color',
    };
  }

  const color = /^#[0-9a-f]{6}$/i.test(background.color ?? '') ? background.color : '#101113';

  if (background.type === 'image') {
    return {
      color,
      imageName: sanitizeText(background.imageName, { maxLength: 120 }),
      type: 'image',
    };
  }

  return {
    color,
    type: 'color',
  };
}

function sanitizeFrameConfiguration(frameConfiguration) {
  if (!frameConfiguration || typeof frameConfiguration !== 'object') {
    return {
      selectedFrameId: 'auto',
    };
  }

  const selectableFrameIds = new Set(['auto', 'single-z', 'z-plus-a']);
  const concreteFrameIds = new Set(['single-z', 'z-plus-a']);
  const selectedFrameId = selectableFrameIds.has(frameConfiguration.selectedFrameId)
    ? frameConfiguration.selectedFrameId
    : 'auto';
  const effectiveFrameId = concreteFrameIds.has(frameConfiguration.effectiveFrameId)
    ? frameConfiguration.effectiveFrameId
    : concreteFrameIds.has(selectedFrameId) ? selectedFrameId : 'single-z';
  const recommendedFrameId = concreteFrameIds.has(frameConfiguration.recommendedFrameId)
    ? frameConfiguration.recommendedFrameId
    : effectiveFrameId;
  const warnings = Array.isArray(frameConfiguration.warnings)
    ? frameConfiguration.warnings.slice(0, 12).map((message) => sanitizeText(message, { maxLength: 180 }))
    : [];

  return {
    effectiveFrameId,
    effectiveFrameName: sanitizeText(frameConfiguration.effectiveFrameName, { maxLength: 80 }),
    isValid: Boolean(frameConfiguration.isValid),
    recommendedFrameId,
    recommendedFrameName: sanitizeText(frameConfiguration.recommendedFrameName, { maxLength: 80 }),
    selectedFrameId,
    warnings,
  };
}

function buildExportPayload({ configuration, user }) {
  return {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    owner: {
      email: user.email,
      profileName: user.profileName,
      workplace: user.workplace ?? '',
    },
    configuration,
  };
}

async function handleRegister(request, response) {
  const payload = await readJsonPayload(request);
  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Въведи валиден email.');
  }

  const passwordErrors = validatePassword(payload.password);

  if (passwordErrors.length > 0) {
    throw new HttpError(400, 'Паролата не покрива изискванията.', passwordErrors);
  }

  try {
    const user = await createUser({
      ...hashPassword(String(payload.password)),
      avatarColor: sanitizeAvatarColor(payload.avatarColor, email),
      avatarImage: sanitizeAvatarImage(payload.avatarImage),
      email,
      profileName: buildProfileName(payload.profileName, email),
      workplace: sanitizeText(payload.workplace, { maxLength: 96 }),
    });
    const session = await createUserSession(user.id);

    sendJson(response, 201, {
      token: session.token,
      user,
    });
  } catch (error) {
    throw getDuplicateEmailError(error);
  }
}

async function handleLogin(request, response) {
  const payload = await readJsonPayload(request);
  const email = normalizeEmail(payload.email);
  const user = await findUserByEmail(email);

  if (!user || !verifyPassword(String(payload.password ?? ''), user)) {
    throw new HttpError(401, 'Невалиден email или парола.');
  }

  const session = await createUserSession(user._id);

  sendJson(response, 200, {
    token: session.token,
    user: await getPublicUserById(user._id),
  });
}

async function handleProfileUpdate(request, response) {
  const { user } = await getAuthenticatedUser(request);
  const payload = await readJsonPayload(request);
  const updatedUser = await updateUserProfile(user._id, {
    avatarColor: sanitizeAvatarColor(payload.avatarColor, user.email),
    avatarImage: sanitizeAvatarImage(payload.avatarImage),
    profileName: buildProfileName(payload.profileName, user.email),
    workplace: sanitizeText(payload.workplace, { maxLength: 96 }),
  });

  sendJson(response, 200, {
    user: updatedUser,
  });
}

async function handleSaveConfiguration(request, response) {
  const { user } = await getAuthenticatedUser(request);
  const payload = await readJsonPayload(request);
  const modules = await getModules();
  const selection = validateSelection(payload.selection, modules);

  if (!isSelectionComplete(selection, modules)) {
    throw new HttpError(400, 'Конфигурацията трябва да е пълна преди запазване.');
  }

  const name = sanitizeText(payload.name, {
    maxLength: 80,
  });

  if (!name) {
    throw new HttpError(400, 'Добави име на конфигурацията.');
  }

  const saveResult = await saveUserConfiguration(user._id, {
    background: sanitizeBackground(payload.background),
    designId: sanitizeText(payload.designId, { maxLength: 64 }),
    designName: sanitizeText(payload.designName, { maxLength: 80 }),
    frameConfiguration: sanitizeFrameConfiguration(payload.frameConfiguration),
    modulesSnapshot: buildConfigurationSnapshot(modules, selection),
    name,
    selection,
    totals: calculateEstimate(selection, modules),
  });

  if (saveResult.status === 'exists') {
    throw new HttpError(409, duplicateConfigurationNameMessage, {
      code: 'CONFIGURATION_NAME_EXISTS',
      configuration: saveResult.configuration,
    });
  }

  sendJson(response, 201, {
    configuration: saveResult.configuration,
    status: saveResult.status,
  });
}

async function handleExportConfiguration(request, response, configurationId) {
  const { user } = await getAuthenticatedUser(request);
  const configuration = await getUserConfigurationById(user._id, configurationId);

  if (!configuration) {
    throw new HttpError(404, 'Конфигурацията не беше намерена.');
  }

  sendJson(response, 200, buildExportPayload({
    configuration,
    user,
  }));
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);
    const configurationMatch = requestUrl.pathname.match(/^\/api\/configurations\/([^/]+)$/);
    const configurationExportMatch = requestUrl.pathname.match(/^\/api\/configurations\/([^/]+)\/export$/);

    if (request.method === 'OPTIONS') {
      sendNoContent(response);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'mainframe-backend',
        database: await getDatabaseStatus(),
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/modules') {
      const modules = await getModules();
      sendJson(response, 200, modules);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/glossary-terms') {
      const glossaryTerms = await getGlossaryTerms();
      sendJson(response, 200, glossaryTerms);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/register') {
      await handleRegister(request, response);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/login') {
      await handleLogin(request, response);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/auth/me') {
      const { user } = await getAuthenticatedUser(request);

      sendJson(response, 200, {
        user: await getPublicUserById(user._id),
      });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/logout') {
      const { tokenHash } = await getAuthenticatedUser(request);

      await deleteSessionByTokenHash(tokenHash);
      sendJson(response, 200, {
        ok: true,
      });
      return;
    }

    if (request.method === 'PUT' && requestUrl.pathname === '/api/profile') {
      await handleProfileUpdate(request, response);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/configurations') {
      const { user } = await getAuthenticatedUser(request);

      sendJson(response, 200, {
        configurations: await getUserConfigurations(user._id),
      });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/configurations') {
      await handleSaveConfiguration(request, response);
      return;
    }

    if (request.method === 'GET' && configurationMatch) {
      const { user } = await getAuthenticatedUser(request);
      const configuration = await getUserConfigurationById(user._id, configurationMatch[1]);

      if (!configuration) {
        throw new HttpError(404, 'Конфигурацията не беше намерена.');
      }

      sendJson(response, 200, {
        configuration,
      });
      return;
    }

    if (request.method === 'DELETE' && configurationMatch) {
      const { user } = await getAuthenticatedUser(request);
      const result = await deleteUserConfiguration(user._id, configurationMatch[1]);

      if (result.deletedCount === 0) {
        throw new HttpError(404, 'Конфигурацията не беше намерена.');
      }

      sendJson(response, 200, {
        ok: true,
      });
      return;
    }

    if (request.method === 'GET' && configurationExportMatch) {
      await handleExportConfiguration(request, response, configurationExportMatch[1]);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/estimate') {
      const payload = await readJsonPayload(request);
      const modules = await getModules();
      sendJson(response, 200, calculateEstimate(payload.selection ?? payload, modules));
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/ai-recommendation') {
      const payload = await readJsonPayload(request);
      const selection = payload.selection ?? {};
      const modules = await getModules();
      const estimate = calculateEstimate(selection, modules);
      const recommendation = await generateAiRecommendation({
        estimate,
        modules,
        selection,
      });

      sendJson(response, 200, recommendation);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/mainframe4o-chat') {
      const payload = await readJsonPayload(request);
      const selection = payload.selection ?? {};
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const modules = await getModules();
      const estimate = isSelectionComplete(selection, modules) ? calculateEstimate(selection, modules) : null;
      const chatReply = await generateMainframeChatReply({
        estimate,
        messages,
        modules,
        selection,
      });
      const suggestedSelection = chatReply.suggestedSelection
        ? completeInfrastructureSelection(
            modules,
            chatReply.suggestedSelection,
            messages.map((message) => message.content ?? '').join('\n'),
          )
        : null;

      sendJson(response, 200, {
        ...chatReply,
        suggestedSelection,
      });
      return;
    }

    sendJson(response, 404, {
      error: 'Не е намерено.',
    });
  } catch (error) {
    sendError(response, error);
  }
});

server.listen(port, host, () => {
  console.log(`Backend server running at http://${host}:${port}`);
});
