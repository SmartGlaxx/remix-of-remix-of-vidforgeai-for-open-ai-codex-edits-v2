alter table public.character_film_shots
  add column if not exists board_start_path text,
  add column if not exists board_end_path text;