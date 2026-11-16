-- Template duration target: 8–10 seconds (operators use real plate in that range)
UPDATE templates
SET duration_sec = 9.0,
    updated_at = unixepoch()
WHERE id = 'tmpl_turn_smile';

UPDATE template_versions
SET duration_sec = 9.0
WHERE id = 'tmplver_turn_smile_v1';
