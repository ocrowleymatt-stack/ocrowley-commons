export interface PersistenceConfig {
  dataDir: string;
}

let config: PersistenceConfig = {
  dataDir: process.env.OCROWLEY_DATA_DIR || process.env.DATA_DIR || './data',
};

export function getConfig(): PersistenceConfig {
  return config;
}

export function setConfig( partial: Partial<PersistenceConfig>): void {
  config = { ...config, ...partial };
}
