export interface Game {
  id: number;
  name: string;
  background_image?: string | null;
}

export interface Voter {
  id: number;
  username: string;
  count: number;
}

export interface PollGame extends Game {
  count: number;
  nicknames: Voter[];
}

export interface Poll {
  id: number;
  created_at: string;
  archived: boolean;
  games: PollGame[];
}

export type MusicQueueStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export interface MusicQueueItem {
  id: number;
  url: string;
  title?: string | null;
  preview_url?: string | null;
  requested_by?: string | null;
  status: MusicQueueStatus;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}
