import { API_BASE_URL } from "./config.js";
import { recordService } from "./data.js";

const query = selector => document.querySelector(selector);
const form = query("#request-form");
const editor = query("#request-dialog");
const details = query("#details-dialog");
const confirmation = query("#delete-dialog");
const list = query("#record-list");
const search = query("#search");
const filter = query("#filter");
const empty = query("#empty");
const announcement = query("#announcement");
const save = query("#save-request");
const cancel = query("#cancel-edit");
const formError = query("#form-error");
const loadError = query("#load-error");
const loadMessage = query("#load-message");
const retryLoad = query("#retry-load");
const newButton = query("[data-new]");
const count = query("#count");
query("#api-guide").href = API_BASE_URL + "/";
query("#api-health").href = API_BASE_URL + "/health";
const fieldNames = ["title", "category", "description", "status"];
const statuses = ["Pending", "In progress", "Completed"];
let records = null;
let busy = false;
let editingId = null;
let deletingId = null;

function announce(message, error = false) {
  announcement.classList.toggle("error", error);
  announcement.hidden = !message;
  announcement.textContent = message;
}

function errorMessage(error) {
  return error.message || "The request failed. Try again.";
}

function setBusy(value) {
  busy = value;
  newButton.disabled = value;
  retryLoad.disabled = value;
  save.disabled = value;
}

function makeRow(record) {
  const row = query("#record-template").content.firstElementChild.cloneNode(true);
  row.dataset.recordId = record.id;
  row.querySelector(".record-id").textContent = `#${record.id}`;
  row.querySelector(".record-category").textContent = record.category;
  row.querySelector(".record-title").textContent = record.title;
  const badge = row.querySelector(".badge");
  badge.dataset.status = record.status;
  badge.textContent = record.status;
  for (const button of row.querySelectorAll("button")) {
    button.setAttribute("aria-label", `${button.textContent} request #${record.id}, ${record.title}`);
  }
  return row;
}

function renderRecords() {
  if (records === null) return;
  const term = search.value.trim().toLowerCase();
  const results = records.filter(record =>
    record.title.toLowerCase().includes(term) && (!filter.value || record.status === filter.value)
  ).sort((a, b) => b.id - a.id);
  count.textContent = `Showing ${results.length} of ${records.length} requests`;
  list.replaceChildren(...results.map(makeRow));
  empty.hidden = results.length > 0;
  empty.textContent = records.length
    ? "No requests match these filters."
    : "No requests yet. Select New request to add one.";
}

async function refresh() {
  loadError.hidden = true;
  list.setAttribute("aria-busy", "true");
  count.textContent = "Loading records…";
  try {
    const result = await recordService.list();
    if (!Array.isArray(result)) throw new Error("The server returned an invalid record list.");
    records = result;
    renderRecords();
  } catch (error) {
    count.textContent = "";
    loadMessage.textContent = records === null
      ? `Could not load records. ${errorMessage(error)}`
      : `The displayed records may be out of date. ${errorMessage(error)}`;
    loadError.hidden = false;
  } finally {
    list.removeAttribute("aria-busy");
  }
}

async function reloadRecords() {
  if (busy) return;
  setBusy(true);
  try {
    await refresh();
  } finally {
    setBusy(false);
  }
}

