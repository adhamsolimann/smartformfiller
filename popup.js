const STORAGE_KEY_SETTINGS = "smartFormFillerSettings";
const STORAGE_KEY_STATE = "smartFormFillerState";
const STORAGE_KEY_UI_STATE = "smartFormFillerUiState";
const TAB_VIEW_PARAM_KEY = "view";
const TAB_VIEW_PARAM_VALUE = "tab";
const DEFAULT_PROFILE_ID = "default";
const FILE_TYPES = ["auto", "pdf", "jpg", "png", "docx"];

const DEFAULT_SETTINGS = {
  enabled: true,
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

const DEFAULT_UI_STATE = {
  sections: {
    profiles: true,
    behavior: false,
    text: false,
    numbers: false,
    dates: false,
    uploads: false,
    ruleBuilder: true,
    advancedJson: false
  }
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
let uiState = clone(DEFAULT_UI_STATE);
let currentRules = [];
let editingRuleIndex = -1;
let applyingUiState = false;
let extensionEnabledUi = true;

document.addEventListener("DOMContentLoaded", initializePopup);

async function initializePopup() {
  bindElements();
  applyViewModeClass();
  bindEvents();
  clearRuleForm(false);
  await loadUiState();
  applyUiStateToSections();

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
  refs.extensionEnabledBtn = document.getElementById("extensionEnabledBtn");

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

  refs.ruleSelector = document.getElementById("ruleSelector");
  refs.ruleTypeMatch = document.getElementById("ruleTypeMatch");
  refs.ruleNames = document.getElementById("ruleNames");
  refs.ruleKeywords = document.getElementById("ruleKeywords");
  refs.ruleRequired = document.getElementById("ruleRequired");
  refs.ruleConstraintKind = document.getElementById("ruleConstraintKind");
  refs.ruleDateFields = document.getElementById("ruleDateFields");
  refs.ruleNumberFields = document.getElementById("ruleNumberFields");
  refs.ruleFileFields = document.getElementById("ruleFileFields");
  refs.ruleCheckboxFields = document.getElementById("ruleCheckboxFields");
  refs.ruleSelectFields = document.getElementById("ruleSelectFields");
  refs.ruleFixedFields = document.getElementById("ruleFixedFields");
  refs.ruleDateMode = document.getElementById("ruleDateMode");
  refs.ruleDateMinDays = document.getElementById("ruleDateMinDays");
  refs.ruleDateMaxDays = document.getElementById("ruleDateMaxDays");
  refs.ruleNumberMode = document.getElementById("ruleNumberMode");
  refs.ruleNumberMin = document.getElementById("ruleNumberMin");
  refs.ruleNumberMax = document.getElementById("ruleNumberMax");
  refs.ruleFileType = document.getElementById("ruleFileType");
  refs.ruleFileMinKB = document.getElementById("ruleFileMinKB");
  refs.ruleFileMaxKB = document.getElementById("ruleFileMaxKB");
  refs.ruleFileMime = document.getElementById("ruleFileMime");
  refs.ruleFileExtension = document.getElementById("ruleFileExtension");
  refs.ruleCheckboxChecked = document.getElementById("ruleCheckboxChecked");
  refs.ruleSelectPrefer = document.getElementById("ruleSelectPrefer");
  refs.ruleFixedValue = document.getElementById("ruleFixedValue");
  refs.addRuleBtn = document.getElementById("addRuleBtn");
  refs.clearRuleFormBtn = document.getElementById("clearRuleFormBtn");
  refs.clearAllRulesBtn = document.getElementById("clearAllRulesBtn");
  refs.rulesEmpty = document.getElementById("rulesEmpty");
  refs.rulesList = document.getElementById("rulesList");
  refs.rulesCountBadge = document.getElementById("rulesCountBadge");
  refs.applyJsonRulesBtn = document.getElementById("applyJsonRulesBtn");
  refs.rulesJson = document.getElementById("rulesJson");
  refs.rulesJson.placeholder = JSON.stringify(RULES_TEMPLATE, null, 2);
  refs.collapsibleSections = Array.from(document.querySelectorAll(".section.collapsible[data-section-id]"));

  refs.saveBtn = document.getElementById("saveBtn");
  refs.fillBtn = document.getElementById("fillBtn");
  refs.undoBtn = document.getElementById("undoBtn");
  refs.openInTabBtn = document.getElementById("openInTabBtn");
  refs.status = document.getElementById("status");
}

function bindEvents() {
  refs.profileSelect.addEventListener("change", onProfileSelected);
  refs.saveProfileBtn.addEventListener("click", onSaveProfileClicked);
  refs.deleteProfileBtn.addEventListener("click", onDeleteProfileClicked);

  refs.ruleConstraintKind.addEventListener("change", onRuleConstraintKindChanged);
  refs.addRuleBtn.addEventListener("click", onAddRuleClicked);
  refs.clearRuleFormBtn.addEventListener("click", () => clearRuleForm(true));
  refs.clearAllRulesBtn.addEventListener("click", onClearAllRulesClicked);
  refs.applyJsonRulesBtn.addEventListener("click", onApplyJsonRulesClicked);
  refs.rulesList.addEventListener("click", onRulesListClicked);

  refs.saveBtn.addEventListener("click", onSaveClicked);
  refs.fillBtn.addEventListener("click", onFillClicked);
  refs.undoBtn.addEventListener("click", onUndoClicked);
  if (refs.extensionEnabledBtn) {
    refs.extensionEnabledBtn.addEventListener("click", onExtensionEnabledClicked);
  }
  if (refs.openInTabBtn) {
    refs.openInTabBtn.addEventListener("click", onOpenInTabClicked);
  }
  for (const section of refs.collapsibleSections) {
    section.addEventListener("toggle", onCollapsibleSectionToggled);
  }
}

function applyViewModeClass() {
  const tabView = isTabViewMode();
  document.body.classList.toggle("tab-mode", tabView);
  if (refs.openInTabBtn) {
    refs.openInTabBtn.hidden = tabView;
  }
}

function isTabViewMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(TAB_VIEW_PARAM_KEY) === TAB_VIEW_PARAM_VALUE;
  } catch {
    return false;
  }
}

