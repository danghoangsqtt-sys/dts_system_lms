import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { Question, Exam, QuestionType } from '../types';

// --- HELPERS ---

// Map Appwrite Document ($id, $createdAt) sang Frontend Model (id, createdAt)
const mapDoc = (doc: any) => ({
    ...doc,
    id: doc.$id,
    createdAt: doc.$createdAt ? new Date(doc.$createdAt).getTime() : Date.now()
});

const mapDbQuestionToLocal = (db: any): Question => {
  const mapped = mapDoc(db);
  // Xử lý content nếu nó là chuỗi JSON hoặc string thường
  let contentVal = mapped.content;
  try {
      if (typeof contentVal === 'string' && (contentVal.startsWith('{') || contentVal.startsWith('['))) {
          // Nếu là JSON string thì parse, nếu không giữ nguyên
          const parsed = JSON.parse(contentVal);
          contentVal = parsed.content || contentVal; 
      }
  } catch(e) {}

  return {
    id: mapped.id,
    content: contentVal,
    type: mapped.type as QuestionType,
    options: mapped.options || [],
    correctAnswer: mapped.correct_answer,
    explanation: mapped.explanation,
    bloomLevel: mapped.bloom_level,
    category: mapped.category,
    folderId: mapped.folder_id || 'default',
    image: mapped.image,
    creatorId: mapped.creator_id,
    isPublicBank: mapped.is_public_bank,
    createdAt: mapped.createdAt
  };
};

const mapLocalQuestionToDb = (q: Question, userId: string): any => ({
  content: typeof q.content === 'object' ? JSON.stringify(q.content) : q.content,
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
});

const mapDbExamToLocal = (db: any): Exam => {
  const mapped = mapDoc(db);
  let configObj = mapped.config;
  if (typeof configObj === 'string') {
      try { configObj = JSON.parse(configObj); } catch(e) { configObj = {}; }
  }

  return {
    id: mapped.id,
    title: mapped.title,
    type: mapped.type,
    questionIds: mapped.question_ids || [],
    config: configObj || {},
    creatorId: mapped.creator_id,
    sharedWithClassId: mapped.class_id,
    createdAt: mapped.createdAt
  };
};

// --- SERVICE ---

export const databaseService = {
  // --- QUESTIONS ---
  async fetchQuestions(userId?: string) {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.questions,
            [Query.orderDesc('$createdAt'), Query.limit(100)]
        );
        return response.documents.map(mapDbQuestionToLocal);
    } catch (error) {
        console.error("Lỗi tải câu hỏi:", error);
        return [];
    }
  },

  async saveQuestion(q: Question, userId: string) {
    const payload = mapLocalQuestionToDb(q, userId);
    try {
        // Appwrite ID phải <= 36 ký tự và không chứa ký tự đặc biệt. 
        // Nếu ID local dài hoặc chứa ký tự lạ, ta dùng ID.unique() cho cái mới.
        if (q.id && q.id.length <= 36 && !q.id.includes('.')) { 
             try {
                 const updated = await databases.updateDocument(
                    APPWRITE_CONFIG.dbId,
                    APPWRITE_CONFIG.collections.questions,
                    q.id,
                    payload
                 );
                 return mapDbQuestionToLocal(updated);
             } catch (e) {
                 // Nếu update lỗi (do không tồn tại), thử create
                 const created = await databases.createDocument(
                    APPWRITE_CONFIG.dbId,
                    APPWRITE_CONFIG.collections.questions,
                    q.id,
                    payload
                 );
                 return mapDbQuestionToLocal(created);
             }
        } else {
             const created = await databases.createDocument(
                APPWRITE_CONFIG.dbId,
                APPWRITE_CONFIG.collections.questions,
                ID.unique(),
                payload
             );
             return mapDbQuestionToLocal(created);
        }
    } catch (error) {
        console.error("Lỗi lưu câu hỏi:", error);
        throw error;
    }
  },

  async bulkInsertQuestions(questions: Question[], userId: string) {
    for (const q of questions) {
        await this.saveQuestion(q, userId);
    }
  },

  // --- EXAMS ---
  async fetchExams(userId?: string) {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.exams,
            [Query.orderDesc('$createdAt')]
        );
        return response.documents.map(mapDbExamToLocal);
    } catch (error) {
        return [];
    }
  },

  async saveExam(e: Exam, userId: string) {
    try {
        const payload = {
            title: e.title,
            type: e.type || 'REGULAR',
            question_ids: e.questionIds || [],
            config: JSON.stringify(e.config || {}),
            class_id: e.sharedWithClassId || e.config?.assignedClassId || null,
            creator_id: userId,
        };

        const created = await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.exams,
            ID.unique(),
            payload
        );
        return mapDbExamToLocal(created);
    } catch (error) {
        throw error;
    }
  },

  async bulkInsertExams(exams: Exam[], userId: string) {
    for (const e of exams) {
        await this.saveExam(e, userId);
    }
  },

  // --- LECTURES & FILES ---
  async uploadLecture(file: File, title: string, classId: string, creatorId: string) {
      try {
          // 1. Upload file vào bucket 'lectures'
          const uploaded = await storage.createFile(
              APPWRITE_CONFIG.buckets.lectures,
              ID.unique(),
              file
          );

          // 2. Lấy View URL
          const fileUrl = storage.getFileView(APPWRITE_CONFIG.buckets.lectures, uploaded.$id);

          // 3. Lưu thông tin vào Database
          const doc = await databases.createDocument(
              APPWRITE_CONFIG.dbId,
              APPWRITE_CONFIG.collections.lectures,
              ID.unique(),
              {
                  title: title,
                  file_url: fileUrl,
                  creator_id: creatorId,
                  shared_with_class_id: classId
              }
          );
          return mapDoc(doc);
      } catch (error) {
          console.error("Lỗi upload bài giảng:", error);
          throw error;
      }
  }
};