const axios = require('axios');

const UBIDOTS_BASE_URL = process.env.UBIDOTS_BASE_URL || 'https://stem.ubidots.com';
const UBIDOTS_TOKEN = process.env.UBIDOTS_TOKEN;

const api = axios.create({
  baseURL: UBIDOTS_BASE_URL,
  headers: { 'X-Auth-Token': UBIDOTS_TOKEN },
});

async function getDevice(deviceId) {
  const { data } = await api.get(`/api/v2.0/devices/${deviceId}/`);
  return data;
}

async function getDeviceVariables(deviceId) {
  const { data } = await api.get(`/api/v2.0/devices/${deviceId}/variables`, {
    params: { page_size: 100 },
  });
  return data.results;
}

async function getVariableValues(variableId, { start, end, limit = 100 } = {}) {
  const params = { page_size: limit };
  if (start) params.start = start;
  if (end) params.end = end;
  const { data } = await api.get(`/api/v1.6/variables/${variableId}/values`, { params });
  return data.results;
}

async function getAllDevices() {
  const { data } = await api.get('/api/v2.0/devices/');
  return data.results;
}

module.exports = { getDevice, getDeviceVariables, getVariableValues, getAllDevices };
