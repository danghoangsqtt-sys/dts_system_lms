import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { Question, Exam, QuestionType } from '../types';

// --- HELPERS ---

/**
 * Helper: Parse JSON string một cách an toàn.
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
 */
const cleanContent = (rawContent: any): string => {
  let contentVal = rawContent;
  try {
    if (typeof contentVal === 'string' && (contentVal.trim().startsWith('{') || contentVal.trim().startsWith('['))) {
      const parsed = JSON.parse(contentVal);
      contentVal = parsed.content || contentVal; 
    }
  } catch(e) {}
  return typeof contentVal === 'string' ? contentVal : JSON.stringify(contentVal);
};

const mapDoc = (doc: any) => ({
    ...doc,
    id: doc.$id,
    createdAt: doc.$createdAt ? new Date(doc.$createdAt).getTime() : Date.now()
});

/**
 * MAPPER: DB -> LOCAL (Question)
 */
const mapDbQuestionToLocal = (db: any): Question => {
  const mapped = mapDoc(db);
  const meta = unpackMetadata(db.metadata);

  // Folder Logic: Priority: Metadata -> DB Column -> Default
  const folder = meta.folder || mapped.folder_id || 'Mặc định';

  return {
    id: mapped.id,
    content: cleanContent(mapped.content),
    type: mapped.type as QuestionType,
    creatorId: mapped.creator_id,
    createdAt: mapped.createdAt,
    
    // Packed fields
    options: meta.options || mapped.options || [],
    correctAnswer: meta.correctAnswer || mapped.correct_answer,
    explanation: meta.explanation || mapped.explanation,
    bloomLevel: meta.bloomLevel || mapped.bloom_level,
    category: meta.category || mapped.category,
    folderId: folder, // We use folderId prop to store the folder name string for compatibility
    folder: folder,   // Explicit field
    image: meta.image || mapped.image,
    isPublicBank: meta.isPublicBank ?? mapped.is_public_bank
  };
};

/**
 * MAPPER: LOCAL -> DB (Question)
 */
const mapLocalQuestionToDb = (q: Question, userId: string): any => {
  const folderName = q.folder || q.folderId || 'Mặc định';

  const metaObject = {
    options: q.options || [],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    bloomLevel: q.bloomLevel,
    category: q.category || 'General',
    folder: folderName, // SAVE FOLDER NAME HERE
    folderId: folderName, // Keep synced
    image: q.image,
    isPublicBank: !!q.isPublicBank
  };

  return {
    content: typeof q.content === 'object' ? JSON.stringify(q.content) : q.content,
    type: q.type,
    creator_id: userId,
    bloom_level: q.bloomLevel, // Sync basic fields to columns for Indexing if needed
    category: q.category,
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
    question_ids: mapped.question_ids || [],
    questionIds: mapped.question_ids || [], 
    config: configObj || {},
    folder: configObj.folder || 'Mặc định', // Extract folder from config
    creatorId: mapped.creator_id,
    sharedWithClassId: mapped.class_id,
    createdAt: mapped.createdAt
  };
};

const handleFetchError = (context: string, error: any): [] => {
  if (error?.code === 400) {
    console.warn(`⚠️ Appwrite Database Warning [${context}]: ${error?.message}`);
  } else {
    console.error(`❌ Database Error [${context}]:`, error);
  }
  return [];
};

// --- AUTH ADMIN SERVICE (REST API) ---
const getAdminHeaders = () => {
    const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
    const secretKey = import.meta.env.VITE_APPWRITE_SERVER_API_KEY;
    if (!secretKey) throw new Error("Hệ thống chưa cấu hình Server API Key.");
    return {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': secretKey,
    };
};

export const createAuthUserAsAdmin = async (email: string, password: string, name: string) => {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    const response = await fetch(`${endpoint}/users`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ userId: 'unique()', email, password, name })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Không thể tạo tài khoản Auth (REST Error)");
    }
    return await response.json();
};

export const deleteAuthUserAsAdmin = async (userId: string) => {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    try {
        const response = await fetch(`${endpoint}/users/${userId}`, {
            method: 'DELETE',
            headers: getAdminHeaders()
        });
        if (!response.ok && response.status !== 404) {
            const err = await response.json();
            console.error("Delete Auth Error:", err);
        }
    } catch (e) {
        console.error("Failed to delete Auth User:", e);
    }
};

// --- SERVICE ---

