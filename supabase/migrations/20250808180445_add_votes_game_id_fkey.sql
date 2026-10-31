alter table votes
  add constraint votes_game_id_fkey
  foreign key (game_id) references games(id)
  on delete cascade;