async function onOpenInTabClicked() {
  if (!refs.openInTabBtn) {
    return;
  }

  refs.openInTabBtn.disabled = true;
  try {
    await createTab(getTabViewUrl());
    setStatus("Opened full view in new tab.");
  } catch (error) {
    setStatus(`Failed to open tab view: ${error.message}`, true);
  } finally {
    refs.openInTabBtn.disabled = false;
  }
}

function getTabViewUrl() {
  const url = new URL(chrome.runtime.getURL("popup.html"));
  url.searchParams.set(TAB_VIEW_PARAM_KEY, TAB_VIEW_PARAM_VALUE);
  return url.toString();
}

function setExtensionEnabledUi(enabled) {
  extensionEnabledUi = Boolean(enabled);
  if (!refs.extensionEnabledBtn) {
    return;
  }

  refs.extensionEnabledBtn.textContent = extensionEnabledUi ? "On" : "Off";
  refs.extensionEnabledBtn.classList.toggle("is-off", !extensionEnabledUi);
  refs.extensionEnabledBtn.setAttribute("aria-pressed", extensionEnabledUi ? "true" : "false");
  refs.extensionEnabledBtn.title = extensionEnabledUi ? "Extension is on" : "Extension is off";
}

async function onExtensionEnabledClicked() {
  if (!refs.extensionEnabledBtn) {
    return;
  }

  const nextEnabled = !extensionEnabledUi;
  setExtensionEnabledUi(nextEnabled);
  refs.extensionEnabledBtn.disabled = true;

  try {
    const active = getActiveProfile();
    const normalized = normalizeSettings(active.settings);
    normalized.enabled = nextEnabled;
    active.settings = normalized;
    await persistState();
    setStatus(nextEnabled ? "Extension turned on." : "Extension turned off.");
  } catch (error) {
    setExtensionEnabledUi(!nextEnabled);
    setStatus(`Failed to update extension state: ${error.message}`, true);
  } finally {
    refs.extensionEnabledBtn.disabled = false;
  }
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

  setExtensionEnabledUi(settings.enabled);
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

  setRules(settings.rules, true);
  clearRuleForm(false);
}

