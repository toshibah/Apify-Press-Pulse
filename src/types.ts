export interface Entity {
  id: number;
  name: string;
  type: 'company' | 'person' | 'brand';
  created_at: string;
}

export interface Mention {
  id: number;
  entity_id: number;
  title: string;
  url: string;
  source: string;
  published_at: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;
  sentiment_reason: string;
  summary: string;
}
