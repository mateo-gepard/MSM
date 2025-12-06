-- ============================================
-- Seed Tutors Data for MSM
-- ============================================
-- Run this in Supabase SQL Editor to populate tutors table
-- This matches the data from src/data/tutors.ts

-- Insert tutors
INSERT INTO public.tutors (id, name, subjects, bio, image_url, availability_text, available_slots, created_at, updated_at)
VALUES
  (
    '1'::uuid,
    'Juan Rivera Chopinaud',
    ARRAY['Mathematik', 'Physik', 'Spanisch'],
    'Erfolgreich in Mathe und Physik, quadrilingual. IB Student an Top-Schule in England. 1. Preis Mathematik-Olympiade.',
    '/tutors/Juan.png',
    'Di, Mi, Sa 17:30-19:00',
    '[
      {"day": "tuesday", "times": ["17:30", "18:00", "18:30"]},
      {"day": "wednesday", "times": ["17:30", "18:00", "18:30"]},
      {"day": "saturday", "times": ["17:30", "18:00", "18:30"]}
    ]'::jsonb,
    now(),
    now()
  ),
  (
    '4'::uuid,
    'Mateo Mamaladze',
    ARRAY['Physik', 'Informatik', 'Mathematik'],
    'Hobby-Ingenieur und Physik-Begeisterter. Erfolgreiche Teilnahme an internationaler Physik-Olympiade. Leitet Robotics-Kurs.',
    '/tutors/Mateo.JPG',
    'Mo-Fr ab 14 Uhr',
    '[
      {"day": "monday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "tuesday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "wednesday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "thursday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "friday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]}
    ]'::jsonb,
    now(),
    now()
  ),
  (
    '2'::uuid,
    'Roman Daugavet',
    ARRAY['Mathematik', 'Physik'],
    'Leidenschaftlicher Mathematiker und Physiker. 1. Preis Bundeswettbewerb Mathematik. Frühstudium in Mathematik und Luft- und Raumfahrttechnik.',
    '/tutors/Roman.JPG',
    'Mo, Mi, Fr 15-17 Uhr',
    '[
      {"day": "monday", "times": ["15:00", "15:30", "16:00", "16:30"]},
      {"day": "wednesday", "times": ["15:00", "15:30", "16:00", "16:30"]},
      {"day": "friday", "times": ["15:00", "15:30", "16:00", "16:30"]}
    ]'::jsonb,
    now(),
    now()
  ),
  (
    '3'::uuid,
    'Len Sobol',
    ARRAY['Physik', 'Informatik', 'Mathematik'],
    'Physiker, talentierter Programmierer und Robotik-Experte. Arbeitet seit 3 Jahren als Software Developer. Frühstudium in Luft- und Raumfahrttechnik.',
    '/tutors/Len.JPG',
    'Mo-Fr ab 14 Uhr',
    '[
      {"day": "monday", "times": ["16:30", "17:00", "17:30", "18:00"]},
      {"day": "wednesday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "thursday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "friday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]}
    ]'::jsonb,
    now(),
    now()
  ),
  (
    '5'::uuid,
    'Johannes Jacob',
    ARRAY['Mathematik', 'Physik'],
    'Äußerst erfolgreicher Mathematiker. Bester Mathematiker unter allen Schülern in Deutschland. Frühstudent in Analysis und Technischer Mechanik.',
    '/tutors/Johannes.jpg',
    'Mo-Fr ab 14 Uhr',
    '[
      {"day": "monday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "tuesday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "wednesday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "thursday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]},
      {"day": "friday", "times": ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]}
    ]'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  subjects = EXCLUDED.subjects,
  bio = EXCLUDED.bio,
  image_url = EXCLUDED.image_url,
  availability_text = EXCLUDED.availability_text,
  available_slots = EXCLUDED.available_slots,
  updated_at = now();

-- Verify insertion
SELECT 
  name, 
  subjects, 
  jsonb_array_length(available_slots) as slot_count
FROM public.tutors
ORDER BY name;
