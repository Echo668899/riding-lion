-- Align template metadata with night-road lion ride positioning.
-- Clear sample_output until a distinct verified generation exists (source≠sample).
UPDATE templates
SET
  title = 'Night Road Lion Ride',
  target_description = 'the featured rider who mounts and rides the lion on the night road',
  prompt_template = 'Edit @Video1 as the source clip. Replace the featured rider, {target_description}, with the person shown in @Image1 throughout the clip. Use @Image1 for facial identity and hairstyle. Keep the wardrobe, body movement, gestures, expression timing and position of the original rider. Follow the source camera movement, framing, lighting, background, lion, and cuts. When the rider turns or passes behind an object, preserve the occlusion and keep the same identity when the face comes back into view. Ignore the background of @Image1.',
  sample_output_key = NULL,
  updated_at = unixepoch()
WHERE id = 'tmpl_turn_smile';

UPDATE template_versions
SET
  title = 'Night Road Lion Ride',
  target_description = 'the featured rider who mounts and rides the lion on the night road',
  prompt_template = 'Edit @Video1 as the source clip. Replace the featured rider, {target_description}, with the person shown in @Image1 throughout the clip. Use @Image1 for facial identity and hairstyle. Keep the wardrobe, body movement, gestures, expression timing and position of the original rider. Follow the source camera movement, framing, lighting, background, lion, and cuts. When the rider turns or passes behind an object, preserve the occlusion and keep the same identity when the face comes back into view. Ignore the background of @Image1.',
  sample_output_key = NULL
WHERE id = 'tmplver_turn_smile_v1';
