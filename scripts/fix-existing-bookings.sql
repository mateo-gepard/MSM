-- ============================================
-- Fix Existing Bookings - Add tutor_name
-- ============================================
-- Run this in Supabase SQL Editor to populate tutor_name 
-- for bookings that only have tutor_id

-- Update bookings by matching tutor_id with tutors table
UPDATE public.bookings b
SET tutor_name = t.name,
    updated_at = now()
FROM public.tutors t
WHERE b.tutor_id::text = t.id::text
  AND (b.tutor_name IS NULL OR b.tutor_name = '');

-- Verify the update
SELECT 
  id,
  tutor_id,
  tutor_name,
  contact_name,
  subject,
  date,
  status
FROM public.bookings
ORDER BY created_at DESC
LIMIT 10;

-- Show count of bookings with and without tutor_name
SELECT 
  CASE 
    WHEN tutor_name IS NOT NULL AND tutor_name != '' THEN 'Has tutor_name'
    ELSE 'Missing tutor_name'
  END as status,
  COUNT(*) as count
FROM public.bookings
GROUP BY status;
