CREATE OR REPLACE FUNCTION public.install_character_film_chapter(p_id uuid,p_owner uuid,p_chapter integer,p_scenes jsonb,p_shots jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE first_index integer; old_count integer; new_count integer; item jsonb; pos integer := 0;
BEGIN
PERFORM 1 FROM public.character_films WHERE id=p_id AND owner_id=p_owner AND state='preparing' FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Film is not preparing'; END IF;
IF EXISTS(SELECT 1 FROM public.character_film_shots WHERE film_id=p_id AND animation_id IS NOT NULL) THEN RAISE EXCEPTION 'Started clips cannot be replanned'; END IF;
SELECT min(index),count(*) INTO first_index,old_count FROM public.character_film_shots WHERE film_id=p_id AND chapter=p_chapter;
new_count := jsonb_array_length(p_shots);
IF first_index IS NULL OR new_count<1 OR new_count>48 THEN RAISE EXCEPTION 'Invalid directed chapter'; END IF;
DELETE FROM public.character_film_shots WHERE film_id=p_id AND chapter=p_chapter AND state='pending';
UPDATE public.character_film_shots SET index=-index-1 WHERE film_id=p_id AND chapter>p_chapter;
UPDATE public.character_film_shots SET index=-index-1+new_count-old_count WHERE film_id=p_id AND chapter>p_chapter;
FOR item IN SELECT value FROM jsonb_array_elements(p_shots) LOOP
INSERT INTO public.character_film_shots(film_id,owner_id,index,chapter,duration,line,purpose,visual,action,transition,image_path,direction)
VALUES(p_id,p_owner,first_index+pos,p_chapter,(item->>'duration')::integer,item->>'line',item->>'purpose',item->>'visual',item->>'action',item->>'transition',(SELECT image_path FROM public.character_films WHERE id=p_id),item->'direction');
pos:=pos+1;
END LOOP;
UPDATE public.character_films SET scenes=p_scenes,chapters=(SELECT jsonb_agg(jsonb_build_object('key','chapter-'||chapter,'indices',indices,'state','pending') ORDER BY chapter) FROM (SELECT chapter,jsonb_agg(index ORDER BY index) AS indices FROM public.character_film_shots WHERE film_id=p_id GROUP BY chapter) grouped),updated_at=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.install_character_film_chapter(uuid,uuid,integer,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.install_character_film_chapter(uuid,uuid,integer,jsonb,jsonb) TO service_role;