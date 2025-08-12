create table if not exists achievements (
  id serial primary key,
  stat_key text,
  title text,
  description text,
  threshold integer
);

create table if not exists user_achievements (
  user_id integer references users(id),
  achievement_id integer references achievements(id),
  earned_at timestamp,
  primary key (user_id, achievement_id)
);

create table if not exists user_medals (
  user_id integer references users(id),
  stat_key text,
  medal_type text,
  awarded_at timestamp,
  primary key (user_id, stat_key, medal_type)
);
