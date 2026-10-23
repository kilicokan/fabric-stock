export type ParameterSettings = {
  reportNumberFormat: string;
  fasonWorkOrderGroupingMode: "separate" | "combined";
};

export const PARAMETER_SETTINGS_STORAGE_KEY = 'fabric-stock:parameter-settings';

export const DEFAULT_PARAMETER_SETTINGS: ParameterSettings = {
  reportNumberFormat: 'XXX',
  fasonWorkOrderGroupingMode: "separate",
};

export const readParameterSettings = (): ParameterSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_PARAMETER_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(PARAMETER_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_PARAMETER_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<ParameterSettings>;
    return {
      reportNumberFormat: typeof parsed.reportNumberFormat === 'string' && parsed.reportNumberFormat.trim()
        ? parsed.reportNumberFormat.trim()
        : DEFAULT_PARAMETER_SETTINGS.reportNumberFormat,
      fasonWorkOrderGroupingMode: parsed.fasonWorkOrderGroupingMode === "combined" ? "combined" : "separate",
    };
  } catch {
    return DEFAULT_PARAMETER_SETTINGS;
  }
};

export const saveParameterSettings = (settings: ParameterSettings): void => {
  if (typeof window === 'undefined') return;

  const normalized = {
    reportNumberFormat: String(settings.reportNumberFormat || DEFAULT_PARAMETER_SETTINGS.reportNumberFormat).trim(),
    fasonWorkOrderGroupingMode: settings.fasonWorkOrderGroupingMode || DEFAULT_PARAMETER_SETTINGS.fasonWorkOrderGroupingMode,
  };

  window.localStorage.setItem(PARAMETER_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
};
