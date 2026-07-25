export interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
  wordCount?: number;
}

/** Subset of Shakespeare-/Caspa PublishingConfig used by EPUB export. */
export interface PublishingConfig {
  authorName?: string;
  subtitle?: string;
  coverTheme?: {
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    imageUrl?: string;
    accentColor?: string;
    isOverlayHidden?: boolean;
    aiPrompt?: string;
    showWraparound?: boolean;
    textShadow?: boolean;
  };
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  author?: string;
  publishing?: PublishingConfig;
}
