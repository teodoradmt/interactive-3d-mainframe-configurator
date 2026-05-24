import http from 'node:http';
import { URL } from 'node:url';
import './env.js';
import { calculateEstimate } from './mainframeData.js';
import { getDatabaseStatus, getModules } from './mongoStore.js';
import { generateAiRecommendation, generateMainframeChatReply } from './ollamaClient.js';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3001);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function isSelectionComplete(selection, modules) {
  return modules.every((module) => selection[module.id] !== undefined);
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
        reject(new Error('Request body is too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);

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

    if (request.method === 'POST' && requestUrl.pathname === '/api/estimate') {
      const body = await readRequestBody(request);
      const payload = body ? JSON.parse(body) : {};
      const modules = await getModules();
      sendJson(response, 200, calculateEstimate(payload.selection ?? payload, modules));
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/ai-recommendation') {
      const body = await readRequestBody(request);
      const payload = body ? JSON.parse(body) : {};
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
      const body = await readRequestBody(request);
      const payload = body ? JSON.parse(body) : {};
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

      sendJson(response, 200, chatReply);
      return;
    }

    sendJson(response, 404, {
      error: 'Not found',
    });
  } catch (error) {
    sendJson(response, 400, {
      error: error.message,
    });
  }
});

server.listen(port, host, () => {
  console.log(`Backend server running at http://${host}:${port}`);
});
