const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
  }

  if (!response.ok) {
    const isMissingAuthRoute = response.status === 404 && path.startsWith('/api/auth/');
    const message = isMissingAuthRoute
      ? 'Auth API не е намерено. Рестартирай backend сървъра, за да зареди новите routes.'
      : payload?.error ?? `Request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = payload?.details ?? [];
    throw error;
  }

  return payload;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function fetchModules() {
  return fetchJson('/api/modules');
}

export function fetchEstimate(selection, signal) {
  return fetchJson('/api/estimate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ selection }),
    signal,
  });
}

export function fetchAiRecommendation(selection, signal) {
  return fetchJson('/api/ai-recommendation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ selection }),
    signal,
  });
}

export function sendMainframeChatMessage({ messages, selection }, signal) {
  return fetchJson('/api/mainframe4o-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, selection }),
    signal,
  });
}

export function registerUser(payload) {
  return fetchJson('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload) {
  return fetchJson('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser(token) {
  return fetchJson('/api/auth/me', {
    headers: authHeaders(token),
  });
}

export function logoutUser(token) {
  return fetchJson('/api/auth/logout', {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export function updateProfile(token, payload) {
  return fetchJson('/api/profile', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchSavedConfigurations(token) {
  return fetchJson('/api/configurations', {
    headers: authHeaders(token),
  });
}

export function saveConfiguration(token, payload) {
  return fetchJson('/api/configurations', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function deleteSavedConfiguration(token, configurationId) {
  return fetchJson(`/api/configurations/${configurationId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export function fetchConfigurationExport(token, configurationId) {
  return fetchJson(`/api/configurations/${configurationId}/export`, {
    headers: authHeaders(token),
  });
}
