export interface FeedbackEntry {
  id: string;
  description: string;
  image_mime: string | null;
  image_size: number | null;
  status: 'NEW' | 'REVIEWED';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface FeedbackPage {
  items: FeedbackEntry[];
  nextCursor: string | null;
}
