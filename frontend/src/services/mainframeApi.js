const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json();
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