function syncProfileUiState() {
  const active = getActiveProfile();
  const isProtected = active.id === DEFAULT_PROFILE_ID || appState.profiles.length <= 1;
  refs.deleteProfileBtn.disabled = isProtected;
}

function applyUiStateToSections() {
  if (!Array.isArray(refs.collapsibleSections) || !refs.collapsibleSections.length) {
    return;
  }

  applyingUiState = true;
  try {
    for (const section of refs.collapsibleSections) {
      const sectionId = section.dataset.sectionId;
      if (!sectionId) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(uiState.sections, sectionId)) {
        section.open = Boolean(uiState.sections[sectionId]);
      }
    }
  } finally {
    applyingUiState = false;
  }
}

async function loadUiState() {
  try {
    const stored = await storageGet(STORAGE_KEY_UI_STATE);
    uiState = normalizeUiState(stored);
  } catch {
    uiState = normalizeUiState(DEFAULT_UI_STATE);
  }
}

function normalizeUiState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const merged = deepMerge(clone(DEFAULT_UI_STATE), source);
  const sections = {};

  for (const [sectionId, fallback] of Object.entries(DEFAULT_UI_STATE.sections)) {
    sections[sectionId] = Boolean(
      merged.sections && Object.prototype.hasOwnProperty.call(merged.sections, sectionId)
        ? merged.sections[sectionId]
        : fallback
    );
  }

  return { sections };
}

function onCollapsibleSectionToggled(event) {
  if (applyingUiState) {
    return;
  }

  const section = event.currentTarget;
  if (!(section instanceof HTMLDetailsElement)) {
    return;
  }

  const sectionId = section.dataset.sectionId;
  if (!sectionId) {
    return;
  }

  uiState.sections[sectionId] = section.open;
  void persistUiState();
}

async function persistUiState() {
  try {
    await storageSetMany({ [STORAGE_KEY_UI_STATE]: uiState });
  } catch {
    // Ignore non-critical UI state persistence errors.
  }
}

function onRuleConstraintKindChanged() {
  updateRuleConstraintFieldsVisibility(refs.ruleConstraintKind.value);
}

