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
  
  // NEW: Lấy tên thư mục từ metadata, fallback về "Mặc định"
  const folder = meta.folder || 'Mặc định';

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
    folder, // Text-based folder
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
    folder: q.folder || 'Mặc định', // NEW: Save text-based folder
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

/**
 * GRACEFUL DEGRADATION HANDLER
 * Xử lý lỗi Appwrite 400 (thiếu Index/Attribute) một cách an toàn.
 * - Nếu lỗi 400: Log warning thân thiện, trả về mảng rỗng để bảo vệ UI.
 * - Nếu lỗi khác: Log error, trả về mảng rỗng (không throw để tránh crash React Tree).
 */
const handleFetchError = (context: string, error: any): [] => {
  if (error?.code === 400) {
    console.warn(
      `⚠️ Appwrite Database Warning [${context}]: Thiếu Index hoặc Attribute cho collection. ` +
      `Trả về mảng rỗng để bảo vệ UI. Chi tiết: ${error?.message || 'N/A'}`
    );
  } else {
    console.error(`❌ Database Error [${context}]:`, error);
  }
  return [];
};

// --- AUTH ADMIN SERVICE (REST API) ---
/**
 * Tạo tài khoản Auth (User Identity) trực tiếp bằng Server API Key.
 * Bỏ qua giới hạn "Pre-registration" của Client SDK.
 */
export const createAuthUserAsAdmin = async (email: string, password: string, name: string) => {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
    const secretKey = import.meta.env.VITE_APPWRITE_SERVER_API_KEY;

    if (!secretKey) throw new Error("Hệ thống chưa cấu hình Server API Key để tạo tài khoản.");

    // Gọi Appwrite REST API: /users
    const response = await fetch(`${endpoint}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Appwrite-Project': projectId,
            'X-Appwrite-Key': secretKey,
        },
        body: JSON.stringify({ 
            userId: 'unique()', 
            email, 
            password, 
            name 
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Không thể tạo tài khoản Auth (REST Error)");
    }
    
    // Trả về JSON chứa thông tin user ($id, status, etc...)
    return await response.json();
};

// --- SERVICE ---

export const databaseService = {
  // =====================
  // --- QUESTIONS ---
  // =====================
  async fetchQuestions(userId?: string): Promise<Question[]> {
    try {
        const queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.questions,
            queries
        );
        return response.documents.map(mapDbQuestionToLocal);
    } catch (error: any) {
        return handleFetchError('fetchQuestions', error);
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

  // =====================
  // --- EXAMS ---
  // =====================
  async fetchExams(userId?: string): Promise<Exam[]> {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.exams,
            [Query.orderDesc('$createdAt')]
        );
        return response.documents.map(mapDbExamToLocal);
    } catch (error: any) {
        return handleFetchError('fetchExams', error);
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

  // =====================
  // --- CLASSES ---
  // =====================

  /**
   * Fetch danh sách lớp học.
   * @param teacherId - Nếu có, chỉ lấy lớp do teacher này phụ trách.
   *                    Nếu không truyền, lấy toàn bộ lớp.
   * @returns Mảng document lớp học (Appwrite raw), hoặc [] nếu lỗi 400.
   */
  async fetchClasses(teacherId?: string): Promise<any[]> {
    try {
        const queries: any[] = [];
        if (teacherId) {
            queries.push(Query.equal('teacher_id', [teacherId]));
        }
        queries.push(Query.orderDesc('$createdAt'));
        queries.push(Query.limit(100));

        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.classes,
            queries
        );
        return response.documents.map(mapDoc);
    } catch (error: any) {
        return handleFetchError('fetchClasses', error);
    }
  },

  // =====================
  // --- STUDENTS ---
  // =====================
  
  async fetchStudentsByClass(classId: string) {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.profiles,
            [Query.equal('role', 'student'), Query.equal('class_id', classId)]
        );
        return response.documents.map((doc: any) => ({
            id: doc.$id,
            fullName: doc.full_name,
            email: doc.email,
            role: doc.role,
            status: doc.status,
            classId: doc.class_id,
            avatarUrl: doc.avatar_url
        }));
    } catch (error) {
        console.error("Lỗi tải danh sách học viên:", error);
        return [];
    }
  },

  // =====================
  // --- LECTURES & FILES ---
  // =====================

  async fetchLecturesByClass(classId: string): Promise<any[]> {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.lectures,
            [
                Query.equal('shared_with_class_id', [classId]),
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]
        );
        return response.documents.map(mapDoc);
    } catch (error: any) {
        return handleFetchError('fetchLecturesByClass', error);
    }
  },

  async fetchLecturesByCreator(creatorId: string): Promise<any[]> {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.lectures,
            [
                Query.equal('creator_id', [creatorId]),
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]
        );
        return response.documents.map(mapDoc);
    } catch (error: any) {
        return handleFetchError('fetchLecturesByCreator', error);
    }
  },

  async uploadLecture(file: File, title: string, classId: string, creatorId: string) {
      try {
          const uploaded = await storage.createFile(
              APPWRITE_CONFIG.buckets.lectures,
              ID.unique(),
              file
          );
          const fileUrl = storage.getFileView(APPWRITE_CONFIG.buckets.lectures, uploaded.$id);
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