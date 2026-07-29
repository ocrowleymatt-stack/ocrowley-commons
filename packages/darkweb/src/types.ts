export interface DarkWebMention {
  url: string;
  title: string;
  description: string;
  onionUrl?: string;
  source: string;
}

export interface BreachHit {
  source: 'hibp' | 'dehashed' | 'snusbase' | 'intelx' | 'stub';
  name: string;
  domain?: string;
  date?: string;
  dataClasses?: string[];
  count?: number;
}

export interface PasteHit {
  source: string;
  title?: string;
  url: string;
  date?: string;
  snippet?: string;
}

export interface DarkWebEntityInput {
  value: string;
  type?: string;
}

export interface DarkWebEntityResult {
  entity: string;
  type: string;
  darkWebMentions: DarkWebMention[];
  breachData: BreachHit[];
  pasteHits?: PasteHit[];
  totalMentions: number;
}

export interface DarkWebMonitorReport {
  results: DarkWebEntityResult[];
  totalEntitiesChecked: number;
  totalMentionsFound: number;
  highRiskEntities: DarkWebEntityResult[];
  aiSummary?: string;
  checkedAt: string;
  available: boolean;
  reason?: string;
}

export interface IntelXRecord {
  name: string;
  bucket: string;
  date: string;
  storageid: string;
}