export const databaseService = {
  async removeStudentFromClass(profileId: string) {
      try {
          await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, profileId, { class_id: null });
      } catch (error) {
          throw error;
      }
  },

  async deleteUserProfileAndAuth(profileId: string) {
      await deleteAuthUserAsAdmin(profileId);
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, profileId);
      } catch (error) {
          throw error;
      }
  },

  async fetchQuestions(userId?: string): Promise<Question[]> {
    try {
        const queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, queries);
        return response.documents.map(mapDbQuestionToLocal);
    } catch (error: any) {
        return handleFetchError('fetchQuestions', error);
    }
  },

  async saveQuestion(q: Question, userId: string) {
    const payload = mapLocalQuestionToDb(q, userId);
    
    try {
        if (q.id && q.id.length <= 36 && !q.id.includes('.')) { 
             try {
                 const updated = await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, q.id, payload);
                 return mapDbQuestionToLocal(updated);
             } catch (e) {
                 const created = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, q.id, payload);
                 return mapDbQuestionToLocal(created);
             }
        } else {
             const created = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, ID.unique(), payload);
             return mapDbQuestionToLocal(created);
        }
    } catch (error) {
        console.error("Lỗi lưu câu hỏi:", error);
        throw error;
    }
  },

  async deleteQuestion(id: string) {
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, id);
      } catch (error) {
          throw error;
      }
  },

  async updateQuestion(id: string, updates: Partial<Question>) {
      try {
          const doc = await databases.getDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, id);
          let meta: any = {};
          try { meta = JSON.parse(doc.metadata || '{}'); } catch(e) {}
          
          if (updates.folder) {
              meta.folder = updates.folder;
              meta.folderId = updates.folder;
          }
          
          await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, id, {
              metadata: JSON.stringify(meta)
          });
      } catch (error) {
          throw error;
      }
  },

  async bulkInsertQuestions(questions: Question[], userId: string) {
    for (const q of questions) {
        await this.saveQuestion(q, userId);
    }
  },

  async fetchExams(userId?: string): Promise<Exam[]> {
    try {
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, [Query.orderDesc('$createdAt')]);
        return response.documents.map(mapDbExamToLocal);
    } catch (error: any) {
        return handleFetchError('fetchExams', error);
    }
  },

  async deleteExam(id: string) {
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id);
      } catch (error) {
          throw error;
      }
  },

  async updateExam(id: string, updates: Partial<Exam>) {
      try {
          const doc = await databases.getDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id);
          let configObj: any = {};
          try { configObj = JSON.parse(doc.config || '{}'); } catch(e) {}

          if (updates.folder) {
              configObj.folder = updates.folder;
          }
          
          await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id, {
              config: JSON.stringify(configObj)
          });
      } catch (error) {
          throw error;
      }
  },

  async saveExam(e: Exam, userId: string) {
    try {
        const configToSave = e.config || {};
        if (e.folder) configToSave.folder = e.folder; // Persist folder

        const payload = {
            title: e.title,
            type: e.type || 'REGULAR',
            question_ids: e.questionIds || [],
            config: JSON.stringify(configToSave),
            class_id: e.sharedWithClassId || e.config?.assignedClassId || null,
            creator_id: userId,
        };
        const created = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, ID.unique(), payload);
        return mapDbExamToLocal(created);
    } catch (error) {
        throw error;
    }
  },

  async bulkInsertExams(exams: Exam[], userId: string) {
    for (const e of exams) { await this.saveExam(e, userId); }
  },

  async fetchClasses(teacherId?: string): Promise<any[]> {
    try {
        const queries: any[] = [];
        if (teacherId) queries.push(Query.equal('teacher_id', [teacherId]));
        queries.push(Query.orderDesc('$createdAt'));
        queries.push(Query.limit(100));
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.classes, queries);
        return response.documents.map(mapDoc);
    } catch (error: any) {
        return handleFetchError('fetchClasses', error);
    }
  },
  
  async fetchStudentsByClass(classId: string) {
    try {
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, [Query.equal('role', 'student'), Query.equal('class_id', classId)]);
        return response.documents.map((doc: any) => ({
            id: doc.$id, fullName: doc.full_name, email: doc.email, role: doc.role, status: doc.status, classId: doc.class_id, avatarUrl: doc.avatar_url
        }));
    } catch (error) { return []; }
  },

  async fetchLecturesByClass(classId: string): Promise<any[]> {
    try {
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, [Query.equal('shared_with_class_id', [classId]), Query.orderDesc('$createdAt'), Query.limit(100)]);
        return response.documents.map(mapDoc);
    } catch (error: any) { return handleFetchError('fetchLecturesByClass', error); }
  },

  async uploadLecture(file: File, title: string, classId: string, creatorId: string) {
      try {
          const uploaded = await storage.createFile(APPWRITE_CONFIG.buckets.lectures, ID.unique(), file);
          const fileUrl = storage.getFileView(APPWRITE_CONFIG.buckets.lectures, uploaded.$id);
          const doc = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, ID.unique(), { title, file_url: fileUrl, creator_id: creatorId, shared_with_class_id: classId });
          return mapDoc(doc);
      } catch (error) { throw error; }
  }
};