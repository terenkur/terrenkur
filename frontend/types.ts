export interface Game {
  id: number;
  name: string;
  background_image?: string | null;
  nicknames?: string[];
}

export interface PollGame extends Game {
  count: number;
  nicknames: string[];
}

export interface Poll {
  id: number;
  created_at: string;
  archived: boolean;
  games: PollGame[];
}
