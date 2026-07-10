-- ============================================================================
-- BICSL LMS — Seed: the BICSL course and its 7 mandatory modules
-- ============================================================================
-- Modules are created as DRAFT — a Super Admin must attach video, resources,
-- and quiz questions to each, then Publish it, before it becomes visible to
-- learners (Content Publishing Workflow, Design Spec §44).
-- ============================================================================

insert into public.courses (id, name_en, name_ar, description_en, description_ar, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Basic Infection Control Skills License',
  'رخصة مهارات مكافحة العدوى الأساسية',
  'Standardized infection prevention and control training for healthcare professionals.',
  'تدريب موحّد على الوقاية من العدوى ومكافحتها للعاملين في الرعاية الصحية.',
  'draft'
);

insert into public.modules (course_id, module_code, order_index, name_en, name_ar, status)
values
  ('00000000-0000-0000-0000-000000000001', 'M1', 1, 'Hand Hygiene', 'نظافة اليدين', 'draft'),
  ('00000000-0000-0000-0000-000000000001', 'M2', 2, 'Personal Protective Equipment (PPE)', 'معدات الوقاية الشخصية', 'draft'),
  ('00000000-0000-0000-0000-000000000001', 'M3', 3, 'Transmission-Based Precautions', 'احتياطات العزل حسب طرق انتقال العدوى', 'draft'),
  ('00000000-0000-0000-0000-000000000001', 'M4', 4, 'Sharp / Needle Stick Injury Management', 'إدارة إصابات الوخز بالإبر والأدوات الحادة', 'draft'),
  ('00000000-0000-0000-0000-000000000001', 'M5', 5, 'Spill Management', 'إدارة انسكابات السوائل البيولوجية', 'draft'),
  ('00000000-0000-0000-0000-000000000001', 'M6', 6, 'Fit Test', 'اختبار ملاءمة جهاز التنفس', 'draft'),
  ('00000000-0000-0000-0000-000000000001', 'M7', 7, 'Powered Air-Purifying Respirator (PAPR)', 'جهاز التنفس المنقّي للهواء المزود بالطاقة (PAPR)', 'draft');

-- To publish the course and all modules once content is attached:
--   update public.courses set status = 'published' where id = '00000000-0000-0000-0000-000000000001';
--   update public.modules set status = 'published' where course_id = '00000000-0000-0000-0000-000000000001';
