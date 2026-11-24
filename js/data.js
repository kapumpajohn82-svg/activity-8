import { API_BASE_URL } from "./config.js";

const recordsPath = "/api/records";

async function request(path, method = "GET", body) {
  const options = { method, signal: AbortSignal.timeout(15000) };
  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(API_BASE_URL + path, options);
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw new Error("The server took too long to respond. Reload the records before trying again.");
    }
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`The server returned an unreadable response (HTTP ${response.status}). Try again shortly.`);
  }
  if (!response.ok) {
    throw new Error(data?.message || `The request failed (HTTP ${response.status}).`);
  }
  return data;
}

function editableFields({ title, category, description, status }) {
  return { title, category, description, status };
}

export const recordService = {
  list: () => request(recordsPath),
  get: id => request(`${recordsPath}/${id}`),
  create: record => request(recordsPath, "POST", editableFields(record)),
  update: (id, record) => request(`${recordsPath}/${id}`, "PUT", editableFields(record)),
  remove: id => request(`${recordsPath}/${id}`, "DELETE")
};
