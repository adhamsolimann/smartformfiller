(() => {
  if (window.__smartFormFillerInitialized) {
    return;
  }
  window.__smartFormFillerInitialized = true;

  const STORAGE_KEY = "smartFormFillerSettings";
  const STORAGE_STATE_KEY = "smartFormFillerState";
  const SHORTCUT_CLICK_COOLDOWN_MS = 1200;
  const SHORTCUT_TRIPLE_CLICK_WINDOW_MS = 700;

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
      maxSizeKB: 64,
      count: 1
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

  const BLOCKED_INPUT_TYPES = new Set(["hidden", "button", "submit", "reset", "image"]);
  const DATE_INPUT_TYPES = new Set(["date", "datetime-local", "month", "week", "time"]);
  const FILE_UPLOAD_TYPES = new Set(["auto", "pdf", "jpg", "png", "docx"]);
  const FILE_TYPE_PRESETS = {
    pdf: { mime: "application/pdf", extension: ".pdf" },
    jpg: { mime: "image/jpeg", extension: ".jpg" },
    png: { mime: "image/png", extension: ".png" },
    docx: {
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: ".docx"
    }
  };
  const EXT_TO_MIME = {
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
    ".xml": "application/xml",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".zip": "application/zip"
  };
  const MIME_TO_EXT = {
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/json": ".json",
    "application/xml": ".xml",
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "audio/mpeg": ".mp3",
    "video/mp4": ".mp4",
    "application/zip": ".zip"
  };

  const FIRST_NAMES = [
    "Avery",
    "Jordan",
    "Riley",
    "Morgan",
    "Quinn",
    "Taylor",
    "Casey",
    "Sydney",
    "Emerson",
    "Hayden"
  ];

  const LAST_NAMES = [
    "Parker",
    "Bennett",
    "Rivera",
    "Patel",
    "Kim",
    "Singh",
    "Murphy",
    "Lopez",
    "Nguyen",
    "Morgan"
  ];

  const COMPANIES = [
    "Northstar Labs",
    "Summit Dynamics",
    "Apex Systems",
    "Blue Oak Studio",
    "Harbor Cloud",
    "Brightline Works"
  ];

  const STREETS = [
    "Maple Street",
    "Cedar Avenue",
    "Grand Boulevard",
    "Harbor Lane",
    "River Road",
    "Pine Court"
  ];

  const CITIES = ["Berlin", "Munich", "Hamburg", "Austin", "Seattle", "Boston", "Denver", "Portland"];
  const COUNTRIES = ["Germany", "United States", "United Kingdom", "Netherlands", "Canada"];
  const STATES = ["CA", "NY", "TX", "WA", "MA", "FL", "IL", "CO"];
  const WORDS = [
    "pilot",
    "alpha",
    "beta",
    "release",
    "portal",
    "platform",
    "insight",
    "project",
    "delta",
    "sprint",
    "report",
    "signal",
    "vector",
    "scope",
    "launch",
    "horizon",
    "network",
    "feature"
  ];

  const SEMANTIC_RULES = [
    { type: "firstName", regex: /(first.?name|given.?name|fname)/i },
    { type: "lastName", regex: /(last.?name|surname|family.?name|lname)/i },
    { type: "fullName", regex: /(full.?name|contact.?name|your.?name)/i },
    { type: "birthDate", regex: /(date.?of.?birth|dob|birthday|birth.?date)/i },
    { type: "gender", regex: /(gender|sex)/i },
    { type: "email", regex: /(e-?mail)/i },
    { type: "phone", regex: /(phone|mobile|tel|telephone)/i },
    { type: "company", regex: /(company|organization|organisation|employer|business)/i },
    { type: "address", regex: /(address|street|addr1|addr2)/i },
    { type: "city", regex: /(city|town)/i },
    { type: "state", regex: /(state|province|region)/i },
    { type: "postalCode", regex: /(zip|postal|postcode)/i },
    { type: "country", regex: /(country|nation)/i },
    { type: "username", regex: /(user.?name|login)/i },
    { type: "password", regex: /(password|passcode|pin)/i },
    { type: "url", regex: /(website|url|homepage|link)/i },
    { type: "date", regex: /(date|deadline|start|end|eta|birthday|birth)/i },
    { type: "time", regex: /(time|slot|hour)/i },
    { type: "price", regex: /(price|cost|budget|amount|revenue)/i },
    { type: "quantity", regex: /(qty|quantity|count|volume|number.?of)/i },
    { type: "title", regex: /(title|subject|headline|topic)/i },
    { type: "description", regex: /(description|details|notes|comment|message)/i },
    { type: "id", regex: /(id|identifier|reference|ticket|code)/i }
  ];

  let shortcutLockedUntil = 0;
  let currentShortcutClickCount = 2;
  let recentShortcutClicks = [];
  let lastFillSnapshot = null;
  let activeFillContext = null;

  window.addEventListener("click", onDocumentClick, true);
  window.addEventListener("dblclick", onDocumentDoubleClick, true);
  chrome.storage.onChanged.addListener(onStorageChanged);
  void refreshShortcutConfig();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.action === "ping") {
      sendResponse({ ok: true });
      return;
    }

    if (message.action === "undoFill") {
      try {
        const result = undoLastFill();
        sendResponse({ ok: true, result });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Undo failed."
        });
      }
      return;
    }

    if (message.action !== "fillForm") {
      return;
    }

    try {
      const result = fillForm(message.settings || {});
      sendResponse({ ok: true, result });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown form fill error."
      });
    }
  });

  function onDocumentClick(event) {
    if (!event.isTrusted || event.button !== 0) {
      return;
    }
    if (currentShortcutClickCount !== 3) {
      return;
    }

    const now = Date.now();
    if (now < shortcutLockedUntil) {
      return;
    }

    recentShortcutClicks.push(now);
    recentShortcutClicks = recentShortcutClicks.filter((time) => now - time <= SHORTCUT_TRIPLE_CLICK_WINDOW_MS);
    if (recentShortcutClicks.length < 3) {
      return;
    }

    recentShortcutClicks = [];
    shortcutLockedUntil = now + SHORTCUT_CLICK_COOLDOWN_MS;
    void triggerShortcutFill();
  }

  function onDocumentDoubleClick(event) {
    if (!event.isTrusted || event.button !== 0) {
      return;
    }
    if (currentShortcutClickCount !== 2) {
      return;
    }

    const now = Date.now();
    if (now < shortcutLockedUntil) {
      return;
    }

    shortcutLockedUntil = now + SHORTCUT_CLICK_COOLDOWN_MS;
    void triggerShortcutFill();
  }

  async function refreshShortcutConfig() {
    try {
      const settings = await loadStoredSettings();
      updateShortcutClickCount(settings);
    } catch {
      currentShortcutClickCount = 2;
      recentShortcutClicks = [];
    }
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEY]) {
      updateShortcutClickCount(changes[STORAGE_KEY].newValue);
      return;
    }

    if (changes[STORAGE_STATE_KEY]) {
      const settings = extractSettingsFromState(changes[STORAGE_STATE_KEY].newValue);
      if (settings) {
        updateShortcutClickCount(settings);
      }
    }
  }

  function updateShortcutClickCount(settings) {
    currentShortcutClickCount = getShortcutClickCount(settings);
    recentShortcutClicks = [];
  }

  async function triggerShortcutFill() {
    if (!hasFillableFieldsOnPage()) {
      showShortcutStatus("No fillable fields found.");
      return;
    }

    try {
      const storedSettings = await loadStoredSettings();
      const result = fillForm(storedSettings);
      if (result.disabled) {
        showShortcutStatus("Smart Form Filler is off.");
        return;
      }
      showShortcutStatus(`Filled ${result.filled} fields.`);
    } catch (error) {
      showShortcutStatus("Shortcut fill failed.", true);
    }
  }

  function hasFillableFieldsOnPage() {
    const fields = document.querySelectorAll("input, textarea, select");
    for (const field of fields) {
      if (isFillableElement(field)) {
        return true;
      }
    }
    return false;
  }

  function loadStoredSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY, STORAGE_STATE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          resolve(clone(DEFAULT_SETTINGS));
          return;
        }

        const directSettings = result[STORAGE_KEY];
        if (directSettings && typeof directSettings === "object") {
          resolve(directSettings);
          return;
        }

        const extractedFromState = extractSettingsFromState(result[STORAGE_STATE_KEY]);
        if (extractedFromState) {
          resolve(extractedFromState);
          return;
        }

        resolve(clone(DEFAULT_SETTINGS));
      });
    });
  }

  function extractSettingsFromState(rawState) {
    if (!rawState || typeof rawState !== "object") {
      return null;
    }

    if (Array.isArray(rawState.profiles) && rawState.profiles.length) {
      const activeId = String(rawState.activeProfileId || "");
      const activeProfile =
        rawState.profiles.find((profile) => profile && profile.id === activeId) || rawState.profiles[0];
      if (activeProfile && typeof activeProfile.settings === "object") {
        return activeProfile.settings;
      }
    }

    if ("preserveFilled" in rawState || "rules" in rawState) {
      return rawState;
    }

    return null;
  }

  function getShortcutClickCount(rawSettings) {
    const clickCount = Number(rawSettings?.shortcut?.clickCount);
    return clickCount === 3 ? 3 : 2;
  }

  function showShortcutStatus(message, isError = false) {
    const existing = document.getElementById("__smart-form-filler-toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.id = "__smart-form-filler-toast";
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.right = "16px";
    toast.style.bottom = "16px";
    toast.style.zIndex = "2147483647";
    toast.style.padding = "9px 12px";
    toast.style.borderRadius = "9px";
    toast.style.background = isError ? "#8e1f15" : "#0d6b58";
    toast.style.color = "#ffffff";
    toast.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
    toast.style.fontSize = "12px";
    toast.style.boxShadow = "0 10px 24px rgba(0,0,0,0.25)";
    toast.style.pointerEvents = "none";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 140ms ease";
    document.documentElement.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 160);
    }, 1200);
  }

  function fillForm(rawSettings) {
    const settings = normalizeSettings(rawSettings);
    if (!settings.enabled) {
      return { filled: 0, skipped: 0, errors: 0, details: [], disabled: true };
    }

    const candidates = Array.from(document.querySelectorAll("input, textarea, select"));
    lastFillSnapshot = captureFillSnapshot(candidates);
    activeFillContext = buildFillContext();
    const stats = { filled: 0, skipped: 0, errors: 0, details: [] };
    const processedRadioGroups = new Set();

    try {
      for (const el of candidates) {
        if (!isFillableElement(el)) {
          continue;
        }

        const nativeType = getNativeType(el);
        if (nativeType === "radio") {
          const groupKey = getRadioGroupKey(el);
          if (processedRadioGroups.has(groupKey)) {
            continue;
          }
          processedRadioGroups.add(groupKey);

          const radios = getRadioGroup(el).filter((radio) => isFillableElement(radio));
          if (!radios.length) {
            continue;
          }

          if (settings.onlyVisible) {
            const visible = radios.filter((radio) => isElementVisible(radio));
            if (!visible.length) {
              stats.skipped += 1;
              continue;
            }
          }

          if (settings.preserveFilled && radios.some((radio) => radio.checked)) {
            stats.skipped += 1;
            continue;
          }

          try {
            const seed = radios[0];
            const descriptor = describeField(seed);
            const constraints = resolveFieldConstraints(seed, descriptor, settings);
            const target = chooseRadioFromGroup(radios, constraints, settings.onlyVisible, descriptor);
            if (!target) {
              stats.skipped += 1;
              continue;
            }

            const changed = setElementChecked(target, true);
            if (changed) {
              stats.filled += 1;
            } else {
              stats.skipped += 1;
            }
          } catch (error) {
            stats.errors += 1;
            stats.details.push({
              type: "radio",
              id: radios[0]?.id || radios[0]?.name || "",
              error: error instanceof Error ? error.message : "Radio group fill failed."
            });
          }

          continue;
        }

        if (settings.onlyVisible && !isElementVisible(el)) {
          stats.skipped += 1;
          continue;
        }

        if (settings.preserveFilled && hasFieldValue(el)) {
          stats.skipped += 1;
          continue;
        }

        try {
          const descriptor = describeField(el);
          const constraints = resolveFieldConstraints(el, descriptor, settings);
          const changed = fillSingleField(el, descriptor, constraints);
          if (changed) {
            stats.filled += 1;
          } else {
            stats.skipped += 1;
          }
        } catch (error) {
          stats.errors += 1;
          stats.details.push({
            type: nativeType,
            id: el.id || el.name || "",
            error: error instanceof Error ? error.message : "Field fill failed."
          });
        }
      }
    } finally {
      activeFillContext = null;
    }

    return stats;
  }

  function buildFillContext() {
    return {
      birthdayDate: generateBirthdayDateSeed()
    };
  }

  function captureFillSnapshot(elements) {
    const snapshot = [];
    for (const el of elements) {
      if (!isFillableElement(el)) {
        continue;
      }

      const nativeType = getNativeType(el);
      const entry = {
        el,
        snapshotMeta: buildSnapshotMeta(el, nativeType),
        nativeType,
        value: null,
        checked: null,
        multiple: false,
        selectedValues: null,
        fileHadValue: false,
        fileSignature: []
      };

      if (nativeType === "checkbox" || nativeType === "radio") {
        entry.checked = Boolean(el.checked);
      } else if (nativeType === "file") {
        entry.fileHadValue = Boolean(el.files && el.files.length > 0);
        entry.fileSignature = snapshotFileSignature(el.files);
      } else if (el instanceof HTMLSelectElement && el.multiple) {
        entry.multiple = true;
        entry.selectedValues = Array.from(el.selectedOptions).map((option) => option.value);
      } else {
        entry.value = String(el.value ?? "");
      }

      snapshot.push(entry);
    }

    return snapshot;
  }

  function buildSnapshotMeta(el, nativeType) {
    return {
      id: String(el.id || ""),
      name: String(el.getAttribute("name") || ""),
      tag: el.tagName.toLowerCase(),
      nativeType,
      matchIndex: getFieldMatchIndex(el, nativeType)
    };
  }

  function getFieldMatchIndex(el, nativeType) {
    const candidates = queryFieldsForSnapshot(nativeType, String(el.getAttribute("name") || ""), String(el.id || ""));
    if (!candidates.length) {
      return 0;
    }
    const index = candidates.indexOf(el);
    return index >= 0 ? index : 0;
  }

  function queryFieldsForSnapshot(nativeType, name, id) {
    if (id) {
      const escapedId = cssEscape(id);
      if (escapedId) {
        const idEl = document.querySelector(`#${escapedId}`);
        if (idEl) {
          return [idEl];
        }
      }
    }

    const lowerType = String(nativeType || "").toLowerCase();
    if (lowerType === "textarea") {
      if (name) {
        return Array.from(document.querySelectorAll(`textarea[name="${cssEscape(name)}"]`));
      }
      return Array.from(document.querySelectorAll("textarea"));
    }

    if (lowerType === "select") {
      if (name) {
        return Array.from(document.querySelectorAll(`select[name="${cssEscape(name)}"]`));
      }
      return Array.from(document.querySelectorAll("select"));
    }

    const escapedType = cssEscape(lowerType || "text");
    if (name) {
      return Array.from(document.querySelectorAll(`input[type="${escapedType}"][name="${cssEscape(name)}"]`));
    }
    return Array.from(document.querySelectorAll(`input[type="${escapedType}"]`));
  }

  function resolveSnapshotElement(entry) {
    if (!entry || !entry.el) {
      return null;
    }
    if (entry.el.isConnected) {
      return entry.el;
    }

    const meta = entry.snapshotMeta;
    if (!meta || typeof meta !== "object") {
      return null;
    }

    const candidates = queryFieldsForSnapshot(meta.nativeType, meta.name || "", meta.id || "");
    if (!candidates.length) {
      return null;
    }

    const matchIndex = Number(meta.matchIndex);
    if (Number.isInteger(matchIndex) && matchIndex >= 0 && matchIndex < candidates.length) {
      return candidates[matchIndex];
    }
    return candidates[0];
  }

  function undoLastFill() {
    if (!Array.isArray(lastFillSnapshot) || !lastFillSnapshot.length) {
      return { restored: 0, skipped: 0, warnings: 0 };
    }

    const stats = { restored: 0, skipped: 0, warnings: 0 };

    for (const entry of lastFillSnapshot) {
      const outcome = restoreSnapshotEntry(entry);
      if (outcome === "restored") {
        stats.restored += 1;
      } else if (outcome === "warning") {
        stats.warnings += 1;
      } else {
        stats.skipped += 1;
      }
    }

    lastFillSnapshot = null;
    return stats;
  }

  function restoreSnapshotEntry(entry) {
    const el = resolveSnapshotElement(entry);
    if (!entry || !el) {
      return "skipped";
    }
    const nativeType = entry.nativeType;

    if (nativeType === "checkbox" || nativeType === "radio") {
      return setElementChecked(el, Boolean(entry.checked)) ? "restored" : "skipped";
    }

    if (nativeType === "file") {
      const before = Array.isArray(entry.fileSignature) ? entry.fileSignature : [];
      const now = snapshotFileSignature(el.files);
      if (areFileSignaturesEqual(before, now)) {
        return "skipped";
      }

      const cleared = clearFileInput(el);
      if (!cleared) {
        return "warning";
      }

      // If the field had files before fill, browser security prevents restoring them.
      return entry.fileHadValue ? "warning" : "restored";
    }

    if (el instanceof HTMLSelectElement && entry.multiple) {
      const target = new Set(entry.selectedValues || []);
      let changed = false;
      for (const option of el.options) {
        const shouldSelect = target.has(option.value);
        if (option.selected !== shouldSelect) {
          option.selected = shouldSelect;
          changed = true;
        }
      }
      if (changed) {
        triggerFieldEvents(el);
      }
      return changed ? "restored" : "skipped";
    }

    return setElementValue(el, entry.value ?? "") ? "restored" : "skipped";
  }

  function normalizeSettings(raw) {
    const merged = deepMerge(clone(DEFAULT_SETTINGS), raw || {});
    merged.enabled = merged.enabled !== false;

    if (!["any", "positive", "negative"].includes(merged.number?.mode)) {
      merged.number.mode = DEFAULT_SETTINGS.number.mode;
    }
    if (!["any", "future", "past"].includes(merged.date?.mode)) {
      merged.date.mode = DEFAULT_SETTINGS.date.mode;
    }

    merged.shortcut.clickCount = merged.shortcut?.clickCount === 3 ? 3 : 2;

    merged.file.enabled = Boolean(merged.file?.enabled);
    if (!FILE_UPLOAD_TYPES.has(String(merged.file?.preferredType || "").toLowerCase())) {
      merged.file.preferredType = DEFAULT_SETTINGS.file.preferredType;
    } else {
      merged.file.preferredType = String(merged.file.preferredType).toLowerCase();
    }
    merged.file.minSizeKB = coercePositive(merged.file?.minSizeKB, DEFAULT_SETTINGS.file.minSizeKB);
    merged.file.maxSizeKB = coercePositive(merged.file?.maxSizeKB, DEFAULT_SETTINGS.file.maxSizeKB);
    merged.file.count = coercePositive(merged.file?.count, DEFAULT_SETTINGS.file.count);
    if (merged.file.minSizeKB > merged.file.maxSizeKB) {
      merged.file.maxSizeKB = merged.file.minSizeKB;
    }

    merged.text.minLength = coerceNonNegative(merged.text?.minLength, DEFAULT_SETTINGS.text.minLength);
    merged.text.maxLength = coercePositive(merged.text?.maxLength, DEFAULT_SETTINGS.text.maxLength);
    if (merged.text.minLength > merged.text.maxLength) {
      merged.text.maxLength = merged.text.minLength;
    }

    merged.number.min = coerceOptionalNumber(merged.number?.min);
    merged.number.max = coerceOptionalNumber(merged.number?.max);
    merged.date.minDaysFromToday = coerceOptionalInteger(merged.date?.minDaysFromToday);
    merged.date.maxDaysFromToday = coerceOptionalInteger(merged.date?.maxDaysFromToday);
    merged.rules = Array.isArray(merged.rules) ? merged.rules : [];

    return merged;
  }

  function fillSingleField(el, descriptor, constraints) {
    const nativeType = descriptor.nativeType;
    const fixed = constraints.fixedValue;

    if (nativeType === "file") {
      return fillFileInput(el, constraints.file);
    }

    if (fixed !== null && fixed !== undefined) {
      return applyFixedValue(el, descriptor, fixed);
    }

    if (el instanceof HTMLSelectElement) {
      const selectValue = generateSelectValue(el, constraints, descriptor);
      return setElementValue(el, selectValue);
    }

    if (nativeType === "checkbox") {
      const explicit = constraints.checkbox?.checked;
      const shouldCheck = typeof explicit === "boolean" ? explicit : el.required ? true : randomUnit() > 0.25;
      return setElementChecked(el, shouldCheck);
    }

    if (DATE_INPUT_TYPES.has(nativeType)) {
      const dateValue = generateDateValue(el, nativeType, constraints.date, descriptor);
      return setElementValue(el, dateValue);
    }

    if (nativeType === "number" || nativeType === "range") {
      const numberValue = generateNumberValue(el, constraints.number, descriptor);
      return setElementValue(el, numberValue);
    }

    if (nativeType === "color") {
      return setElementValue(el, generateColorValue());
    }

    if (nativeType === "email") {
      return setElementValue(el, generateEmailValue(el, constraints.text));
    }

    if (nativeType === "tel") {
      return setElementValue(el, generatePhoneValue());
    }

    if (nativeType === "url") {
      return setElementValue(el, generateUrlValue(descriptor));
    }

    if (nativeType === "password") {
      const { min, max } = resolveTextBounds(el, constraints.text);
      const password = fitToLength(generatePasswordValue(), min, max);
      return setElementValue(el, password);
    }

    const textValue = generateTextValue(el, descriptor, constraints.text);
    return setElementValue(el, textValue);
  }

  function applyFixedValue(el, descriptor, fixedValue) {
    if (descriptor.nativeType === "checkbox") {
      return setElementChecked(el, Boolean(fixedValue));
    }

    if (descriptor.nativeType === "radio") {
      if (typeof fixedValue === "boolean") {
        return setElementChecked(el, fixedValue);
      }
      if (String(el.value) === String(fixedValue)) {
        return setElementChecked(el, true);
      }
      return false;
    }

    return setElementValue(el, fixedValue);
  }

  function chooseRadioFromGroup(radios, constraints, onlyVisible, descriptor) {
    const candidates = onlyVisible ? radios.filter((radio) => isElementVisible(radio)) : radios;
    if (!candidates.length) {
      return null;
    }

    const fixed = constraints.fixedValue;
    if (fixed !== null && fixed !== undefined) {
      if (typeof fixed === "boolean") {
        return fixed ? candidates[0] : null;
      }

      const target = String(fixed).toLowerCase();
      const matched = candidates.find((radio) => {
        const label = getLabelText(radio).toLowerCase();
        return (
          String(radio.value).toLowerCase() === target ||
          String(radio.id).toLowerCase() === target ||
          label.includes(target)
        );
      });
      if (matched) {
        return matched;
      }
    }

    if (descriptor?.semanticType === "gender") {
      const genderMatched = chooseGenderOptionFromInputs(candidates);
      if (genderMatched) {
        return genderMatched;
      }
    }

    return pick(candidates);
  }

  function resolveFieldConstraints(el, descriptor, settings) {
    const resolved = {
      fixedValue: null,
      file: { ...settings.file },
      text: { ...settings.text },
      number: { ...settings.number },
      date: { ...settings.date },
      checkbox: {
        checked: null
      },
      select: {
        preferNonPlaceholder: true
      }
    };

    for (const rule of settings.rules) {
      const normalizedRule = normalizeRule(rule);
      if (!normalizedRule) {
        continue;
      }
      if (!ruleMatches(el, descriptor, normalizedRule.match)) {
        continue;
      }
      deepMerge(resolved, normalizedRule.constraints);
    }

    return resolved;
  }

  function normalizeRule(rule) {
    if (!rule || typeof rule !== "object") {
      return null;
    }

    const match = rule.match && typeof rule.match === "object" ? rule.match : {};
    const constraints = rule.constraints && typeof rule.constraints === "object" ? rule.constraints : {};

    if (rule.selector && !match.selector) {
      match.selector = rule.selector;
    }
    if (rule.types && !match.types) {
      match.types = rule.types;
    }
    if (rule.keywords && !match.keywords) {
      match.keywords = rule.keywords;
    }
    if (rule.names && !match.names) {
      match.names = rule.names;
    }

    if (rule.fixedValue !== undefined && constraints.fixedValue === undefined) {
      constraints.fixedValue = rule.fixedValue;
    }

    return { match, constraints };
  }

  function ruleMatches(el, descriptor, match) {
    if (!match || typeof match !== "object") {
      return false;
    }

    if (match.selector) {
      try {
        if (!el.matches(String(match.selector))) {
          return false;
        }
      } catch {
        return false;
      }
    }

    const typeMatches = toStringArray(match.types);
    if (typeMatches.length) {
      const fieldTypes = [descriptor.nativeType, descriptor.semanticType].map((type) => String(type).toLowerCase());
      if (!typeMatches.some((type) => fieldTypes.includes(type))) {
        return false;
      }
    }

    const names = toStringArray(match.names);
    if (names.length) {
      const nameBag = `${descriptor.name} ${descriptor.id}`;
      if (!names.some((name) => nameBag.includes(name))) {
        return false;
      }
    }

    const keywords = toStringArray(match.keywords);
    if (keywords.length) {
      if (!keywords.some((keyword) => descriptor.context.includes(keyword))) {
        return false;
      }
    }

    if (match.required !== undefined && Boolean(match.required) !== Boolean(el.required)) {
      return false;
    }

    return true;
  }

  function describeField(el) {
    const nativeType = getNativeType(el);
    const context = collectFieldContext(el);
    const semanticType = inferSemanticType(context, nativeType, el);

    return {
      nativeType,
      semanticType,
      context,
      name: String(el.getAttribute("name") || "").toLowerCase(),
      id: String(el.id || "").toLowerCase()
    };
  }

  function collectFieldContext(el) {
    const parts = [
      el.id,
      el.getAttribute("name"),
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("title"),
      el.getAttribute("autocomplete"),
      getLabelText(el),
      getNearbyFieldHint(el)
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase().trim());

    return parts.join(" ");
  }

  function getLabelText(el) {
    const texts = [];
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.textContent) {
      texts.push(parentLabel.textContent);
    }

    if (el.id) {
      const escapedId = cssEscape(el.id);
      if (escapedId) {
        for (const label of document.querySelectorAll(`label[for="${escapedId}"]`)) {
          if (label.textContent) {
            texts.push(label.textContent);
          }
        }
      }
    }

    return texts.join(" ").replace(/\s+/g, " ").trim();
  }

  function getNearbyFieldHint(el) {
    let node = el.parentElement;
    let steps = 0;

    while (node && steps < 3) {
      const raw = String(node.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (raw.length >= 4 && raw.length <= 220 && /(birthday|dob|date of birth|gender|sex|day|month|year)/.test(raw)) {
        return raw;
      }

      node = node.parentElement;
      steps += 1;
    }

    return "";
  }

  function inferSemanticType(context, nativeType, el) {
    const normalized = String(context || "").toLowerCase();
    const hasBirthKeyword = /(date.?of.?birth|birth.?date|birthday|dob)/.test(normalized);
    const splitBirthday = hasBirthKeyword || isLikelySplitBirthdayGroup(el);

    if (splitBirthday) {
      if (/\b(day|dd)\b/.test(normalized)) {
        return "birthDay";
      }
      if (/\b(month|mm)\b/.test(normalized)) {
        return "birthMonth";
      }
      if (/\b(year|yyyy|yy)\b/.test(normalized)) {
        return "birthYear";
      }
      if (DATE_INPUT_TYPES.has(nativeType)) {
        return "birthDate";
      }
    }

    if (nativeType === "file") {
      return "file";
    }
    if (nativeType === "email") {
      return "email";
    }
    if (nativeType === "tel") {
      return "phone";
    }
    if (nativeType === "url") {
      return "url";
    }
    if (nativeType === "password") {
      return "password";
    }
    if (nativeType === "textarea") {
      return "description";
    }
    if (DATE_INPUT_TYPES.has(nativeType)) {
      return nativeType === "time" ? "time" : "date";
    }

    for (const rule of SEMANTIC_RULES) {
      if (rule.regex.test(context)) {
        return rule.type;
      }
    }

    if (nativeType === "number" || nativeType === "range") {
      return "quantity";
    }

    return "text";
  }

  function isLikelySplitBirthdayGroup(el) {
    if (!el) {
      return false;
    }

    const scope =
      el.closest("fieldset, [role='group'], [aria-label], [data-testid], .form-group, .input-group, .row") ||
      el.parentElement;
    if (!scope) {
      return false;
    }

    const text = String(scope.textContent || "")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const hasBirthdayWord = /(birthday|date of birth|birth date|dob)/.test(text);
    const hasParts = /\bday\b/.test(text) && /\bmonth\b/.test(text) && /\byear\b/.test(text);

    return hasBirthdayWord || hasParts;
  }

  function generateTextValue(el, descriptor, textConstraints) {
    if (descriptor.semanticType === "email") {
      return generateEmailValue(el, textConstraints);
    }

    const base = getBaseTextValue(descriptor, el);
    const { min, max } = resolveTextBounds(el, textConstraints);
    let value = fitToLength(base, min, max);

    const pattern = el.getAttribute("pattern");
    if (pattern && !matchesPattern(value, pattern)) {
      const fallback = makePatternFallback(pattern, min, max);
      if (fallback && matchesPattern(fallback, pattern)) {
        value = fallback;
      }
    }

    return value;
  }

  function getBaseTextValue(descriptor, el) {
    switch (descriptor.semanticType) {
      case "firstName":
        return pick(FIRST_NAMES);
      case "lastName":
        return pick(LAST_NAMES);
      case "fullName":
        return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      case "birthDay":
        return String(getBirthdayDateForRun().getDate());
      case "birthMonth":
        return String(getBirthdayDateForRun().getMonth() + 1);
      case "birthYear":
        return String(getBirthdayDateForRun().getFullYear());
      case "birthDate":
        return formatDate(getBirthdayDateForRun());
      case "gender":
        return pick(["male", "female", "other"]);
      case "email":
        return generateEmailValue(el);
      case "phone":
        return generatePhoneValue();
      case "company":
        return pick(COMPANIES);
      case "address":
        return `${randomInt(10, 9999)} ${pick(STREETS)}`;
      case "city":
        return pick(CITIES);
      case "state":
        return pick(STATES);
      case "postalCode":
        return randomDigits(5);
      case "country":
        return pick(COUNTRIES);
      case "username":
        return `${pick(FIRST_NAMES).toLowerCase()}.${pick(LAST_NAMES).toLowerCase()}${randomInt(10, 99)}`;
      case "password":
        return generatePasswordValue();
      case "url":
        return generateUrlValue(descriptor);
      case "title":
        return `Release ${randomInt(100, 999)} test`;
      case "description":
        return generateSentence(el instanceof HTMLTextAreaElement ? randomInt(14, 28) : randomInt(6, 12));
      case "id":
        return `TST-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 999)}`;
      case "price":
        return String(randomInt(100, 5000));
      case "quantity":
        return String(randomInt(1, 120));
      default:
        return generateSentence(el instanceof HTMLTextAreaElement ? randomInt(8, 18) : randomInt(3, 7));
    }
  }

  function generateNumberValue(el, numberConstraints, descriptor) {
    const constraints = numberConstraints || {};

    const attrMin = parseFiniteNumber(el.getAttribute("min"));
    const attrMax = parseFiniteNumber(el.getAttribute("max"));

    let min = parseFiniteNumber(constraints.min);
    let max = parseFiniteNumber(constraints.max);

    if (!Number.isFinite(min)) {
      min = Number.isFinite(attrMin) ? attrMin : 0;
    }
    if (!Number.isFinite(max)) {
      max = Number.isFinite(attrMax) ? attrMax : min + 1000;
    }

    if (constraints.mode === "positive") {
      min = Math.max(min, 1);
    } else if (constraints.mode === "negative") {
      max = Math.min(max, -1);
    }

    if (Number.isFinite(attrMin)) {
      min = Math.max(min, attrMin);
    }
    if (Number.isFinite(attrMax)) {
      max = Math.min(max, attrMax);
    }

    if (min > max) {
      const midpoint = (min + max) / 2;
      min = Math.floor(midpoint);
      max = Math.ceil(midpoint);
    }

    const step = parseStep(el.getAttribute("step"));
    const semanticType = descriptor?.semanticType || "";
    let preferredValue = null;
    if (semanticType === "birthDay") {
      preferredValue = getBirthdayDateForRun().getDate();
    } else if (semanticType === "birthMonth") {
      preferredValue = getBirthdayDateForRun().getMonth() + 1;
    } else if (semanticType === "birthYear") {
      preferredValue = getBirthdayDateForRun().getFullYear();
    }

    const rawValue = Number.isFinite(preferredValue) ? preferredValue : randomFloat(min, max);
    let value = step ? alignToStep(rawValue, min, step) : rawValue;
    value = clamp(value, min, max);

    const precision = step ? countDecimals(step) : 0;
    return formatNumber(value, precision);
  }

  function generateDateValue(el, nativeType, dateConstraints, descriptor) {
    const semanticType = descriptor?.semanticType || "";
    const isBirthdayField = semanticType === "birthDate" || semanticType === "birthDay" || semanticType === "birthMonth" || semanticType === "birthYear";

    if (isBirthdayField) {
      let birthday = getBirthdayDateForRun();
      const today = startOfDay(new Date());

      // Birthday fields must be in the past.
      if (birthday >= today) {
        birthday = addDays(today, -1);
      }

      if (nativeType === "datetime-local") {
        const withTime = withRandomTime(birthday);
        return formatDateTimeLocal(clampDateForInput(withTime, nativeType, el));
      }
      if (nativeType === "month") {
        return formatMonth(clampDateForInput(birthday, nativeType, el));
      }
      if (nativeType === "week") {
        return formatIsoWeek(clampDateForInput(birthday, nativeType, el));
      }
      if (nativeType === "time") {
        return generateTimeValue(el);
      }
      return formatDate(clampDateForInput(birthday, nativeType, el));
    }

    if (nativeType === "datetime-local") {
      const offsetRange = resolveDateOffsetRange(dateConstraints || {});
      let date = addDays(startOfDay(new Date()), randomInt(offsetRange.min, offsetRange.max));
      date = withRandomTime(date);

      date = clampDateForInput(date, nativeType, el);
      return formatDateTimeLocal(date);
    }

    if (nativeType === "time") {
      return generateTimeValue(el);
    }

    let date = pickConstrainedDate(el, nativeType, dateConstraints || {});
    date = clampDateForInput(date, nativeType, el);
    if (nativeType === "month") {
      return formatMonth(date);
    }
    if (nativeType === "week") {
      return formatIsoWeek(date);
    }
    return formatDate(date);
  }

  function pickConstrainedDate(el, nativeType, dateConstraints) {
    const offsetRange = resolveDateOffsetRange(dateConstraints);
    let candidate = addDays(startOfDay(new Date()), randomInt(offsetRange.min, offsetRange.max));

    candidate = clampDateForInput(candidate, nativeType, el);
    return candidate;
  }

  function clampDateForInput(candidate, nativeType, el) {
    let date = new Date(candidate);
    const minAttr = parseDateLike(nativeType, el.getAttribute("min"));
    const maxAttr = parseDateLike(nativeType, el.getAttribute("max"));
    if (minAttr && date < minAttr) {
      date = minAttr;
    }
    if (maxAttr && date > maxAttr) {
      date = maxAttr;
    }
    return date;
  }

  function resolveDateOffsetRange(dateConstraints) {
    const mode = dateConstraints.mode || "any";
    const minDays = parseFiniteNumber(dateConstraints.minDaysFromToday);
    const maxDays = parseFiniteNumber(dateConstraints.maxDaysFromToday);

    if (mode === "future") {
      const min = Number.isFinite(minDays) ? Math.max(0, Math.round(minDays)) : 1;
      const max = Number.isFinite(maxDays) ? Math.max(min, Math.round(maxDays)) : 365;
      return { min, max };
    }

    if (mode === "past") {
      const minBack = Number.isFinite(minDays) ? Math.max(0, Math.round(minDays)) : 1;
      const maxBack = Number.isFinite(maxDays) ? Math.max(minBack, Math.round(maxDays)) : 365;
      return { min: -maxBack, max: -minBack };
    }

    const min = Number.isFinite(minDays) ? Math.round(minDays) : -30;
    const max = Number.isFinite(maxDays) ? Math.round(maxDays) : 30;
    return min <= max ? { min, max } : { min: max, max: min };
  }

  function generateTimeValue(el) {
    const minAttr = parseTimeToMinutes(el.getAttribute("min"));
    const maxAttr = parseTimeToMinutes(el.getAttribute("max"));

    let min = Number.isFinite(minAttr) ? minAttr : 9 * 60;
    let max = Number.isFinite(maxAttr) ? maxAttr : 17 * 60;

    if (min > max) {
      const swap = min;
      min = max;
      max = swap;
    }

    const value = randomInt(min, max);
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${pad2(hours)}:${pad2(minutes)}`;
  }

  function generateSelectValue(select, constraints, descriptor) {
    const options = Array.from(select.options).filter((option) => !option.disabled);
    if (!options.length) {
      return "";
    }

    const fixed = constraints.fixedValue;
    if (fixed !== null && fixed !== undefined) {
      const fixedStr = String(fixed).toLowerCase();
      const exactMatch = options.find(
        (option) =>
          String(option.value).toLowerCase() === fixedStr ||
          String(option.textContent || "").toLowerCase().trim() === fixedStr
      );
      if (exactMatch) {
        return exactMatch.value;
      }
    }

    if (descriptor?.semanticType === "gender") {
      const genderOption = chooseGenderOptionFromSelect(options);
      if (genderOption) {
        return genderOption.value;
      }
    }

    const birthdayOption = chooseBirthdayOptionFromSelect(options, descriptor?.semanticType || "");
    if (birthdayOption) {
      return birthdayOption.value;
    }

    const preferred = constraints.select?.preferNonPlaceholder
      ? options.filter((option) => !isPlaceholderOption(option))
      : options;

    const pool = preferred.length ? preferred : options;
    return pick(pool).value;
  }

  function chooseBirthdayOptionFromSelect(options, semanticType) {
    if (!semanticType || !["birthDay", "birthMonth", "birthYear"].includes(semanticType)) {
      return null;
    }

    const birthDate = getBirthdayDateForRun();
    let targetNumber = null;
    let textAliases = [];

    if (semanticType === "birthDay") {
      targetNumber = birthDate.getDate();
      textAliases = [String(targetNumber), pad2(targetNumber)];
    } else if (semanticType === "birthMonth") {
      targetNumber = birthDate.getMonth() + 1;
      const monthIndex = birthDate.getMonth();
      const monthFull = birthDate.toLocaleString("en", { month: "long" }).toLowerCase();
      const monthShort = birthDate.toLocaleString("en", { month: "short" }).toLowerCase();
      textAliases = [String(targetNumber), pad2(targetNumber), monthFull, monthShort, String(monthIndex + 1)];
    } else if (semanticType === "birthYear") {
      targetNumber = birthDate.getFullYear();
      textAliases = [String(targetNumber), String(targetNumber).slice(-2)];
    }

    const normalizedAliases = new Set(textAliases.map((value) => String(value).toLowerCase()));
    return (
      options.find((option) => {
        const value = String(option.value || "").trim().toLowerCase();
        const text = String(option.textContent || "").trim().toLowerCase();
        return normalizedAliases.has(value) || normalizedAliases.has(text);
      }) || null
    );
  }

  function chooseGenderOptionFromSelect(options) {
    const candidates = options.filter((option) => !isPlaceholderOption(option));
    return chooseGenderEntry(candidates, (option) => `${option.value} ${option.textContent || ""}`);
  }

  function chooseGenderOptionFromInputs(radios) {
    return chooseGenderEntry(radios, (radio) => `${radio.value || ""} ${getLabelText(radio)}`);
  }

  function chooseGenderEntry(entries, tokenGetter) {
    if (!entries.length) {
      return null;
    }

    const buckets = {
      male: [],
      female: [],
      nonBinary: [],
      other: []
    };

    for (const entry of entries) {
      const token = String(tokenGetter(entry) || "").toLowerCase();
      if (/\b(male|man|m)\b/.test(token)) {
        buckets.male.push(entry);
      } else if (/\b(female|woman|f)\b/.test(token)) {
        buckets.female.push(entry);
      } else if (/(non[- ]?binary|nb|other|prefer not|rather not)/.test(token)) {
        buckets.nonBinary.push(entry);
      } else if (/gender|sex/.test(token)) {
        buckets.other.push(entry);
      }
    }

    const prioritizedGroups = [buckets.male, buckets.female, buckets.nonBinary, buckets.other];
    const available = prioritizedGroups.filter((group) => group.length);
    if (available.length) {
      return pick(pick(available));
    }

    return null;
  }

  function fillFileInput(el, fileConstraints) {
    if (!(el instanceof HTMLInputElement) || getNativeType(el) !== "file") {
      return false;
    }

    const constraints = fileConstraints || {};
    if (!constraints.enabled) {
      return false;
    }

    if (typeof window.DataTransfer !== "function" || typeof window.File !== "function") {
      return false;
    }

    const count = el.multiple ? coercePositive(constraints.count, 1) : 1;
    const transfer = new DataTransfer();
    for (let index = 0; index < count; index += 1) {
      transfer.items.add(generateMockFile(el, constraints, index));
    }

    const previousCount = el.files ? el.files.length : 0;
    if (!applyNativeFilesSetter(el, transfer.files)) {
      return false;
    }

    triggerFieldEvents(el);
    const nextCount = el.files ? el.files.length : 0;
    return nextCount > 0 || previousCount !== nextCount;
  }

  function generateMockFile(el, constraints, index) {
    const spec = resolveFileSpec(el, constraints);
    const minBytes = Math.max(1, Math.round(coercePositive(constraints.minSizeKB, 8) * 1024));
    const maxBytes = Math.max(minBytes, Math.round(coercePositive(constraints.maxSizeKB, 64) * 1024));
    const sizeBytes = randomInt(minBytes, maxBytes);

    const basePayload = buildMockPayload(spec);
    const payload = fitBinaryPayload(basePayload, sizeBytes);

    const baseName = String(constraints.namePrefix || "mock-upload")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    const safeBaseName = baseName || "mock-upload";
    const suffix = index > 0 ? `-${index + 1}` : "";
    const fileName = `${safeBaseName}-${Date.now().toString(36)}${suffix}${spec.extension}`;

    return new File([payload], fileName, { type: spec.mime });
  }

  function resolveFileSpec(el, constraints) {
    const accepted = parseAcceptTokens(el.getAttribute("accept"));

    const explicitMime = normalizeMime(constraints.mime);
    const explicitExtension = normalizeExtension(constraints.extension);
    if (explicitMime || explicitExtension) {
      const mime = explicitMime || EXT_TO_MIME[explicitExtension] || "application/octet-stream";
      const extension = explicitExtension || MIME_TO_EXT[mime] || ".bin";
      return { mime, extension };
    }

    const preferredType = String(constraints.preferredType || "").toLowerCase();
    const preferredSpec = getPreferredFileSpec(preferredType);
    if (preferredSpec) {
      if (!accepted.length || isFileSpecAcceptedByAccept(preferredSpec, accepted)) {
        return preferredSpec;
      }
    }

    for (const token of accepted) {
      if (token.startsWith(".")) {
        const extMime = EXT_TO_MIME[token];
        return {
          mime: extMime || "application/octet-stream",
          extension: token
        };
      }

      if (token.endsWith("/*")) {
        if (token === "image/*") {
          return { mime: "image/png", extension: ".png" };
        }
        if (token === "audio/*") {
          return { mime: "audio/mpeg", extension: ".mp3" };
        }
        if (token === "video/*") {
          return { mime: "video/mp4", extension: ".mp4" };
        }
        if (token === "text/*") {
          return { mime: "text/plain", extension: ".txt" };
        }
        return { mime: "application/octet-stream", extension: ".bin" };
      }

      return {
        mime: token,
        extension: MIME_TO_EXT[token] || ".bin"
      };
    }

    return { mime: "text/plain", extension: ".txt" };
  }

  function getPreferredFileSpec(preferredType) {
    if (!preferredType || preferredType === "auto") {
      return null;
    }
    return FILE_TYPE_PRESETS[preferredType] || null;
  }

  function isFileSpecAcceptedByAccept(spec, acceptTokens) {
    if (!acceptTokens || !acceptTokens.length) {
      return true;
    }
    return acceptTokens.some((token) => doesAcceptTokenMatchSpec(token, spec));
  }

  function doesAcceptTokenMatchSpec(token, spec) {
    if (!token) {
      return false;
    }
    if (token === "*/*") {
      return true;
    }
    if (token.startsWith(".")) {
      return spec.extension === token;
    }
    if (token.endsWith("/*")) {
      const prefix = token.slice(0, -1);
      return spec.mime.startsWith(prefix);
    }
    return spec.mime === token;
  }

  function buildMockPayload(spec) {
    if (spec.mime === "application/pdf") {
      return encodeText("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
    }

    if (spec.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return new Uint8Array([
        0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x64, 0x6f, 0x63, 0x78, 0x2d, 0x6d, 0x6f,
        0x63, 0x6b
      ]);
    }

    if (spec.mime === "application/json") {
      return encodeText(JSON.stringify({ mock: true, createdAt: new Date().toISOString() }, null, 2));
    }

    if (spec.mime === "text/csv") {
      return encodeText("id,name,status\n1,Test Item,ok\n");
    }

    if (spec.mime === "image/png") {
      return base64ToBytes(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAusB9Yv3NnUAAAAASUVORK5CYII="
      );
    }

    if (spec.mime === "image/jpeg") {
      return base64ToBytes(
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFhUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OFQ8QFS0dFR0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEAAwAAAAAAAAAAAAAAAAAAAgME/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCWAB//2Q=="
      );
    }

    if (spec.mime === "image/svg+xml") {
      return encodeText("<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='#0d6b58'/></svg>");
    }

    return encodeText("Smart Form Filler mock file");
  }

  function fitBinaryPayload(bytes, targetSize) {
    const source = bytes && bytes.length ? bytes : encodeText("x");
    if (source.length >= targetSize) {
      return source.slice(0, targetSize);
    }

    const out = new Uint8Array(targetSize);
    for (let i = 0; i < targetSize; i += 1) {
      out[i] = source[i % source.length];
    }
    return out;
  }

  function applyNativeFilesSetter(el, files) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
      if (descriptor?.set) {
        descriptor.set.call(el, files);
      } else {
        el.files = files;
      }
      return true;
    } catch {
      return false;
    }
  }

  function clearFileInput(el) {
    if (!(el instanceof HTMLInputElement) || getNativeType(el) !== "file") {
      return false;
    }

    if (isFileInputEmpty(el)) {
      return true;
    }

    // Strategy 1: assign an empty FileList via DataTransfer.
    if (typeof window.DataTransfer === "function") {
      try {
        const transfer = new DataTransfer();
        if (applyNativeFilesSetter(el, transfer.files) && isFileInputEmpty(el)) {
          triggerFieldEvents(el);
          return true;
        }
      } catch {
        // Continue with fallbacks.
      }
    }

    // Strategy 2: clear value via native setter/direct assignment.
    try {
      applyNativeValueSetter(el, "");
      if (!isFileInputEmpty(el)) {
        el.value = "";
      }
      if (isFileInputEmpty(el)) {
        triggerFieldEvents(el);
        return true;
      }
    } catch {
      // Continue with fallback.
    }

    // Strategy 3: type toggle reset, then restore key attributes.
    try {
      const accept = el.getAttribute("accept");
      const multiple = el.multiple;
      const capture = el.getAttribute("capture");
      const webkitdirectory = el.hasAttribute("webkitdirectory");

      el.type = "text";
      el.type = "file";

      if (accept !== null) {
        el.setAttribute("accept", accept);
      } else {
        el.removeAttribute("accept");
      }
      el.multiple = multiple;
      if (capture !== null) {
        el.setAttribute("capture", capture);
      } else {
        el.removeAttribute("capture");
      }
      if (webkitdirectory) {
        el.setAttribute("webkitdirectory", "");
      } else {
        el.removeAttribute("webkitdirectory");
      }

      if (isFileInputEmpty(el)) {
        triggerFieldEvents(el);
        return true;
      }
    } catch {
      // Continue with fallback.
    }

    // Strategy 4: temporary form reset while keeping the same node reference.
    try {
      const marker = document.createComment("smart-form-filler-file-marker");
      const parent = el.parentNode;
      if (!parent) {
        return false;
      }
      parent.insertBefore(marker, el);

      const tempForm = document.createElement("form");
      tempForm.style.display = "none";
      document.body.appendChild(tempForm);
      tempForm.appendChild(el);
      tempForm.reset();

      parent.insertBefore(el, marker);
      marker.remove();
      tempForm.remove();

      if (isFileInputEmpty(el)) {
        triggerFieldEvents(el);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  function isFileInputEmpty(el) {
    return !el.files || el.files.length === 0;
  }

  function snapshotFileSignature(files) {
    if (!files || typeof files.length !== "number" || files.length <= 0) {
      return [];
    }

    const signature = [];
    for (const file of Array.from(files)) {
      if (!file) {
        continue;
      }
      signature.push(`${file.name}|${file.size}|${file.type}|${file.lastModified}`);
    }
    return signature;
  }

  function areFileSignaturesEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  function parseAcceptTokens(acceptValue) {
    if (!acceptValue) {
      return [];
    }
    return String(acceptValue)
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  function normalizeMime(value) {
    if (!value) {
      return null;
    }
    const mime = String(value).trim().toLowerCase();
    return mime.includes("/") ? mime : null;
  }

  function normalizeExtension(value) {
    if (!value) {
      return null;
    }
    const ext = String(value).trim().toLowerCase();
    if (!ext) {
      return null;
    }
    return ext.startsWith(".") ? ext : `.${ext}`;
  }

  function encodeText(value) {
    return new TextEncoder().encode(String(value));
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }

  function isPlaceholderOption(option) {
    const value = String(option.value || "").trim().toLowerCase();
    const text = String(option.textContent || "").trim().toLowerCase();
    return value === "" || /^(select|choose|pick|please select)/.test(text);
  }

  function resolveTextBounds(el, textConstraints) {
    const constraints = textConstraints || {};
    let min = coerceNonNegative(constraints.minLength, DEFAULT_SETTINGS.text.minLength);
    let max = coercePositive(constraints.maxLength, DEFAULT_SETTINGS.text.maxLength);

    const attrMin = parseFiniteNumber(el.getAttribute("minlength"));
    const attrMax = parseFiniteNumber(el.getAttribute("maxlength"));

    if (Number.isFinite(attrMin) && attrMin >= 0) {
      min = Math.max(min, attrMin);
    }

    if (Number.isFinite(attrMax) && attrMax > 0) {
      max = Math.min(max, attrMax);
    }

    if (min > max) {
      max = min;
    }

    return { min, max };
  }

  function setElementValue(el, value) {
    const nextValue = value === null || value === undefined ? "" : String(value);
    const previous = el.value;
    applyNativeValueSetter(el, nextValue);
    triggerFieldEvents(el);
    return el.value !== previous;
  }

  function setElementChecked(el, checked) {
    const previous = el.checked;
    applyNativeCheckedSetter(el, Boolean(checked));
    triggerFieldEvents(el);
    return el.checked !== previous;
  }

  function applyNativeValueSetter(el, value) {
    const prototype =
      el instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLSelectElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  function applyNativeCheckedSetter(el, checked) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
    if (descriptor?.set) {
      descriptor.set.call(el, checked);
    } else {
      el.checked = checked;
    }
  }

  function triggerFieldEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function getNativeType(el) {
    if (el instanceof HTMLSelectElement) {
      return "select";
    }
    if (el instanceof HTMLTextAreaElement) {
      return "textarea";
    }
    return String(el.getAttribute("type") || "text").toLowerCase();
  }

  function isFillableElement(el) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
      return false;
    }

    if (el.disabled) {
      return false;
    }

    if (el instanceof HTMLInputElement && BLOCKED_INPUT_TYPES.has(getNativeType(el))) {
      return false;
    }

    if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.readOnly) {
      return false;
    }

    return true;
  }

  function hasFieldValue(el) {
    if (el instanceof HTMLInputElement) {
      const type = getNativeType(el);
      if (type === "checkbox" || type === "radio") {
        return el.checked;
      }
      if (type === "file") {
        return Boolean(el.files && el.files.length > 0);
      }
      return String(el.value || "").trim().length > 0;
    }

    if (el instanceof HTMLSelectElement) {
      return String(el.value || "").trim().length > 0;
    }

    return String(el.value || "").trim().length > 0;
  }

  function isElementVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
    if (Number(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getRadioGroupKey(radio) {
    if (radio.name) {
      const formPart = radio.form ? `form:${radio.form.id || radio.form.name || "anonymous"}` : "form:none";
      return `${formPart}|name:${radio.name}`;
    }
    return `single:${radio.id || getDomIndex(radio)}`;
  }

  function getRadioGroup(radio) {
    if (!radio.name) {
      return [radio];
    }
    const root = radio.form || document;
    return Array.from(root.querySelectorAll("input[type='radio']")).filter((candidate) => candidate.name === radio.name);
  }

  function getDomIndex(el) {
    let index = 0;
    let node = el;
    while (node?.previousElementSibling) {
      index += 1;
      node = node.previousElementSibling;
    }
    return index;
  }

  function generateEmailValue(el, textConstraints) {
    const pattern = el?.getAttribute ? String(el.getAttribute("pattern") || "") : "";
    const bounds = resolveEmailBounds(el, textConstraints);
    const domains = buildEmailDomainCandidates(pattern, bounds.max);
    const localParts = buildEmailLocalCandidates(el);

    for (const localPart of localParts) {
      for (const domain of domains) {
        const candidate = buildEmailCandidate(localPart, domain, bounds);
        if (candidate && isEmailCandidateValid(candidate, pattern, bounds)) {
          return candidate;
        }
      }
    }

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const randomLocal = randomEmailLocalPart(randomInt(6, 16));
      const candidate = buildEmailCandidate(randomLocal, pick(domains), bounds);
      if (candidate && isEmailCandidateValid(candidate, pattern, bounds)) {
        return candidate;
      }
    }

    const fallbackDomain = domains.find((domain) => domain.length + 3 <= bounds.max) || "x.co";
    const fallback = buildEmailCandidate(`qa${randomInt(1000, 9999)}`, fallbackDomain, bounds);
    return fallback || "a@b.co";
  }

  function resolveEmailBounds(el, textConstraints) {
    let min = 6;
    let max = 64;

    const attrMin = parseFiniteNumber(el?.getAttribute ? el.getAttribute("minlength") : null);
    const attrMax = parseFiniteNumber(el?.getAttribute ? el.getAttribute("maxlength") : null);
    const textMin = parseFiniteNumber(textConstraints?.minLength);
    const textMax = parseFiniteNumber(textConstraints?.maxLength);

    if (Number.isFinite(textMin)) {
      min = Math.max(min, Math.round(textMin));
    }
    if (Number.isFinite(textMax) && textMax > 0) {
      max = Math.min(max, Math.round(textMax));
    }
    if (Number.isFinite(attrMin) && attrMin > 0) {
      min = Math.max(min, Math.round(attrMin));
    }
    if (Number.isFinite(attrMax) && attrMax > 0) {
      max = Math.min(max, Math.round(attrMax));
    }

    if (max < 6) {
      max = 6;
    }
    if (min > max) {
      min = max;
    }

    return { min, max };
  }

  function buildEmailDomainCandidates(pattern, maxLength) {
    const explicitDomains = extractEmailDomainsFromPattern(pattern);
    const explicitTlds = extractEmailTldsFromPattern(pattern);

    const candidates = [
      ...explicitDomains,
      ...explicitTlds.map((tld) => `example.${tld}`),
      ...explicitTlds.map((tld) => `mail.${tld}`),
      "example.com",
      "sample.org",
      "mailhub.net",
      "acme.co",
      "northstar.io",
      "gmail.com",
      "outlook.com",
      "x.co",
      "e.io"
    ];

    const sanitized = candidates
      .map((candidate) => sanitizeEmailDomain(candidate))
      .filter((candidate) => candidate && candidate.length + 3 <= maxLength);

    return uniqueStrings(sanitized.length ? sanitized : ["example.com", "x.co"]);
  }

  function extractEmailDomainsFromPattern(pattern) {
    if (!pattern) {
      return [];
    }

    const normalized = String(pattern)
      .toLowerCase()
      .replace(/\\\./g, ".")
      .replace(/\\-/g, "-");

    const matches = normalized.match(/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/g);
    if (!matches) {
      return [];
    }

    return uniqueStrings(
      matches.filter((domain) => domain.includes(".") && !domain.startsWith(".") && !domain.endsWith("."))
    );
  }

  function extractEmailTldsFromPattern(pattern) {
    if (!pattern) {
      return [];
    }

    const normalized = String(pattern).toLowerCase().replace(/\\\./g, ".");
    const tlds = [];

    for (const match of normalized.matchAll(/\((?:\?:)?([a-z]{2,}(?:\|[a-z]{2,})+)\)/g)) {
      const parts = String(match[1])
        .split("|")
        .map((part) => part.trim())
        .filter((part) => /^[a-z]{2,}$/.test(part));
      tlds.push(...parts);
    }

    for (const match of normalized.matchAll(/\.([a-z]{2,})(?![a-z0-9])/g)) {
      const tld = String(match[1]).trim();
      if (/^[a-z]{2,}$/.test(tld)) {
        tlds.push(tld);
      }
    }

    return uniqueStrings(tlds).slice(0, 8);
  }

  function buildEmailLocalCandidates(el) {
    const first = pick(FIRST_NAMES).toLowerCase();
    const last = pick(LAST_NAMES).toLowerCase();
    const fieldHint = sanitizeEmailLocalPart(
      String(el?.getAttribute ? el.getAttribute("name") || el.id || "user" : "user")
        .replace(/[^a-z0-9]+/gi, ".")
        .toLowerCase()
    );
    const number = String(randomInt(10, 9999));

    const candidates = [
      `${first}.${last}${number}`,
      `${first}${number}`,
      `${first}_${last}`,
      `${last}.${first}${randomInt(1, 99)}`,
      `qa.${first}${number}`,
      `${fieldHint}.${randomInt(10, 999)}`,
      `test.user${number}`
    ];

    return uniqueStrings(candidates.map((candidate) => sanitizeEmailLocalPart(candidate)).filter(Boolean));
  }

  function randomEmailLocalPart(length) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789._-";
    let value = "";
    for (let i = 0; i < length; i += 1) {
      value += alphabet[randomInt(0, alphabet.length - 1)];
    }
    return sanitizeEmailLocalPart(value);
  }

  function sanitizeEmailLocalPart(value) {
    let local = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9._%+-]/g, "")
      .replace(/\.{2,}/g, ".")
      .replace(/[_-]{2,}/g, "-")
      .replace(/^[._%+-]+|[._%+-]+$/g, "");

    if (!local) {
      local = `user${randomInt(100, 999)}`;
    }

    if (!/[a-z0-9]/.test(local)) {
      local = `user${randomInt(100, 999)}`;
    }

    return local.slice(0, 64);
  }

  function sanitizeEmailDomain(value) {
    const domain = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, "")
      .replace(/\.{2,}/g, ".")
      .replace(/^-+|-+$/g, "")
      .replace(/^\.+|\.+$/g, "");

    if (!domain.includes(".")) {
      return "";
    }

    const parts = domain.split(".").filter(Boolean);
    if (parts.length < 2) {
      return "";
    }

    const normalizedParts = parts.map((part) => part.replace(/^-+|-+$/g, "").slice(0, 63)).filter(Boolean);
    if (normalizedParts.length < 2) {
      return "";
    }

    const tld = normalizedParts[normalizedParts.length - 1];
    if (!/^[a-z]{2,}$/.test(tld)) {
      return "";
    }

    return normalizedParts.join(".");
  }

  function buildEmailCandidate(localPart, domain, bounds) {
    const safeDomain = sanitizeEmailDomain(domain);
    if (!safeDomain) {
      return "";
    }

    const maxLocalLength = Math.max(1, bounds.max - safeDomain.length - 1);
    if (maxLocalLength < 1) {
      return "";
    }

    let safeLocal = sanitizeEmailLocalPart(localPart).slice(0, maxLocalLength);
    safeLocal = safeLocal.replace(/[._%+-]+$/g, "");
    if (!safeLocal) {
      safeLocal = "u";
    }

    let candidate = `${safeLocal}@${safeDomain}`;
    if (candidate.length < bounds.min) {
      while (candidate.length < bounds.min && safeLocal.length < maxLocalLength) {
        safeLocal += String(randomInt(0, 9));
        candidate = `${safeLocal}@${safeDomain}`;
      }
    }

    if (candidate.length > bounds.max) {
      return "";
    }

    return candidate;
  }

  function isEmailCandidateValid(value, pattern, bounds) {
    if (!value || value.length < bounds.min || value.length > bounds.max) {
      return false;
    }
    if (!isLikelyEmailFormat(value)) {
      return false;
    }
    if (pattern && !matchesPattern(value, pattern)) {
      return false;
    }
    return true;
  }

  function isLikelyEmailFormat(value) {
    return /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      String(value || "")
    );
  }

  function uniqueStrings(values) {
    return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
  }

  function generatePhoneValue() {
    return `+1${randomDigits(10)}`;
  }

  function generateUrlValue(descriptor) {
    const slug = descriptor.semanticType === "company" ? slugify(pick(COMPANIES)) : slugify(generateSentence(2));
    return `https://example.test/${slug}`;
  }

  function generatePasswordValue() {
    const core = randomAlphaNumeric(10);
    return `Qa!${core}9`;
  }

  function generateColorValue() {
    const colorNumber = randomInt(0, 0xffffff);
    return `#${colorNumber.toString(16).padStart(6, "0")}`;
  }

  function generateSentence(wordCount) {
    const count = clamp(Math.round(wordCount), 2, 32);
    const words = [];
    for (let i = 0; i < count; i += 1) {
      words.push(pick(WORDS));
    }
    words[0] = capitalize(words[0]);
    return `${words.join(" ")}.`;
  }

  function fitToLength(source, minLength, maxLength) {
    let value = String(source || "").replace(/\s+/g, " ").trim();

    if (value.length > maxLength) {
      value = value.slice(0, maxLength).trim();
    }

    while (value.length < minLength) {
      const suffix = `${value ? " " : ""}${pick(WORDS)}`;
      if (value.length + suffix.length > maxLength) {
        break;
      }
      value += suffix;
    }

    if (value.length < minLength) {
      const filler = randomAlphaNumeric(minLength - value.length);
      value = `${value}${filler}`.slice(0, maxLength);
    }

    return value;
  }

  function parseDateLike(type, rawValue) {
    if (!rawValue) {
      return null;
    }

    if (type === "date") {
      const parsed = new Date(`${rawValue}T00:00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (type === "datetime-local") {
      const parsed = new Date(rawValue);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (type === "month") {
      const match = String(rawValue).match(/^(\d{4})-(\d{2})$/);
      if (!match) {
        return null;
      }
      return new Date(Number(match[1]), Number(match[2]) - 1, 1);
    }

    if (type === "week") {
      return parseIsoWeek(rawValue);
    }

    return null;
  }

  function parseIsoWeek(value) {
    const match = String(value).match(/^(\d{4})-W(\d{2})$/i);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const week = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
      return null;
    }

    const simple = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = simple.getUTCDay() || 7;
    const monday = new Date(simple);
    monday.setUTCDate(simple.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
    return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
  }

  function formatDate(value) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  function formatDateTimeLocal(value) {
    return `${formatDate(value)}T${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }

  function formatMonth(value) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}`;
  }

  function formatIsoWeek(value) {
    const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${pad2(weekNum)}`;
  }

  function withRandomTime(date) {
    const copy = new Date(date);
    copy.setHours(randomInt(8, 18), randomInt(0, 59), 0, 0);
    return copy;
  }

  function startOfDay(value) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  function addDays(value, days) {
    const copy = new Date(value);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function getBirthdayDateForRun() {
    if (activeFillContext?.birthdayDate instanceof Date) {
      return activeFillContext.birthdayDate;
    }

    const fallback = generateBirthdayDateSeed();
    if (activeFillContext) {
      activeFillContext.birthdayDate = fallback;
    }
    return fallback;
  }

  function generateBirthdayDateSeed() {
    const today = new Date();
    const age = randomInt(18, 70);
    const year = today.getFullYear() - age;
    const month = randomInt(0, 11);
    const maxDay = new Date(year, month + 1, 0).getDate();
    const day = randomInt(1, maxDay);
    return new Date(year, month, day);
  }

  function parseTimeToMinutes(value) {
    if (!value) {
      return null;
    }
    const match = String(value).match(/^(\d{2}):(\d{2})/);
    if (!match) {
      return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }
    return hours * 60 + minutes;
  }

  function matchesPattern(value, pattern) {
    try {
      const regex = new RegExp(`^(?:${pattern})$`);
      return regex.test(value);
    } catch {
      return true;
    }
  }

  function makePatternFallback(pattern, minLength, maxLength) {
    if (/\\d/.test(pattern) && !/[a-z]/i.test(pattern)) {
      return randomDigits(clamp(minLength, 1, Math.max(1, maxLength)));
    }
    if (/\\d/.test(pattern) && /[a-z]/i.test(pattern)) {
      return randomAlphaNumeric(clamp(minLength, 4, Math.max(4, maxLength)));
    }
    if (/[a-z]/i.test(pattern)) {
      return randomLetters(clamp(minLength, 2, Math.max(2, maxLength)));
    }
    return null;
  }

  function parseStep(stepValue) {
    if (!stepValue || String(stepValue).toLowerCase() === "any") {
      return null;
    }
    const parsed = Number(stepValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function alignToStep(value, base, step) {
    const offset = value - base;
    const steps = Math.round(offset / step);
    return base + steps * step;
  }

  function formatNumber(value, precision) {
    if (precision <= 0) {
      return String(Math.round(value));
    }
    return value.toFixed(precision).replace(/\.?0+$/, "");
  }

  function countDecimals(value) {
    const text = String(value);
    const dot = text.indexOf(".");
    return dot === -1 ? 0 : text.length - dot - 1;
  }

  function parseFiniteNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function coerceOptionalNumber(value) {
    return parseFiniteNumber(value);
  }

  function coerceOptionalInteger(value) {
    const parsed = parseFiniteNumber(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  function coerceNonNegative(value, fallback) {
    const parsed = parseFiniteNumber(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(0, Math.round(parsed));
  }

  function coercePositive(value, fallback) {
    const parsed = parseFiniteNumber(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.round(parsed);
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
        const base =
          target[key] && typeof target[key] === "object" && !Array.isArray(target[key]) ? target[key] : {};
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

  function toStringArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
    }
    if (value === null || value === undefined) {
      return [];
    }
    const text = String(value).toLowerCase().trim();
    return text ? [text] : [];
  }

  function cssEscape(value) {
    if (!value) {
      return "";
    }
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function randomDigits(length) {
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += String(randomInt(0, 9));
    }
    return out;
  }

  function randomLetters(length) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += alphabet[randomInt(0, alphabet.length - 1)];
    }
    return out;
  }

  function randomAlphaNumeric(length) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += alphabet[randomInt(0, alphabet.length - 1)];
    }
    return out;
  }

  function capitalize(value) {
    if (!value) {
      return value;
    }
    return value[0].toUpperCase() + value.slice(1);
  }

  function pick(values) {
    return values[randomInt(0, values.length - 1)];
  }

  function randomInt(min, max) {
    const low = Math.ceil(Math.min(min, max));
    const high = Math.floor(Math.max(min, max));
    if (low === high) {
      return low;
    }
    return Math.floor(randomUnit() * (high - low + 1)) + low;
  }

  function randomFloat(min, max) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return randomUnit() * (high - low) + low;
  }

  function randomUnit() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] / 4294967296;
    }
    return Math.random();
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }
})();
