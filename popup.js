const STORAGE_KEY = "smartFormFillerSettings";
const FILE_TYPES = ["auto", "pdf", "jpg", "png", "docx"];

const DEFAULT_SETTINGS = {
  preserveFilled: true,
  onlyVisible: true,
  file: {
    enabled: true,
    preferredType: "auto",
    minSizeKB: 8,
    maxSizeKB: 64
  },
  text: {
    minLength: 5,
    maxLength: 36
  },
  number: {
    mode: "any",
    min: null,
    max: null
  },
  date: {
    mode: "future",
    minDaysFromToday: 1,
    maxDaysFromToday: 365
  },
  rules: []
};

const RULES_TEMPLATE = [
  {
    match: {
      selector: "input[name='launchDate']",
      types: ["date", "datetime-local"]
    },
    constraints: {
      date: {
        mode: "future",
        minDaysFromToday: 7,
        maxDaysFromToday: 30
      }
    }
  },
  {
    match: {
      selector: "input[name='budget']"
    },
    constraints: {
      number: {
        min: 5000,
        max: 20000
      }
    }
  },
  {
    match: {
      selector: "input[type='file'][name='specAttachment']"
    },
    constraints: {
      file: {
        enabled: true,
        preferredType: "pdf",
        minSizeKB: 120,
        maxSizeKB: 180,
        mime: "application/pdf",
        extension: ".pdf"
      }
    }
  }
];

const refs = {};

document.addEventListener("DOMContentLoaded", initializePopup);

async function initializePopup() {
  bindElements();
  bindEvents();

  try {
    const storedSettings = await storageGet(STORAGE_KEY);
    const settings = normalizeSettings(storedSettings);
    applySettingsToForm(settings);
    setStatus("Settings loaded.");
  } catch (error) {
    setStatus(`Failed to load settings: ${error.message}`, true);
    applySettingsToForm(DEFAULT_SETTINGS);
  }
}

function bindElements() {
  refs.preserveFilled = document.getElementById("preserveFilled");
  refs.onlyVisible = document.getElementById("onlyVisible");
  refs.fileEnabled = document.getElementById("fileEnabled");
  refs.fileType = document.getElementById("fileType");
  refs.fileMinSizeKB = document.getElementById("fileMinSizeKB");
  refs.fileMaxSizeKB = document.getElementById("fileMaxSizeKB");
  refs.textMinLength = document.getElementById("textMinLength");
  refs.textMaxLength = document.getElementById("textMaxLength");
  refs.numberMode = document.getElementById("numberMode");
  refs.numberMin = document.getElementById("numberMin");
  refs.numberMax = document.getElementById("numberMax");
  refs.dateMode = document.getElementById("dateMode");
  refs.dateMinDays = document.getElementById("dateMinDays");
  refs.dateMaxDays = document.getElementById("dateMaxDays");
  refs.rulesJson = document.getElementById("rulesJson");
  refs.saveBtn = document.getElementById("saveBtn");
  refs.fillBtn = document.getElementById("fillBtn");
  refs.status = document.getElementById("status");
}

function bindEvents() {
  refs.saveBtn.addEventListener("click", onSaveClicked);
  refs.fillBtn.addEventListener("click", onFillClicked);
}

function applySettingsToForm(rawSettings) {
  const settings = normalizeSettings(rawSettings);

  refs.preserveFilled.checked = Boolean(settings.preserveFilled);
  refs.onlyVisible.checked = Boolean(settings.onlyVisible);
  refs.fileEnabled.checked = Boolean(settings.file.enabled);
  refs.fileType.value = settings.file.preferredType;
  refs.fileMinSizeKB.value = toInputValue(settings.file.minSizeKB);
  refs.fileMaxSizeKB.value = toInputValue(settings.file.maxSizeKB);
  refs.textMinLength.value = toInputValue(settings.text.minLength);
  refs.textMaxLength.value = toInputValue(settings.text.maxLength);
  refs.numberMode.value = settings.number.mode;
  refs.numberMin.value = toInputValue(settings.number.min);
  refs.numberMax.value = toInputValue(settings.number.max);
  refs.dateMode.value = settings.date.mode;
  refs.dateMinDays.value = toInputValue(settings.date.minDaysFromToday);
  refs.dateMaxDays.value = toInputValue(settings.date.maxDaysFromToday);
  refs.rulesJson.value = settings.rules.length
    ? JSON.stringify(settings.rules, null, 2)
    : JSON.stringify(RULES_TEMPLATE, null, 2);
}

function toInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

