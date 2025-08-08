// Global version constant for Porta Gateway
export const APP_VERSION = '1.4.2';
export const BUILD_DATE = new Date().toISOString().split('T')[0];

// Version display utility
export const getVersionInfo = () => ({
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  fullVersion: `v${APP_VERSION} (${BUILD_DATE})`
});