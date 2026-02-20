import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { Question, Exam, QuestionType } from '../types';

// --- HELPERS ---

const unpackMetadata = (jsonString: string | null | undefined): any => {
  if (!jsonString) return {};
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("Metadata parse error (Non-fatal):", e);
    return {};
  }
};

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

const mapDbQuestionToLocal = (db: any): Question => {
  const mapped = mapDoc(db);
  const meta = unpackMetadata(db.metadata);

  const folder = meta.folder || mapped.folder_id || 'Mặc định';

  return {
    id: mapped.id,
    content: cleanContent(mapped.content),
    type: mapped.type as QuestionType,
    creatorId: mapped.creator_id,
    createdAt: mapped.createdAt,
    options: meta.options || mapped.options || [],
    correctAnswer: meta.correctAnswer || mapped.correct_answer,
    explanation: meta.explanation || mapped.explanation,
    bloomLevel: meta.bloomLevel || mapped.bloom_level,
    category: meta.category || mapped.category,
    folderId: folder,
    folder: folder,
    image: meta.image || mapped.image,
    isPublicBank: mapped.is_public_bank
  };
};

const mapLocalQuestionToDb = (q: Question, userId: string): any => {
  const folderName = q.folder || q.folderId || 'Mặc định';

  const metaObject = {
    options: q.options || [],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    bloomLevel: q.bloomLevel,
    category: q.category || 'General',
    folder: folderName,
    folderId: folderName,
    image: q.image,
  };

  return {
    content: typeof q.content === 'object' ? JSON.stringify(q.content) : q.content,
    type: q.type,
    creator_id: userId,
    bloom_level: q.bloomLevel,
    category: q.category,
    metadata: JSON.stringify(metaObject)
  };
};

