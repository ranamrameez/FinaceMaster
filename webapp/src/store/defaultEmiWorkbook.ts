import type { EMISettings, EMIWorkbook } from '../types/emiWorkbook';

export const DEFAULT_EMI_SETTINGS: EMISettings = {
  defaultCurrency: 'USD',
};

export function createEmptyEMIWorkbook(): EMIWorkbook {
  return {
    settings: { ...DEFAULT_EMI_SETTINGS },
    entries: [],
  };
}
