const isVerbose = process.env.VERBOSE_LOGS === 'true';

export const logDebug = (...args: unknown[]) => {
  if (isVerbose) {
    console.log(...args);
  }
};

export const logWarn = (...args: unknown[]) => {
  if (isVerbose) {
    console.warn(...args);
  }
};

export const logError = (...args: unknown[]) => {
  console.error(...args);
};
