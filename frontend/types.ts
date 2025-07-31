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