function updateRuleConstraintFieldsVisibility(kind) {
  const sections = [
    ["date", refs.ruleDateFields],
    ["number", refs.ruleNumberFields],
    ["file", refs.ruleFileFields],
    ["checkbox", refs.ruleCheckboxFields],
    ["select", refs.ruleSelectFields],
    ["fixed", refs.ruleFixedFields]
  ];

  for (const [sectionKind, node] of sections) {
    if (!node) {
      continue;
    }
    node.classList.toggle("hidden", sectionKind !== kind);
  }
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

function onAddRuleClicked() {
  try {
    const rule = buildRuleFromForm();
    const nextRules = [...currentRules];

    if (editingRuleIndex >= 0 && editingRuleIndex < nextRules.length) {
      nextRules[editingRuleIndex] = rule;
      setStatus(`Updated rule #${editingRuleIndex + 1}.`);
    } else {
      nextRules.push(rule);
      setStatus(`Added rule #${nextRules.length}.`);
    }

    setRules(nextRules, true);
    clearRuleForm(false);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function onClearAllRulesClicked() {
  setRules([], true);
  clearRuleForm(false);
  setStatus("All rules cleared.");
}

function onApplyJsonRulesClicked() {
  try {
    const parsed = parseRulesJson(refs.rulesJson.value);
    setRules(parsed, true);
    clearRuleForm(false);
    setStatus(`Loaded ${currentRules.length} rule${currentRules.length === 1 ? "" : "s"} from JSON.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function onRulesListClicked(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action) {
    return;
  }

  const item = target.closest(".rule-item");
  if (!item) {
    return;
  }

  const index = Number(item.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= currentRules.length) {
    return;
  }

  if (action === "remove") {
    const nextRules = currentRules.filter((_, i) => i !== index);
    setRules(nextRules, true);
    clearRuleForm(false);
    setStatus(`Removed rule #${index + 1}.`);
    return;
  }

  if (action === "edit") {
    loadRuleIntoBuilder(index);
  }
}

function loadRuleIntoBuilder(index) {
  const rule = currentRules[index];
  if (!rule) {
    return;
  }

  editingRuleIndex = index;
  refs.addRuleBtn.textContent = "Update Rule";
  refs.clearRuleFormBtn.textContent = "Cancel Edit";

  refs.ruleSelector.value = rule.match?.selector || "";
  refs.ruleTypeMatch.value = Array.isArray(rule.match?.types) && rule.match.types.length ? String(rule.match.types[0]) : "any";
  refs.ruleNames.value = arrayToCsv(rule.match?.names);
  refs.ruleKeywords.value = arrayToCsv(rule.match?.keywords);
  refs.ruleRequired.value =
    typeof rule.match?.required === "boolean" ? String(rule.match.required) : "any";

  if (rule.constraints?.date) {
    refs.ruleConstraintKind.value = "date";
    refs.ruleDateMode.value = rule.constraints.date.mode || "any";
    refs.ruleDateMinDays.value = toInputValue(rule.constraints.date.minDaysFromToday);
    refs.ruleDateMaxDays.value = toInputValue(rule.constraints.date.maxDaysFromToday);
  } else if (rule.constraints?.number) {
    refs.ruleConstraintKind.value = "number";
    refs.ruleNumberMode.value = rule.constraints.number.mode || "any";
    refs.ruleNumberMin.value = toInputValue(rule.constraints.number.min);
    refs.ruleNumberMax.value = toInputValue(rule.constraints.number.max);
  } else if (rule.constraints?.file) {
    refs.ruleConstraintKind.value = "file";
    refs.ruleFileType.value = FILE_TYPES.includes(rule.constraints.file.preferredType)
      ? rule.constraints.file.preferredType
      : "auto";
    refs.ruleFileMinKB.value = toInputValue(rule.constraints.file.minSizeKB);
    refs.ruleFileMaxKB.value = toInputValue(rule.constraints.file.maxSizeKB);
    refs.ruleFileMime.value = rule.constraints.file.mime || "";
    refs.ruleFileExtension.value = rule.constraints.file.extension || "";
  } else if (rule.constraints?.checkbox && typeof rule.constraints.checkbox === "object") {
    refs.ruleConstraintKind.value = "checkbox";
    refs.ruleCheckboxChecked.value = rule.constraints.checkbox.checked ? "true" : "false";
  } else if (rule.constraints?.select && typeof rule.constraints.select === "object") {
    refs.ruleConstraintKind.value = "select";
    refs.ruleSelectPrefer.value = rule.constraints.select.preferNonPlaceholder === false ? "any" : "nonPlaceholder";
  } else {
    refs.ruleConstraintKind.value = "fixed";
    refs.ruleFixedValue.value = rule.constraints?.fixedValue === undefined ? "" : String(rule.constraints.fixedValue);
  }

  updateRuleConstraintFieldsVisibility(refs.ruleConstraintKind.value);
  setStatus(`Editing rule #${index + 1}.`);
}

function buildRuleFromForm() {
  const match = {};
  const selector = refs.ruleSelector.value.trim();
  const type = refs.ruleTypeMatch.value;
  const names = parseCsv(refs.ruleNames.value);
  const keywords = parseCsv(refs.ruleKeywords.value);
  const required = refs.ruleRequired.value;

  if (selector) {
    match.selector = selector;
  }
  if (type !== "any") {
    match.types = [type];
  }
  if (names.length) {
    match.names = names;
  }
  if (keywords.length) {
    match.keywords = keywords;
  }
  if (required === "true") {
    match.required = true;
  } else if (required === "false") {
    match.required = false;
  }

  if (!Object.keys(match).length) {
    throw new Error("Rule must include at least one matcher (selector, type, names, keywords, or required).");
  }

  const constraints = {};
  const kind = refs.ruleConstraintKind.value;

  if (kind === "date") {
    constraints.date = {
      mode: refs.ruleDateMode.value,
      minDaysFromToday: parseOptionalNumber(refs.ruleDateMinDays.value),
      maxDaysFromToday: parseOptionalNumber(refs.ruleDateMaxDays.value)
    };
  } else if (kind === "number") {
    constraints.number = {
      mode: refs.ruleNumberMode.value,
      min: parseOptionalNumber(refs.ruleNumberMin.value),
      max: parseOptionalNumber(refs.ruleNumberMax.value)
    };
  } else if (kind === "file") {
    constraints.file = {
      enabled: true,
      preferredType: FILE_TYPES.includes(refs.ruleFileType.value) ? refs.ruleFileType.value : "auto",
      minSizeKB: parseOptionalNumber(refs.ruleFileMinKB.value),
      maxSizeKB: parseOptionalNumber(refs.ruleFileMaxKB.value),
      mime: refs.ruleFileMime.value.trim() || undefined,
      extension: refs.ruleFileExtension.value.trim() || undefined
    };
  } else if (kind === "checkbox") {
    constraints.checkbox = {
      checked: refs.ruleCheckboxChecked.value === "true"
    };
  } else if (kind === "select") {
    constraints.select = {
      preferNonPlaceholder: refs.ruleSelectPrefer.value !== "any"
    };
  } else {
    const fixedRaw = refs.ruleFixedValue.value.trim();
    if (!fixedRaw) {
      throw new Error("Fixed Value constraint needs a value.");
    }
    constraints.fixedValue = parseFixedValue(fixedRaw);
  }

  return { match, constraints };
}

function parseFixedValue(raw) {
  const lower = raw.toLowerCase();
  if (lower === "true") {
    return true;
  }
  if (lower === "false") {
    return false;
  }
  if (lower === "null") {
    return null;
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }
  return raw;
}

function renderRulesList() {
  refs.rulesList.innerHTML = "";
  refs.rulesEmpty.classList.toggle("hidden", currentRules.length > 0);
  if (refs.clearAllRulesBtn) {
    refs.clearAllRulesBtn.disabled = currentRules.length === 0;
  }
  if (refs.rulesCountBadge) {
    refs.rulesCountBadge.textContent = `${currentRules.length} rule${currentRules.length === 1 ? "" : "s"}`;
  }

  const fragment = document.createDocumentFragment();

  currentRules.forEach((rule, index) => {
    const li = document.createElement("li");
    li.className = "rule-item";
    li.dataset.index = String(index);

    const title = document.createElement("p");
    title.className = "rule-item-title";
    title.textContent = `Rule #${index + 1}: ${summarizeConstraint(rule.constraints)}`;

    const subtitle = document.createElement("p");
    subtitle.className = "rule-item-subtitle";
    subtitle.textContent = summarizeMatch(rule.match);

    const actions = document.createElement("div");
    actions.className = "rule-item-actions";
    actions.innerHTML = `
      <button class="secondary compact" data-action="edit">Edit</button>
      <button class="secondary compact danger" data-action="remove">Remove</button>
    `;

    li.appendChild(title);
    li.appendChild(subtitle);
    li.appendChild(actions);
    fragment.appendChild(li);
  });

  refs.rulesList.appendChild(fragment);
}

function summarizeMatch(match) {
  if (!match || typeof match !== "object") {
    return "No matcher";
  }

  const parts = [];
  if (match.selector) {
    parts.push(`selector=${match.selector}`);
  }
  if (Array.isArray(match.types) && match.types.length) {
    parts.push(`type=${match.types.join(",")}`);
  }
  if (Array.isArray(match.names) && match.names.length) {
    parts.push(`names=${match.names.join(",")}`);
  }
  if (Array.isArray(match.keywords) && match.keywords.length) {
    parts.push(`keywords=${match.keywords.join(",")}`);
  }
  if (typeof match.required === "boolean") {
    parts.push(`required=${match.required}`);
  }

  return parts.length ? parts.join(" | ") : "matcher: any";
}

function summarizeConstraint(constraints) {
  if (!constraints || typeof constraints !== "object") {
    return "constraint";
  }
  if (constraints.date) {
    return `Date (${constraints.date.mode || "any"})`;
  }
  if (constraints.number) {
    return `Number (${constraints.number.mode || "any"})`;
  }
  if (constraints.file) {
    return `File (${constraints.file.preferredType || "auto"})`;
  }
  if (constraints.checkbox) {
    return `Checkbox (${constraints.checkbox.checked ? "checked" : "unchecked"})`;
  }
  if (constraints.select) {
    return `Select (${constraints.select.preferNonPlaceholder === false ? "any option" : "non-placeholder"})`;
  }
  if (Object.prototype.hasOwnProperty.call(constraints, "fixedValue")) {
    return `Fixed (${String(constraints.fixedValue)})`;
  }
  return "Custom";
}

function clearRuleForm(updateStatus) {
  editingRuleIndex = -1;
  refs.addRuleBtn.textContent = "Add Rule";
  refs.clearRuleFormBtn.textContent = "Clear Form";

  refs.ruleSelector.value = "";
  refs.ruleTypeMatch.value = "any";
  refs.ruleNames.value = "";
  refs.ruleKeywords.value = "";
  refs.ruleRequired.value = "any";
  refs.ruleConstraintKind.value = "date";

  refs.ruleDateMode.value = "any";
  refs.ruleDateMinDays.value = "";
  refs.ruleDateMaxDays.value = "";

  refs.ruleNumberMode.value = "any";
  refs.ruleNumberMin.value = "";
  refs.ruleNumberMax.value = "";

  refs.ruleFileType.value = "auto";
  refs.ruleFileMinKB.value = "";
  refs.ruleFileMaxKB.value = "";
  refs.ruleFileMime.value = "";
  refs.ruleFileExtension.value = "";
  refs.ruleCheckboxChecked.value = "true";
  refs.ruleSelectPrefer.value = "nonPlaceholder";

  refs.ruleFixedValue.value = "";
  updateRuleConstraintFieldsVisibility("date");

  if (updateStatus) {
    setStatus("Rule form cleared.");
  }
}

function setRules(rules, syncJson) {
  currentRules = sanitizeRulesArray(rules);
  renderRulesList();

  if (syncJson) {
    refs.rulesJson.value = JSON.stringify(currentRules, null, 2);
  }
}

function sanitizeRulesArray(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules
    .filter((rule) => rule && typeof rule === "object")
    .map((rule) => clone(rule));
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

    if (!settings.enabled) {
      setStatus("Extension is off. Turn it on to fill forms.");
      return;
    }

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
    if (result.disabled) {
      setStatus("Extension is off. Turn it on to fill forms.");
      return;
    }
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
  const parsedRules = parseRulesJson(refs.rulesJson.value);
  setRules(parsedRules, true);

  return normalizeSettings({
    enabled: extensionEnabledUi,
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
    rules: currentRules
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

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToCsv(value) {
  if (!Array.isArray(value)) {
    return "";
  }
  return value.join(", ");
}

function toInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
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
  merged.enabled = merged.enabled !== false;

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
  merged.rules = sanitizeRulesArray(merged.rules);

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

function createTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
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
