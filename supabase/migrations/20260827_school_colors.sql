-- Colors so a school can be recognised at a glance without wearing its logo.
--
-- Deliberately NOT the seal, the mascot, or the athletic wordmark: those are
-- registered marks and every school licenses them. A two-tone chip carrying the
-- school's name is nominative use — it refers to a real thing without claiming
-- the university stands behind anything.
alter table public.schools add column if not exists color text;
alter table public.schools add column if not exists accent text;

update public.schools set color = v.color, accent = v.accent from (values
  ('gwu.edu',        '#004976', '#FFC72C'),
  ('georgetown.edu', '#041E42', '#8A8B8C'),
  ('howard.edu',     '#003A63', '#E51937'),
  ('american.edu',   '#C41230', '#003A70'),
  ('umd.edu',        '#E21833', '#FFD200'),
  ('cua.edu',        '#D6001C', '#1A1A1A'),
  ('gallaudet.edu',  '#00274C', '#D2C295'),
  ('trinitydc.edu',  '#002855', '#C5A900'),
  ('udc.edu',        '#C8102E', '#FFC72C'),
  ('marymount.edu',  '#00539B', '#6E6E6E'),
  ('gmu.edu',        '#006633', '#FFCC33'),
  ('demo.edu',       '#5C5248', '#B9AC97')
) as v(domain, color, accent) where schools.domain = v.domain;