async function onSaveClicked() {
  refs.saveBtn.disabled = true;

  try {
    const settings = collectSettingsFromForm();
    await storageSet(STORAGE_KEY, settings);
    setStatus("Settings saved.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    refs.saveBtn.disabled = false;
  }
}

async function onFillClicked() {
  refs.fillBtn.disabled = true;

  try {
    const settings = collectSettingsFromForm();
    await storageSet(STORAGE_KEY, settings);

    const activeTab = await getActiveTab();
    if (!activeTab || !activeTab.id) {
      throw new Error("No active tab found.");
    }

    if (isRestrictedUrl(activeTab.url)) {
      throw new Error("This page does not allow extension scripts.");
    }

    await executeScript(activeTab.id, ["content.js"]);
    const response = await sendTabMessage(activeTab.id, {
      action: "fillForm",
      settings
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Form fill failed.");
    }

    const result = response.result || {};
    const parts = [`Filled ${result.filled || 0} fields`];
    if (result.skipped) {
      parts.push(`skipped ${result.skipped}`);
    }
    if (result.errors) {
      parts.push(`${result.errors} errors`);
    }

    setStatus(parts.join(", "), Boolean(result.errors));
  } catch (error) {
    setStatus(`Fill failed: ${error.message}`, true);
  } finally {
    refs.fillBtn.disabled = false;
  }
}

function isRestrictedUrl(url = "") {
  return /^(chrome|brave|edge|about):\/\//i.test(url);
}

function collectSettingsFromForm() {
  const rules = parseRulesJson(refs.rulesJson.value);

  const settings = normalizeSettings({
    preserveFilled: refs.preserveFilled.checked,
    onlyVisible: refs.onlyVisible.checked,
    file: {
      enabled: refs.fileEnabled.checked,
      preferredType: refs.fileType.value,
      minSizeKB: parseOptionalNumber(refs.fileMinSizeKB.value),
      maxSizeKB: parseOptionalNumber(refs.fileMaxSizeKB.value)
    },
    text: {
      minLength: parseOptionalNumber(refs.textMinLength.value),
      maxLength: parseOptionalNumber(refs.textMaxLength.value)
    },
    number: {
      mode: refs.numberMode.value,
      min: parseOptionalNumber(refs.numberMin.value),
      max: parseOptionalNumber(refs.numberMax.value)
    },
    date: {
      mode: refs.dateMode.value,
      minDaysFromToday: parseOptionalNumber(refs.dateMinDays.value),
      maxDaysFromToday: parseOptionalNumber(refs.dateMaxDays.value)
    },
    rules
  });

  return settings;
}

function parseRulesJson(source) {
  if (!source.trim()) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error("Rules JSON is invalid.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Rules JSON must be an array.");
  }

  return parsed;
}

function parseOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSettings(raw) {
  const merged = deepMerge(clone(DEFAULT_SETTINGS), raw || {});

  if (!["any", "positive", "negative"].includes(merged.number.mode)) {
    merged.number.mode = DEFAULT_SETTINGS.number.mode;
  }

  if (!["any", "future", "past"].includes(merged.date.mode)) {
    merged.date.mode = DEFAULT_SETTINGS.date.mode;
  }

  merged.file.enabled = Boolean(merged.file.enabled);
  if (!FILE_TYPES.includes(merged.file.preferredType)) {
    merged.file.preferredType = DEFAULT_SETTINGS.file.preferredType;
  }
  merged.file.minSizeKB = coercePositive(merged.file.minSizeKB, DEFAULT_SETTINGS.file.minSizeKB);
  merged.file.maxSizeKB = coercePositive(merged.file.maxSizeKB, DEFAULT_SETTINGS.file.maxSizeKB);
  if (merged.file.minSizeKB > merged.file.maxSizeKB) {
    merged.file.maxSizeKB = merged.file.minSizeKB;
  }

  merged.text.minLength = coerceNonNegative(merged.text.minLength, DEFAULT_SETTINGS.text.minLength);
  merged.text.maxLength = coercePositive(merged.text.maxLength, DEFAULT_SETTINGS.text.maxLength);
  if (merged.text.minLength > merged.text.maxLength) {
    merged.text.maxLength = merged.text.minLength;
  }

  merged.date.minDaysFromToday = coerceOptionalInteger(merged.date.minDaysFromToday);
  merged.date.maxDaysFromToday = coerceOptionalInteger(merged.date.maxDaysFromToday);
  merged.number.min = coerceOptionalNumber(merged.number.min);
  merged.number.max = coerceOptionalNumber(merged.number.max);
  merged.rules = Array.isArray(merged.rules) ? merged.rules : [];

  return merged;
}

function coerceNonNegative(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.round(parsed));
}

function coercePositive(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function coerceOptionalInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed);
}

function coerceOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deepMerge(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return target;
  }

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      target[key] = value;
      continue;
    }

    if (value && typeof value === "object") {
      const current = target[key];
      const base = current && typeof current === "object" && !Array.isArray(current) ? current : {};
      target[key] = deepMerge(base, value);
      continue;
    }

    target[key] = value;
  }

  return target;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setStatus(message, isError = false) {
  refs.status.textContent = message;
  refs.status.classList.toggle("error", Boolean(isError));
}

function storageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result[key]);
    });
  });
}

function storageSet(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tabs[0]);
    });
  });
}

function executeScript(tabId, files) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      }
    );
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}
