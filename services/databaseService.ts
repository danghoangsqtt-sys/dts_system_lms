
import { supabase } from '../lib/supabase';
import { Question, Exam, QuestionType, Class, QuestionFolder } from '../types';

// --- MAPPERS (Frontend <-> DB) ---

const mapDbQuestionToLocal = (db: any): Question => ({
  id: db.id,
  content: typeof db.content === 'string' ? db.content : (db.content?.content || JSON.stringify(db.content)),
  type: db.type as QuestionType,
  options: db.options || [],
  correctAnswer: db.correct_answer,
  explanation: db.explanation,
  bloomLevel: db.bloom_level,
  category: db.category,
  folderId: db.folder_id || 'default',
  image: db.image,
  creatorId: db.creator_id,
  isPublicBank: db.is_public_bank,
  createdAt: db.created_at ? new Date(db.created_at).getTime() : Date.now()
});

const mapLocalQuestionToDb = (q: Question, userId: string): any => ({
  id: q.id, // Preserving ID for migration consistency
  content: q.content,
  type: q.type,
  options: q.options || [],
  correct_answer: q.correctAnswer,
  explanation: q.explanation,
  bloom_level: q.bloomLevel,
  category: q.category || 'General',
  folder_id: q.folderId === 'default' ? null : q.folderId,
  image: q.image,
  creator_id: userId,
  is_public_bank: !!q.isPublicBank,
  created_at: new Date(q.createdAt || Date.now()).toISOString()
});

const mapDbExamToLocal = (db: any): Exam => ({
  id: db.id,
  title: db.title,
  type: db.type,
  questionIds: db.question_ids || [],
  config: db.config || {},
  creatorId: db.creator_id,
  sharedWithClassId: db.class_id,
  createdAt: db.created_at ? new Date(db.created_at).getTime() : Date.now()
});

const mapLocalExamToDb = (e: Exam, userId: string): any => ({
  id: e.id,
  title: e.title,
  type: e.type || 'REGULAR',
  question_ids: e.questionIds || [],
  config: e.config || {},
  class_id: e.sharedWithClassId || e.config?.assignedClassId || null,
  creator_id: userId,
  created_at: new Date(e.createdAt || Date.now()).toISOString()
});

// --- SERVICE ---

export const databaseService = {
  // --- QUESTIONS ---
  async fetchQuestions(userId?: string) {
    // Fetch questions created by user OR public questions
    // Note: RLS policies on Supabase should technically handle the security, 
    // but we filter here for UI logic if needed.
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbQuestionToLocal);
  },

  async saveQuestion(q: Question, userId: string) {
    const payload = mapLocalQuestionToDb(q, userId);
    // Remove ID if it's not a valid UUID to let DB generate one? 
    // For this app, we assume the DB handles the ID or accepts the string ID if schema allows.
    // Upserting to handle both create and update.
    const { data, error } = await supabase
      .from('questions')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return mapDbQuestionToLocal(data);
  },

  async bulkInsertQuestions(questions: Question[], userId: string) {
    if (!questions || questions.length === 0) return;
    
    const payloads = questions.map(q => mapLocalQuestionToDb(q, userId));
    
    // Process in batches to avoid payload limit
    const BATCH_SIZE = 50;
    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      const batch = payloads.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('questions').upsert(batch, { onConflict: 'id' });
      if (error) {
        console.error("Bulk insert questions error:", error);
        // Continue to next batch even if one fails
      }
    }
  },

  // --- EXAMS ---
  async fetchExams(userId?: string) {
    // Fetch exams for the user
    let query = supabase.from('exams').select('*').order('created_at', { ascending: false });
    if (userId) {
       // Typically we want exams user created OR exams assigned to user's class (if student)
       // This logic is complex, usually handled by Supabase Policy or separate queries.
       // For now, we fetch what RLS allows.
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapDbExamToLocal);
  },

  async saveExam(e: Exam, userId: string) {
    const payload = mapLocalExamToDb(e, userId);
    const { data, error } = await supabase.from('exams').upsert(payload).select().single();
    if (error) throw error;
    return mapDbExamToLocal(data);
  },

  async bulkInsertExams(exams: Exam[], userId: string) {
    if (!exams || exams.length === 0) return;
    const payloads = exams.map(e => mapLocalExamToDb(e, userId));
    const { error } = await supabase.from('exams').upsert(payloads, { onConflict: 'id' });
    if (error) console.error("Bulk insert exams error:", error);
  },

  // --- CLASSES ---
  async fetchClasses(teacherId?: string) {
    let query = supabase.from('classes').select('*, teacher:teacher_id(full_name)');
    if (teacherId) {
      query = query.eq('teacher_id', teacherId);
    }
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      isActive: c.is_active,
      createdAt: new Date(c.created_at).getTime(),
      teacherName: c.teacher?.full_name
    }));
  }
};