const mapDbExamToLocal = (db: any): any => {
  let configObj: any = {};
  if (typeof db.config === 'string') {
      try { configObj = JSON.parse(db.config); } catch(e) {}
  } else if (db.config) {
      configObj = db.config;
  }

  return {
    id: db.$id,
    title: db.title || 'Bài thi không tên',
    type: db.type || 'EXAM',
    question_ids: db.question_ids || [],
    questionIds: db.question_ids || [], 
    config: configObj,
    folder: configObj.folder || db.folder || 'Mặc định',
    creatorId: db.creator_id,
    createdAt: db.$createdAt,
    
    // Đọc mọi cài đặt từ chuỗi nén configObj
    start_time: configObj.start_time || db.start_time,
    end_time: configObj.end_time || db.end_time,
    exam_password: configObj.exam_password || db.exam_password,
    shuffle_questions: configObj.shuffle_questions !== undefined ? configObj.shuffle_questions : true,
    shuffle_options: configObj.shuffle_options !== undefined ? configObj.shuffle_options : true,
    status: configObj.status || db.status || 'draft',
    exam_purpose: configObj.exam_purpose || db.exam_purpose || 'both',
    class_id: configObj.class_id || db.class_id || '',
    max_attempts: configObj.max_attempts || 1
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

  async fetchQuestions(userId: string, role: string = 'student'): Promise<Question[]> {
    try {
        const queries = [Query.orderDesc('$createdAt'), Query.limit(500)];
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.questions, queries);
        return response.documents.map(mapDbQuestionToLocal);
    } catch (error: any) {
        return handleFetchError('fetchQuestions', error);
    }
  },

  async saveQuestion(q: Question, userId: string, role: string = 'student') {
    const isGlobal = role === 'admin';
    const payload = {
        ...mapLocalQuestionToDb(q, userId),
        is_public_bank: isGlobal
    };
    
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

  async bulkInsertQuestions(questions: Question[], userId: string, role: string) {
    for (const q of questions) {
        await this.saveQuestion(q, userId, role);
    }
  },

  // --- SỬA LỖI TẠI ĐÂY: Kéo toàn bộ đề thi về Frontend xử lý lọc ---
  async fetchExams(userId: string, role: string = 'student'): Promise<Exam[]> {
    try {
        const queries = [
            Query.orderDesc('$createdAt'),
            Query.limit(500)
        ];
        // Tuyệt đối không thêm Query.isNotNull hay Query.or ở đây để tránh crash index
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, queries);
        return response.documents.map(mapDbExamToLocal);
    } catch (error: any) {
        console.error("Lỗi tải đề thi:", error);
        return [];
    }
  },

  async deleteExam(id: string) {
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id);
      } catch (error) {
          throw error;
      }
  },

  async updateExam(id: string, updates: any) {
      try {
          const doc = await databases.getDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id);
          let configObj: any = {};
          try { configObj = JSON.parse(doc.config || '{}'); } catch(e) {}

          if (updates.folder !== undefined) configObj.folder = updates.folder;
          if (updates.start_time !== undefined) configObj.start_time = updates.start_time;
          if (updates.end_time !== undefined) configObj.end_time = updates.end_time;
          if (updates.exam_password !== undefined) configObj.exam_password = updates.exam_password;
          if (updates.shuffle_questions !== undefined) configObj.shuffle_questions = updates.shuffle_questions;
          if (updates.shuffle_options !== undefined) configObj.shuffle_options = updates.shuffle_options;
          if (updates.status !== undefined) configObj.status = updates.status;
          if (updates.class_id !== undefined) configObj.class_id = updates.class_id;
          if (updates.exam_purpose !== undefined) configObj.exam_purpose = updates.exam_purpose;
          if (updates.max_attempts !== undefined) configObj.max_attempts = updates.max_attempts;

          const dbPayload = {
              config: JSON.stringify(configObj)
          };

          await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, id, dbPayload);
      } catch (error) {
          console.error("Lỗi cập nhật đề thi:", error);
          throw error;
      }
  },

  // --- SỬA LỖI TẠI ĐÂY: Bỏ các cột có thể không tồn tại trên Appwrite ---
  async saveExam(e: Exam, userId: string, role: string = 'student') {
    try {
        const configToSave = {
            ...(e.config || {}),
            exam_purpose: e.exam_purpose || e.config?.exam_purpose || 'both',
            status: e.status || e.config?.status || 'draft',
            class_id: e.sharedWithClassId || e.config?.class_id || null,
            max_attempts: e.config?.max_attempts || 1,
            folder: e.folder || 'Mặc định'
        };

        const payload = {
            title: e.title,
            type: e.type || 'REGULAR',
            question_ids: e.questionIds || [],
            config: JSON.stringify(configToSave), // Nhồi tất cả thông số vào chuỗi config
            creator_id: userId
            // Không gửi class_id và is_global ra ngoài payload để tránh lỗi Document Schema
        };
        const created = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.exams, ID.unique(), payload);
        return mapDbExamToLocal(created);
    } catch (error) {
        console.error("Lỗi lưu đề thi:", error);
        throw error;
    }
  },

  async bulkInsertExams(exams: Exam[], userId: string, role: string) {
    for (const e of exams) { await this.saveExam(e, userId, role); }
  },

  async fetchUserDocuments(userId: string, role: string) {
    try {
        const queries = [Query.orderDesc('$createdAt')];
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.user_documents, queries);
        return response.documents;
    } catch (error: any) {
        console.error("Fetch User Docs Error:", error);
        return [];
    }
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
            id: doc.$id, 
            fullName: doc.full_name, 
            email: doc.email, 
            role: doc.role, 
            status: doc.status?.toLowerCase(), // Chuẩn hóa về chữ thường để UI dễ check
            classId: doc.class_id, 
            avatarUrl: doc.avatar_url,
            created_by: doc.created_by // Bổ sung lấy tên Giáo viên tạo
        }));
    } catch (error) { return []; }
  },

  // --- TẠO HỌC VIÊN TRỰC TIẾP BỞI GIÁO VIÊN ---
  async createStudentByTeacher(studentData: { email: string; password: string; fullName: string; classId: string; teacherName: string }) {
      try {
          const authUser = await createAuthUserAsAdmin(studentData.email, studentData.password, studentData.fullName);
          const userId = authUser.$id || authUser.id; 
          
          const profilePayload = {
              email: studentData.email,
              full_name: studentData.fullName,
              role: 'student',
              status: 'approved',
              class_id: studentData.classId,
              avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(studentData.fullName)}&background=random`,
              created_by: studentData.teacherName // LƯU VẾT GIÁO VIÊN TẠO
          };
          
          const doc = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, userId, profilePayload);
          
          return {
              id: doc.$id, fullName: doc.full_name, email: doc.email, role: doc.role, status: doc.status, classId: doc.class_id, avatarUrl: doc.avatar_url, created_by: doc.created_by
          };
      } catch (error) {
          console.error("Lỗi tạo học viên bởi Giáo viên:", error);
          throw error;
      }
  },

  async fetchLectures(userId: string, role: string, classId?: string): Promise<any[]> {
    try {
        const queries: any[] = [Query.orderDesc('$createdAt'), Query.limit(100)];
        
        // Học viên chỉ thấy khóa học của lớp mình
        if (role === 'student' && classId) {
            queries.push(Query.equal('shared_with_class_id', [classId]));
        } 
        // Giáo viên chỉ thấy khóa do mình tạo (hoặc bạn có thể bỏ dòng này nếu muốn GV thấy hết)
        else if (role === 'teacher') {
            queries.push(Query.equal('creator_id', [userId]));
        }
        
        const response = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, queries);
        return response.documents.map((doc: any) => {
            let configObj = { modules: [] };
            if (doc.config) {
                try { configObj = typeof doc.config === 'string' ? JSON.parse(doc.config) : doc.config; } catch(e) {}
            }
            return {
                id: doc.$id,
                title: doc.title,
                class_id: doc.shared_with_class_id,
                creator_id: doc.creator_id,
                createdAt: doc.$createdAt,
                config: configObj
            };
        });
    } catch (error: any) { 
        console.error("Lỗi tải Bài giảng:", error);
        return []; 
    }
  },
async saveCourse(courseData: any, userId: string) {
      try {
          const payload = {
              title: courseData.title,
              shared_with_class_id: courseData.class_id || null,
              creator_id: userId,
              config: JSON.stringify(courseData.config) // Nén toàn bộ cây thư mục vào JSON
          };

          if (courseData.id) {
              await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, courseData.id, payload);
              return { ...courseData, config: payload.config };
          } else {
              const doc = await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, ID.unique(), payload);
              return { ...courseData, id: doc.$id, config: payload.config };
          }
      } catch (error) {
          console.error("Lỗi lưu Khóa học:", error);
          throw error;
      }
  },

  async deleteCourse(courseId: string) {
      try {
          await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, courseId);
      } catch (error) {
          console.error("Lỗi xóa Khóa học:", error);
          throw error;
      }
  }
};
// --- FOLDER MANAGEMENT (Appwrite-based) ---

export const fetchCustomFolders = async (moduleName: 'question' | 'exam'): Promise<string[]> => {
    try {
        const res = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.folders, [
            Query.equal('module', moduleName),
            Query.limit(100)
        ]);
        return res.documents.map(doc => doc.name);
    } catch (error) { console.error("Lỗi tải thư mục:", error); return []; }
};

export const createCustomFolder = async (name: string, moduleName: 'question' | 'exam') => {
    try {
        await databases.createDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.folders, ID.unique(), {
            name: name,
            module: moduleName
        });
    } catch (error) { console.error("Lỗi tạo thư mục:", error); throw error; }
};

export const deleteCustomFolder = async (name: string, moduleName: 'question' | 'exam') => {
    try {
        const res = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.folders, [
            Query.equal('name', name),
            Query.equal('module', moduleName)
        ]);
        if (res.documents.length > 0) {
            await Promise.all(res.documents.map(doc => databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.folders, doc.$id)));
        }
    } catch (error) { console.error("Lỗi xóa thư mục:", error); throw error; }
};

// --- EXAM RESULTS ---
export const submitExamResult = async (resultData: any) => {
    try {
        return await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.examResults,
            ID.unique(),
            resultData
        );
    } catch (error) { console.error("Lỗi lưu điểm thi:", error); throw error; }
};

export const fetchExamResults = async (examId: string): Promise<any[]> => {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.examResults,
            [
                Query.equal('exam_id', examId),
                Query.orderDesc('$createdAt'),
                Query.limit(500)
            ]
        );
        return response.documents.map((doc: any) => ({
            ...doc,
            id: doc.$id,
            createdAt: doc.$createdAt
        }));
    } catch (error) {
        console.error("Lỗi tải kết quả thi:", error);
        return [];
    }
};

export const fetchStudentAttemptCount = async (examId: string, studentId: string): Promise<number> => {
    try {
        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.examResults,
            [
                Query.equal('exam_id', examId),
                Query.equal('student_id', studentId),
                Query.limit(1)
            ]
        );
        return response.total;
    } catch (error) {
        console.error("Lỗi đếm số lần thi:", error);
        return 0;
    }
};