const STORAGE_KEY_SETTINGS = "smartFormFillerSettings";
const STORAGE_KEY_STATE = "smartFormFillerState";
const DEFAULT_PROFILE_ID = "default";
const FILE_TYPES = ["auto", "pdf", "jpg", "png", "docx"];

const DEFAULT_SETTINGS = {
  preserveFilled: true,
  onlyVisible: true,
  shortcut: {
    clickCount: 2
  },
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

const DEFAULT_STATE = {
  activeProfileId: DEFAULT_PROFILE_ID,
  profiles: [
    {
      id: DEFAULT_PROFILE_ID,
      name: "Default",
      settings: clone(DEFAULT_SETTINGS)
    }
  ]
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
let appState = clone(DEFAULT_STATE);

document.addEventListener("DOMContentLoaded", initializePopup);

async function initializePopup() {
  bindElements();
  bindEvents();

  try {
    appState = await loadState();
    await persistState();
    renderProfiles();
    const active = getActiveProfile();
    applySettingsToForm(active.settings);
    syncProfileUiState();
    setStatus("Settings loaded.");
  } catch (error) {
    appState = normalizeState(DEFAULT_STATE);
    renderProfiles();
    applySettingsToForm(DEFAULT_SETTINGS);
    syncProfileUiState();
    setStatus(`Failed to load settings: ${error.message}`, true);
  }
}

function bindElements() {
  refs.profileSelect = document.getElementById("profileSelect");
  refs.profileName = document.getElementById("profileName");
  refs.saveProfileBtn = document.getElementById("saveProfileBtn");
  refs.deleteProfileBtn = document.getElementById("deleteProfileBtn");

  refs.preserveFilled = document.getElementById("preserveFilled");
  refs.onlyVisible = document.getElementById("onlyVisible");
  refs.shortcutClickCount = document.getElementById("shortcutClickCount");
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
  refs.undoBtn = document.getElementById("undoBtn");
  refs.status = document.getElementById("status");
}

function bindEvents() {
  refs.profileSelect.addEventListener("change", onProfileSelected);
  refs.saveProfileBtn.addEventListener("click", onSaveProfileClicked);
  refs.deleteProfileBtn.addEventListener("click", onDeleteProfileClicked);
  refs.saveBtn.addEventListener("click", onSaveClicked);
  refs.fillBtn.addEventListener("click", onFillClicked);
  refs.undoBtn.addEventListener("click", onUndoClicked);
}

function renderProfiles() {
  refs.profileSelect.innerHTML = "";

  for (const profile of appState.profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    refs.profileSelect.appendChild(option);
  }

  refs.profileSelect.value = appState.activeProfileId;
}

function applySettingsToForm(rawSettings) {
  const settings = normalizeSettings(rawSettings);

  refs.preserveFilled.checked = Boolean(settings.preserveFilled);
  refs.onlyVisible.checked = Boolean(settings.onlyVisible);
  refs.shortcutClickCount.value = String(settings.shortcut.clickCount);
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

function syncProfileUiState() {
  const active = getActiveProfile();
  const isProtected = active.id === DEFAULT_PROFILE_ID || appState.profiles.length <= 1;
  refs.deleteProfileBtn.disabled = isProtected;
}

function toInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

async function onProfileSelected() {
  const nextId = refs.profileSelect.value;
  if (!nextId || nextId === appState.activeProfileId) {
    return;
  }

  appState.activeProfileId = nextId;
  const active = getActiveProfile();
  applySettingsToForm(active.settings);
  syncProfileUiState();

  try {
    await persistState();
    setStatus(`Loaded profile "${active.name}".`);
  } catch (error) {
    setStatus(`Failed to switch profile: ${error.message}`, true);
  }
}

async function onSaveProfileClicked() {
  refs.saveProfileBtn.disabled = true;

  try {
    const requestedName = normalizeProfileName(refs.profileName.value, "");
    if (!requestedName) {
      throw new Error("Enter a profile name first.");
    }

    const settings = collectSettingsFromForm();
    const existing = appState.profiles.find((profile) => profile.name.toLowerCase() === requestedName.toLowerCase());

    if (existing) {
      existing.settings = settings;
      appState.activeProfileId = existing.id;
      setStatus(`Updated profile "${existing.name}".`);
    } else {
      const profile = {
        id: generateProfileId(requestedName, appState.profiles),
        name: requestedName,
        settings
      };
      appState.profiles.push(profile);
      appState.activeProfileId = profile.id;
      setStatus(`Saved profile "${profile.name}".`);
    }

    await persistState();
    renderProfiles();
    applySettingsToForm(getActiveProfile().settings);
    syncProfileUiState();
    refs.profileName.value = "";
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    refs.saveProfileBtn.disabled = false;
  }
}

async function onDeleteProfileClicked() {
  refs.deleteProfileBtn.disabled = true;

  try {
    const active = getActiveProfile();
    if (active.id === DEFAULT_PROFILE_ID || appState.profiles.length <= 1) {
      throw new Error("Default profile cannot be deleted.");
    }

    appState.profiles = appState.profiles.filter((profile) => profile.id !== active.id);
    appState.activeProfileId = appState.profiles[0].id;
    await persistState();
    renderProfiles();
    applySettingsToForm(getActiveProfile().settings);
    setStatus(`Deleted profile "${active.name}".`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    syncProfileUiState();
  }
}

async function onSaveClicked() {
  refs.saveBtn.disabled = true;

  try {
    const settings = collectSettingsFromForm();
    setActiveProfileSettings(settings);
    await persistState();
    setStatus(`Saved "${getActiveProfile().name}" settings.`);
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
    setActiveProfileSettings(settings);
    await persistState();

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

async function onUndoClicked() {
  refs.undoBtn.disabled = true;

  try {
    const activeTab = await getActiveTab();
    if (!activeTab || !activeTab.id) {
      throw new Error("No active tab found.");
    }
    if (isRestrictedUrl(activeTab.url)) {
      throw new Error("This page does not allow extension scripts.");
    }

    await executeScript(activeTab.id, ["content.js"]);
    const response = await sendTabMessage(activeTab.id, { action: "undoFill" });
    if (!response || !response.ok) {
      throw new Error(response?.error || "Undo failed.");
    }

    const result = response.result || {};
    if (!result.restored && !result.skipped && !result.warnings) {
      setStatus("Nothing to undo.");
      return;
    }

    const parts = [];
    if (result.restored) {
      parts.push(`restored ${result.restored}`);
    }
    if (result.skipped) {
      parts.push(`skipped ${result.skipped}`);
    }
    if (result.warnings) {
      parts.push(`${result.warnings} warnings`);
    }

    setStatus(`Undo: ${parts.join(", ")}`, false);
  } catch (error) {
    setStatus(`Undo failed: ${error.message}`, true);
  } finally {
    refs.undoBtn.disabled = false;
  }
}

function isRestrictedUrl(url = "") {
  return /^(chrome|brave|edge|about):\/\//i.test(url);
}

function setActiveProfileSettings(rawSettings) {
  const active = getActiveProfile();
  active.settings = normalizeSettings(rawSettings);
}

function getActiveProfile() {
  return (
    appState.profiles.find((profile) => profile.id === appState.activeProfileId) ||
    appState.profiles[0] || {
      id: DEFAULT_PROFILE_ID,
      name: "Default",
      settings: normalizeSettings(DEFAULT_SETTINGS)
    }
  );
}

function collectSettingsFromForm() {
  const rules = parseRulesJson(refs.rulesJson.value);

  return normalizeSettings({
    preserveFilled: refs.preserveFilled.checked,
    onlyVisible: refs.onlyVisible.checked,
    shortcut: {
      clickCount: parseOptionalNumber(refs.shortcutClickCount.value)
    },
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
}

function parseRulesJson(source) {
  if (!source.trim()) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
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

  merged.shortcut.clickCount = merged.shortcut.clickCount === 3 ? 3 : 2;

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

function normalizeState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const rawProfiles = Array.isArray(source.profiles) ? source.profiles : [];
  const seenIds = new Set();
  const profiles = [];

  for (const rawProfile of rawProfiles) {
    if (!rawProfile || typeof rawProfile !== "object") {
      continue;
    }

    const normalizedName = normalizeProfileName(rawProfile.name, `Profile ${profiles.length + 1}`);
    const baseId = normalizeProfileId(rawProfile.id || normalizedName || `profile-${profiles.length + 1}`);
    const id = ensureUniqueProfileId(baseId || `profile-${profiles.length + 1}`, seenIds);

    seenIds.add(id);
    profiles.push({
      id,
      name: normalizedName,
      settings: normalizeSettings(rawProfile.settings)
    });
  }

  if (!profiles.length) {
    profiles.push({
      id: DEFAULT_PROFILE_ID,
      name: "Default",
      settings: normalizeSettings(DEFAULT_SETTINGS)
    });
  }

  if (!profiles.some((profile) => profile.id === DEFAULT_PROFILE_ID)) {
    profiles.unshift({
      id: DEFAULT_PROFILE_ID,
      name: "Default",
      settings: normalizeSettings(DEFAULT_SETTINGS)
    });
  }

  const desiredId = String(source.activeProfileId || DEFAULT_PROFILE_ID);
  const activeProfileId = profiles.some((profile) => profile.id === desiredId) ? desiredId : profiles[0].id;

  return { activeProfileId, profiles };
}

function normalizeProfileId(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProfileName(value, fallback) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function ensureUniqueProfileId(baseId, usedIds) {
  let id = baseId;
  let counter = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${counter}`;
    counter += 1;
  }

  return id;
}

function generateProfileId(name, profiles) {
  const usedIds = new Set(profiles.map((profile) => profile.id));
  const baseId = normalizeProfileId(name) || "profile";
  return ensureUniqueProfileId(baseId, usedIds);
}

async function loadState() {
  const storedState = await storageGet(STORAGE_KEY_STATE);
  if (storedState && typeof storedState === "object") {
    if (Array.isArray(storedState.profiles)) {
      return normalizeState(storedState);
    }

    if ("preserveFilled" in storedState || "rules" in storedState) {
      return normalizeState({
        activeProfileId: DEFAULT_PROFILE_ID,
        profiles: [
          {
            id: DEFAULT_PROFILE_ID,
            name: "Default",
            settings: storedState
          }
        ]
      });
    }

    return normalizeState(storedState);
  }

  const legacySettings = await storageGet(STORAGE_KEY_SETTINGS);
  if (legacySettings && typeof legacySettings === "object") {
    return normalizeState({
      activeProfileId: DEFAULT_PROFILE_ID,
      profiles: [
        {
          id: DEFAULT_PROFILE_ID,
          name: "Default",
          settings: legacySettings
        }
      ]
    });
  }

  return normalizeState(DEFAULT_STATE);
}

async function persistState() {
  appState = normalizeState(appState);
  const active = getActiveProfile();

  await storageSetMany({
    [STORAGE_KEY_STATE]: appState,
    [STORAGE_KEY_SETTINGS]: active.settings
  });
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

function storageSetMany(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
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
