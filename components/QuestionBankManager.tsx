import React, { useState, useMemo, useEffect } from 'react';
import { Question, QuestionFolder, QuestionType, Exam } from '../types';
import { formatContent } from '../utils/textFormatter';
import ExamCreator from './ExamCreator';
import { databases, APPWRITE_CONFIG, Query, ID } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import { databaseService } from '../services/databaseService';

interface QuestionBankManagerProps {
  folders: QuestionFolder[];
  setFolders: React.Dispatch<React.SetStateAction<QuestionFolder[]>>;
  exams: Exam[];
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  showNotify: (message: string, type: any) => void;
}

const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({ 
  folders, 
  setFolders, 
  exams = [], 
  setExams, 
  showNotify 
}) => {
  const { user } = useAuth();
  const [managerTab, setManagerTab] = useState<'QUESTIONS' | 'EXAMS'>('QUESTIONS');
  const [activeTab, setActiveTab] = useState<QuestionType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [viewScope, setViewScope] = useState<'MINE' | 'PUBLIC'>('MINE');
  const [dbQuestions, setDbQuestions] = useState<Question[]>([]);
  const [dbExams, setDbExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Folder State
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL');

  const fetchDbQuestions = async () => {
    setLoading(true);
    try {
        const queries = []; // Removed sorting temporarily to reduce index requirement friction, or add if index exists
        if (viewScope === 'MINE') {
            queries.push(Query.equal('creator_id', user?.id || ''));
        } else {
            queries.push(Query.equal('is_public_bank', true));
        }
        queries.push(Query.orderDesc('$createdAt'));

        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.questions,
            queries
        );
        
        // Map raw DB docs using the service mapper to ensure metadata (folders) is unpacked
        // We use a private helper or import the mapper if it was exported, 
        // but here we can just re-fetch via service or manually map.
        // Let's use service directly if possible, but service.fetchQuestions handles fetching.
        // Here we need custom queries. So we'll map manually similar to service.
        
        const mappedQuestions = response.documents.map(d => {
             let meta: any = {};
             try { meta = JSON.parse(d.metadata || '{}'); } catch(e) {}
             
             return {
                 id: d.$id,
                 content: d.content,
                 type: d.type as QuestionType,
                 bloom_level: d.bloom_level,
                 category: d.category,
                 is_public_bank: d.is_public_bank,
                 creatorId: d.creator_id,
                 folder: meta.folder || 'Mặc định',
                 createdAt: new Date(d.$createdAt).getTime(),
                 options: meta.options || [],
                 correctAnswer: meta.correctAnswer,
                 explanation: meta.explanation,
                 image: meta.image
             } as Question;
        });

        setDbQuestions(mappedQuestions);
    } catch (err: any) {
        showNotify("Lỗi tải câu hỏi: " + err.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const fetchDbExams = async () => {
      setLoading(true);
      try {
          const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.exams,
            [Query.equal('creator_id', user?.id || '')]
          );
          
          setDbExams(response.documents.map(d => ({
              ...d, id: d.$id
          })));
      } catch (err: any) {
          showNotify("Lỗi tải đề thi: " + err.message, 'error');
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    if (user?.id) {
        if (managerTab === 'QUESTIONS') fetchDbQuestions();
        else fetchDbExams();
    }
  }, [viewScope, user, managerTab]);

  const togglePublic = async (id: string, currentStatus: boolean) => {
    try {
        await databases.updateDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.questions,
            id,
            { is_public_bank: !currentStatus }
        );
        showNotify(currentStatus ? "Đã hủy chia sẻ câu hỏi." : "Đã chia sẻ câu hỏi công khai.", "success");
        fetchDbQuestions();
    } catch (err: any) {
        showNotify(err.message, "error");
    }
  };

  // Calculate unique folders from the loaded questions
  const uniqueFolders = useMemo(() => {
      const folders = new Set(dbQuestions.map(q => q.folder || 'Mặc định'));
      return ['ALL', ...Array.from(folders).sort()];
  }, [dbQuestions]);

  const displayQuestions = useMemo(() => {
    return dbQuestions.filter(q => {
        const contentStr = typeof q.content === 'string' ? q.content : (q.content as any).content || '';
        const matchSearch = contentStr.toLowerCase().includes(search.toLowerCase());
        const matchTab = activeTab === 'ALL' || q.type === activeTab;
        const matchFolder = selectedFolder === 'ALL' || (q.folder || 'Mặc định') === selectedFolder;
        return matchSearch && matchTab && matchFolder;
    });
  }, [dbQuestions, search, activeTab, selectedFolder]);

  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [viewingExam, setViewingExam] = useState<Exam | null>(null);

  const handleSaveExamToDb = async (exam: Exam) => {
      try {
          const configStr = JSON.stringify(exam.config || {});
          await databases.createDocument(
              APPWRITE_CONFIG.dbId,
              APPWRITE_CONFIG.collections.exams,
              ID.unique(),
              {
                  title: exam.title,
                  type: exam.type,
                  question_ids: exam.questionIds,
                  config: configStr,
                  class_id: exam.config.assignedClassId || null,
                  creator_id: user?.id
              }
          );

          showNotify("Đã lưu đề thi thành công.", "success");
          setIsCreatingExam(false);
          fetchDbExams();
      } catch (err: any) {
          showNotify(`Lỗi lưu đề thi: ${err.message}`, "error");
      }
  };

  if (isCreatingExam || viewingExam) {
    return <ExamCreator 
      questions={dbQuestions} 
      viewExam={viewingExam || undefined}
      onBack={() => { setIsCreatingExam(false); setViewingExam(null); }} 
      onSaveExam={handleSaveExamToDb}
    />;
  }

  return (
    <div className="h-full flex flex-col bg-[#F0F2F5] font-[Roboto] overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-8 py-5 shrink-0 shadow-sm z-10 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#14452F] text-white chamfer-sm flex items-center justify-center text-xl">
                    <i className={`fas ${managerTab === 'QUESTIONS' ? 'fa-database' : 'fa-file-signature'}`}></i>
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                        {managerTab === 'QUESTIONS' ? 'Ngân hàng câu hỏi' : 'Quản lý Đề thi'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Tổng số: <span className="text-[#14452F]">{managerTab === 'QUESTIONS' ? displayQuestions.length : dbExams.length}</span> mục dữ liệu
                    </p>
                </div>
            </div>
            <div className="flex bg-slate-100 p-1 chamfer-sm border border-slate-200">
                <button onClick={() => setManagerTab('QUESTIONS')} className={`px-6 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all ${managerTab === 'QUESTIONS' ? 'bg-[#14452F] text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>Kho câu hỏi</button>
                <button onClick={() => setManagerTab('EXAMS')} className={`px-6 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all ${managerTab === 'EXAMS' ? 'bg-[#14452F] text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>Đề thi</button>
            </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 pt-4">
            {managerTab === 'QUESTIONS' && (
                <>
                    {/* FOLDER FILTER CHIPS */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap mr-2">
                            <i className="fas fa-folder-open mr-1"></i> Thư mục:
                        </span>
                        {uniqueFolders.map(folder => (
                            <button
                                key={folder}
                                onClick={() => setSelectedFolder(folder)}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap transition-all ${
                                    selectedFolder === folder 
                                        ? 'bg-[#14452F] text-white border-[#14452F]' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {folder === 'ALL' ? 'Tất cả' : folder}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 no-scrollbar">
                            <button onClick={() => setViewScope('MINE')} className={`px-4 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest border transition-all ${viewScope === 'MINE' ? 'bg-[#E8F5E9] text-[#14452F] border-[#14452F]' : 'bg-white text-slate-400 border-slate-200'}`}><i className="fas fa-user-lock mr-2"></i> Cá nhân</button>
                            <button onClick={() => setViewScope('PUBLIC')} className={`px-4 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest border transition-all ${viewScope === 'PUBLIC' ? 'bg-[#E8F5E9] text-[#14452F] border-[#14452F]' : 'bg-white text-slate-400 border-slate-200'}`}><i className="fas fa-globe mr-2"></i> Cộng đồng</button>
                            <div className="w-[1px] h-8 bg-slate-200 mx-2"></div>
                            {['ALL', QuestionType.MULTIPLE_CHOICE, QuestionType.ESSAY].map(type => (
                                <button key={type} onClick={() => setActiveTab(type as any)} className={`px-4 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === type ? 'text-[#14452F] underline decoration-2 underline-offset-4' : 'text-slate-400 hover:text-slate-600'}`}>
                                    {type === 'ALL' ? 'Tất cả' : type === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm' : 'Tự luận'}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                                <input type="text" placeholder="Tìm kiếm nội dung..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 chamfer-sm text-xs font-bold text-slate-700 outline-none focus:border-[#14452F] transition-all" />
                            </div>
                        </div>
                    </div>
                </>
            )}
            
            {managerTab === 'EXAMS' && (
                <div className="flex justify-end">
                    <button onClick={() => setIsCreatingExam(true)} className="bg-[#14452F] text-white px-5 py-2.5 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] transition-all whitespace-nowrap"><i className="fas fa-plus mr-2"></i> Tạo đề</button>
                </div>
            )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-100 custom-scrollbar">
          {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-[#14452F]"><i className="fas fa-cog fa-spin text-4xl"></i><span className="text-xs font-black uppercase tracking-widest">Đang tải dữ liệu...</span></div>
          ) : managerTab === 'QUESTIONS' ? (
            <div className="grid grid-cols-1 gap-4 max-w-5xl mx-auto pb-20">
                {displayQuestions.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-slate-200 chamfer-md bg-slate-50">Không tìm thấy dữ liệu phù hợp</div>
                ) : (
                    displayQuestions.map((q) => (
                        <div key={q.id} className="bg-white p-6 chamfer-md border border-slate-200 hover:border-[#14452F]/30 hover:shadow-lg transition-all group flex gap-5">
                            <div className={`w-1 shrink-0 ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-[#14452F]' : 'bg-purple-500'}`}></div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[8px] font-black px-2 py-0.5 chamfer-sm uppercase ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-[#E8F5E9] text-[#14452F]' : 'bg-purple-50 text-purple-600'}`}>{q.type === QuestionType.MULTIPLE_CHOICE ? 'TN' : 'TL'}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{q.bloom_level}</span>
                                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 chamfer-sm border border-blue-100"><i className="fas fa-folder-open mr-1"></i> {q.folder}</span>
                                    </div>
                                    {viewScope === 'MINE' && (
                                        <button onClick={() => togglePublic(q.id, q.is_public_bank)} className="text-slate-300 hover:text-[#14452F] transition-all" title={q.is_public_bank ? "Hủy chia sẻ" : "Chia sẻ"}><i className={`fas ${q.is_public_bank ? 'fa-globe text-blue-500' : 'fa-lock'}`}></i></button>
                                    )}
                                </div>
                                <div className="text-sm font-medium text-slate-700 leading-relaxed math-content">{formatContent(typeof q.content === 'string' ? q.content : q.content.content)}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-7xl mx-auto pb-20">
                {dbExams.map(exam => (
                    <div key={exam.id} onClick={() => setViewingExam({ ...exam, questionIds: exam.question_ids, config: typeof exam.config === 'string' ? JSON.parse(exam.config) : exam.config })} className="bg-white p-6 chamfer-md border border-slate-200 hover:border-[#14452F] hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-64 justify-between">
                        <div>
                            <div className="flex justify-between mb-4">
                                <div className="w-10 h-10 bg-[#E8F5E9] chamfer-sm flex items-center justify-center text-[#14452F] font-bold"><i className="fas fa-file-alt"></i></div>
                                <span className="text-[9px] font-black bg-slate-100 px-2 py-1 chamfer-sm text-slate-500">{exam.question_ids?.length || 0} Câu</span>
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm leading-snug uppercase line-clamp-3 group-hover:text-[#14452F] transition-colors">{exam.title}</h4>
                        </div>
                        <div className="pt-4 border-t border-slate-50">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                {exam.class_id ? <i className="fas fa-users text-green-500"></i> : <i className="fas fa-pencil-alt text-orange-400"></i>}
                                {exam.class_id ? 'Đã giao' : 'Bản nháp'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
          )}
      </div>
    </div>
  );
};

export default QuestionBankManager;