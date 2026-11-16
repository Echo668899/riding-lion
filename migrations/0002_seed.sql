-- Seed credit packs
INSERT INTO credit_packs (id, credits, price_cents, label, recommended, active, sort_order) VALUES
  ('pack_1', 1, 999, '1 credit', 0, 1, 1),
  ('pack_3', 3, 1999, '3 credits', 1, 1, 2),
  ('pack_6', 6, 2999, '6 credits', 0, 1, 3);

-- Seed first template (replace R2 objects via ops without changing frontend)
INSERT INTO templates (
  id, slug, active, version, title, target_description, prompt_template,
  source_video_key, cover_key, sample_photo_key, sample_output_key,
  duration_sec, aspect_ratio, resolution, codec, generate_audio, price_credits,
  created_at, updated_at
) VALUES (
  'tmpl_turn_smile',
  'turn-and-smile',
  1,
  1,
  'Turn & Smile',
  'the featured performer facing away from the camera on a city street',
  'Edit @Video1 as the source clip. Replace the featured performer, {target_description}, with the person shown in @Image1 throughout the clip. Use @Image1 for facial identity and hairstyle. Keep the wardrobe, body movement, gestures, expression timing and position of the original performer. Follow the source camera movement, framing, lighting, background and cuts. When the performer turns or passes behind an object, preserve the occlusion and keep the same identity when the face comes back into view. Ignore the background of @Image1.',
  'templates/turn-smile/v1/source.mp4',
  'templates/turn-smile/v1/cover.jpg',
  'templates/turn-smile/v1/sample-photo.jpg',
  'templates/turn-smile/v1/sample-output.mp4',
  6.0,
  '9:16',
  '720p',
  'H264',
  0,
  1,
  unixepoch(),
  unixepoch()
);

INSERT INTO template_versions (
  id, template_id, version, title, target_description, prompt_template,
  source_video_key, cover_key, sample_photo_key, sample_output_key,
  duration_sec, aspect_ratio, resolution, codec, generate_audio, price_credits, created_at
) VALUES (
  'tmplver_turn_smile_v1',
  'tmpl_turn_smile',
  1,
  'Turn & Smile',
  'the featured performer facing away from the camera on a city street',
  'Edit @Video1 as the source clip. Replace the featured performer, {target_description}, with the person shown in @Image1 throughout the clip. Use @Image1 for facial identity and hairstyle. Keep the wardrobe, body movement, gestures, expression timing and position of the original performer. Follow the source camera movement, framing, lighting, background and cuts. When the performer turns or passes behind an object, preserve the occlusion and keep the same identity when the face comes back into view. Ignore the background of @Image1.',
  'templates/turn-smile/v1/source.mp4',
  'templates/turn-smile/v1/cover.jpg',
  'templates/turn-smile/v1/sample-photo.jpg',
  'templates/turn-smile/v1/sample-output.mp4',
  6.0,
  '9:16',
  '720p',
  'H264',
  0,
  1,
  unixepoch()
);