function setValidation(errors = {}) {
  for (const name of fieldNames) {
    const input = form.elements.namedItem(name);
    query(`#${name}-error`).textContent = errors[name] ?? "";
    if (errors[name]) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
}

function openEditor(record) {
  const category = form.elements.namedItem("category");
  category.querySelector("[data-existing-category]")?.remove();
  if (record && ![...category.options].some(option => option.value === record.category)) {
    const option = new Option(record.category, record.category);
    option.dataset.existingCategory = "";
    category.add(option);
  }
  form.reset();
  setValidation();
  formError.textContent = "";
  announce("");
  editingId = record?.id ?? null;
  query("#form-title").textContent = record ? "Edit request" : "New request";
  query("#edit-id").hidden = !record;
  query("#edit-id").textContent = record ? `Request #${record.id}` : "";
  save.textContent = record ? "Save changes" : "Add request";
  cancel.textContent = record ? "Cancel Edit" : "Cancel";
  if (record) {
    for (const name of fieldNames) form.elements.namedItem(name).value = record[name];
  }
  editor.showModal();
}

function viewRecord(record) {
  const pairs = [
    ["ID", `#${record.id}`], ["Title", record.title], ["Category", record.category],
    ["Description", record.description], ["Status", record.status]
  ];
  query("#details").replaceChildren(...pairs.map(([label, value]) => {
    const group = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    group.append(term, description);
    return group;
  }));
  details.showModal();
}

newButton.addEventListener("click", () => openEditor());
cancel.addEventListener("click", () => editor.close());

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;

  const record = Object.fromEntries(fieldNames.map(name => [name, form.elements.namedItem(name).value.trim()]));
  const errors = {};
  if (Array.from(record.title).length < 3 || Array.from(record.title).length > 80) errors.title = "Enter a title with 3–80 characters.";
  if (Array.from(record.category).length < 2 || Array.from(record.category).length > 40) errors.category = "Choose a category.";
  if (Array.from(record.description).length < 5 || Array.from(record.description).length > 300) errors.description = "Enter a description with 5–300 characters.";
  if (!statuses.includes(record.status)) errors.status = "Choose a valid status.";
  setValidation(errors);
  const firstInvalid = Object.keys(errors)[0];
  if (firstInvalid) {
    formError.textContent = "Check the highlighted fields.";
    form.elements.namedItem(firstInvalid).focus();
    return;
  }

  setBusy(true);
  cancel.disabled = true;
  for (const name of fieldNames) form.elements.namedItem(name).disabled = true;
  formError.textContent = "";
  try {
    const updating = editingId !== null;
    const saved = updating ? await recordService.update(editingId, record) : await recordService.create(record);
    editor.close();
    announce(`Request #${saved.id} ${updating ? "updated" : "added"}.`);
    await refresh();
    (list.querySelector(`[data-record-id="${saved.id}"] button`) || search).focus();
  } catch (error) {
    if (editor.open) formError.textContent = errorMessage(error);
    else announce(errorMessage(error), true);
  } finally {
    for (const name of fieldNames) form.elements.namedItem(name).disabled = false;
    cancel.disabled = false;
    setBusy(false);
  }
});

list.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button || busy) return;
  setBusy(true);
  try {
    const record = await recordService.get(Number(button.closest(".request-row").dataset.recordId));
    announce("");
    switch (button.dataset.action) {
      case "view":
        viewRecord(record);
        break;
      case "edit":
        openEditor(record);
        break;
      case "delete":
        deletingId = record.id;
        confirmation.returnValue = "cancel";
        query("#delete-description").textContent = `Delete request #${record.id}, “${record.title}”?`;
        confirmation.showModal();
        break;
    }
  } catch (error) {
    announce(errorMessage(error), true);
  } finally {
    setBusy(false);
  }
});

confirmation.addEventListener("close", async () => {
  const id = deletingId;
  deletingId = null;
  if (confirmation.returnValue !== "confirm" || id === null) return;
  setBusy(true);
  try {
    const { message } = await recordService.remove(id);
    announce(message);
    await refresh();
    search.focus();
  } catch (error) {
    announce(errorMessage(error), true);
  } finally {
    setBusy(false);
  }
});

search.addEventListener("input", renderRecords);
filter.addEventListener("change", renderRecords);
query("#clear-filters").addEventListener("click", () => {
  search.value = "";
  filter.value = "";
  renderRecords();
  search.focus();
});
editor.addEventListener("cancel", event => {
  if (cancel.disabled) event.preventDefault();
});
retryLoad.addEventListener("click", reloadRecords);
reloadRecords();
