import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { Question, Exam, QuestionType } from '../types';

// --- HELPERS ---

/**
 * Helper: Parse JSON string một cách an toàn.
 * Trả về object rỗng nếu chuỗi không hợp lệ hoặc null/undefined.
 * Giúp tránh crash ứng dụng khi gặp dữ liệu lỗi.
 */
const unpackMetadata = (jsonString: string | null | undefined): any => {
  if (!jsonString) return {};
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("Metadata parse error (Non-fatal):", e);
    return {};
  }
};

/**
 * Helper: Làm sạch nội dung câu hỏi.
 * Xử lý trường hợp legacy data hoặc double-serialized JSON từ editor.
 */
const cleanContent = (rawContent: any): string => {
  let contentVal = rawContent;
  try {
    // Kiểm tra nếu là chuỗi JSON (bắt đầu bằng { hoặc [)
    if (typeof contentVal === 'string' && (contentVal.trim().startsWith('{') || contentVal.trim().startsWith('['))) {
      const parsed = JSON.parse(contentVal);
      // Nếu parse ra object có field content thì lấy, không thì giữ nguyên
      contentVal = parsed.content || contentVal; 
    }
  } catch(e) {
    // Nếu parse lỗi, giữ nguyên giá trị gốc
  }
  return typeof contentVal === 'string' ? contentVal : JSON.stringify(contentVal);
};

// Map Appwrite Document ($id, $createdAt) sang Frontend Model (id, createdAt)
const mapDoc = (doc: any) => ({
    ...doc,
    id: doc.$id,
    createdAt: doc.$createdAt ? new Date(doc.$createdAt).getTime() : Date.now()
});

/**
 * MAPPER: DB -> LOCAL (Question)
 * Giải nén cột 'metadata' để lấy lại các trường chi tiết.
 */
const mapDbQuestionToLocal = (db: any): Question => {
  const mapped = mapDoc(db);
  
  // 1. Unpack các trường phụ từ cột 'metadata'
  // Lưu ý: Nếu cột metadata chưa tồn tại (data cũ), nó sẽ trả về {}
  const meta = unpackMetadata(db.metadata);

  // 2. Fallback cho data cũ (nếu đang migration): 
  // Ưu tiên lấy từ meta, nếu không có thì thử lấy từ cột root (legacy columns)
  const options = meta.options || mapped.options || [];
  const correctAnswer = meta.correctAnswer || mapped.correct_answer;
  const explanation = meta.explanation || mapped.explanation;
  const bloomLevel = meta.bloomLevel || mapped.bloom_level;
  const category = meta.category || mapped.category;
  const folderId = meta.folderId || mapped.folder_id || 'default';
  const image = meta.image || mapped.image;
  const isPublicBank = meta.isPublicBank ?? mapped.is_public_bank;

  return {
    id: mapped.id,
    content: cleanContent(mapped.content), // Xử lý content an toàn
    type: mapped.type as QuestionType,     // Top-level field
    creatorId: mapped.creator_id,          // Top-level field
    createdAt: mapped.createdAt,           // System field
    
    // Packed fields
    options,
    correctAnswer,
    explanation,
    bloomLevel,
    category,
    folderId,
    image,
    isPublicBank
  };
};

/**
 * MAPPER: LOCAL -> DB (Question)
 * Đóng gói các trường phụ vào cột 'metadata' để tránh giới hạn Row Size.
 */
const mapLocalQuestionToDb = (q: Question, userId: string): any => {
  // 1. Chuẩn bị object metadata chứa các trường "nặng" hoặc không cần index
  const metaObject = {
    options: q.options || [],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    bloomLevel: q.bloomLevel,
    category: q.category || 'General',
    folderId: q.folderId === 'default' ? null : q.folderId,
    image: q.image,
    isPublicBank: !!q.isPublicBank
  };

  // 2. Return payload tối giản
  return {
    content: typeof q.content === 'object' ? JSON.stringify(q.content) : q.content,
    type: q.type,
    creator_id: userId,
    // Serialize metadata thành chuỗi JSON
    metadata: JSON.stringify(metaObject)
  };
};

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
    // Sử dụng mapper mới để đóng gói dữ liệu
    const payload = mapLocalQuestionToDb(q, userId);
    
    try {
        // Appwrite ID phải <= 36 ký tự và không chứa ký tự đặc biệt. 
        // Nếu ID local dài hoặc chứa ký tự lạ (do tạo random ở frontend), ta dùng ID.unique() cho cái mới.
        // Logic Upsert: Thử Update -> Nếu lỗi (không tồn tại) -> Create
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
                 // Fallback: Create if update fails
                 const created = await databases.createDocument(
                    APPWRITE_CONFIG.dbId,
                    APPWRITE_CONFIG.collections.questions,
                    q.id, // Try reusing ID if valid
                    payload
                 );
                 return mapDbQuestionToLocal(created);
             }
        } else {
             // Create new with generated ID
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
    // Chạy tuần tự để đảm bảo tính ổn định khi insert số lượng lớn
    for (const q of questions) {
        await this.saveQuestion(q, userId);
    }
  },

  // --- EXAMS ---
  // Giữ nguyên logic Exam vì config đã là JSON string
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
            config: JSON.stringify(e.config || {}), // Config cũng được đóng gói
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