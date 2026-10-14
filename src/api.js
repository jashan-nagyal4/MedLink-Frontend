
const API_BASE_URL = 'http://localhost:4000/api';

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Request failed (HTTP ${response.status}).`
    );
  }

  return data;
}

export function checkApiHealth() {
  return apiRequest('/health');
}

export function login(email, password) {
  return apiRequest('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getHospitals(token) {
  return apiRequest('/hospitals', token);
}

export function getHospitalDetails(id, token) {
  return apiRequest(`/hospitals/${encodeURIComponent(id)}`, token);
}

export function getNearbyHospitals(token, lat, lng, radius = 25) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius),
  });

  return apiRequest(`/hospitals/nearby?${params.toString()}`, token);
}


export function createHospital(token, hospital) {
  return apiRequest('/hospitals', token, {
    method: 'POST',
    body: JSON.stringify(hospital),
  });
}

export function updateHospital(id, token, hospital) {
  return apiRequest(`/hospitals/${encodeURIComponent(id)}`, token, {
    method: 'PUT',
    body: JSON.stringify(hospital),
  });
}


export function deleteHospital(id, token) {
  return apiRequest(`/hospitals/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
}
