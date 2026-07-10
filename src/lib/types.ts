export type UserRole = 'super_admin' | 'hospital_admin' | 'learner';
export type AccountStatus = 'active' | 'disabled';
export type LanguageCode = 'ar' | 'en' | 'both';
export type PublishStatus = 'draft' | 'published' | 'archived';
export type ResourceType = 'video' | 'pdf' | 'poster' | 'image' | 'file' | 'external_link';
export type ModuleStage = 'locked' | 'pre_quiz' | 'video' | 'resources' | 'post_quiz' | 'completed';
export type QuizType = 'pre' | 'post';

export interface Hospital {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'disabled';
}

export interface Profile {
  id: string;
  full_name: string;
  national_id: string | null;
  date_of_birth: string | null;
  role: UserRole;
  hospital_id: string | null;
  status: AccountStatus;
  preferred_language: LanguageCode;
}

export interface Course {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  status: PublishStatus;
}

export interface Module {
  id: string;
  course_id: string;
  module_code: string;
  order_index: number;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  image_url: string | null;
  status: PublishStatus;
}

export interface ModuleResource {
  id: string;
  module_id: string;
  resource_type: ResourceType;
  title_en: string;
  title_ar: string;
  storage_path: string | null;
  video_external_id: string | null;
  video_thumbnail_url: string | null;
  display_order: number;
  visibility: 'visible' | 'hidden';
}

export interface LearnerProgress {
  id: string;
  learner_id: string;
  module_id: string;
  stage: ModuleStage;
  best_score: number | null;
  is_completed: boolean;
  completed_at: string | null;
}

export interface Certificate {
  id: string;
  learner_id: string;
  course_id: string;
  issued_at: string;
  expires_at: string;
  certificate_pdf_path: string | null;
}
