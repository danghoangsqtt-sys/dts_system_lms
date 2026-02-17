
export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  ESSAY = 'ESSAY',
}

export type UserRole = 'admin' | 'teacher' | 'student';

export type UserStatus = 'pending' | 'active';

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  email?: string;
  avatarUrl?: string;
  classId?: string;
  status: UserStatus;
  updatedAt?: number;
}

export interface Class {
  id: string;
  name: string;
  teacherId?: string;
  isActive: boolean;
  createdAt: number;
}

export type ExamType = 'REGULAR' | '15_MIN' | '45_MIN' | 'MID_TERM' | 'FINAL';

export interface QuestionFolder {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface Question {
  id: string;
  content: any; // JSONB for question content, answers, etc. or string
  type: string; // e.g., 'MULTIPLE_CHOICE', 'ESSAY'
  creatorId?: string;
  isPublicBank?: boolean;
  createdAt: number;
  
  // UI / Extended properties
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  bloomLevel?: string;
  category?: string;
  folderId?: string;
  image?: string;

  // DB properties
  bloom_level?: string;
  is_public_bank?: boolean;
}

export interface Exam {
  id: string;
  title: string;
  creatorId?: string;
  sharedWithClassId?: string;
  config: any; // JSONB for time, number of questions, etc.
  createdAt: number;
  
  // UI / Extended properties
  type?: string;
  questionIds?: string[];
  
  // DB properties
  question_ids?: string[];
  class_id?: string;
  creator_id?: string;
}

export interface Lecture {
  id: string;
  title: string;
  fileUrl: string;
  creatorId: string;
  sharedWithClassId?: string;
  createdAt: number;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  creationDate?: string;
  producer?: string;
}

export interface DocumentFile {
  id: string;
  name: string;
  url: string; 
  type: string;
  uploadDate: string;
  isProcessed?: boolean; 
  metadata?: PdfMetadata;
}

export interface VectorChunk {
  id: string;
  docId: string;
  text: string;
  embedding: number[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { uri: string; title: string }[]; 
  isRAG?: boolean; 
}

export interface AppSettings {
  modelName: string;
  aiVoice: string;
  temperature: number;
  maxOutputTokens: number;
  autoSave: boolean;
  ragTopK: number;
  thinkingBudget: number; 
  systemExpertise: 'ACADEMIC' | 'FIELD_EXPERT' | 'STUDENT_ASSISTANT';
  debugMode?: boolean;
  manualApiKey?: string;
}

export interface AppVersionInfo {
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  changelog: string;
  updateUrl: string;
  isUpdateAvailable: boolean;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
}

declare global {
  interface Window {
    require: (module: 'electron' | string) => any;
  }
}
