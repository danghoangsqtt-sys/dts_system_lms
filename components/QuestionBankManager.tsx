
import React, { useState, useMemo, useEffect } from 'react';
import { Question, QuestionFolder, QuestionType, Exam } from '../types';
import { formatContent } from '../utils/textFormatter';
import ExamCreator from './ExamCreator';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  const [dbQuestions, setDbQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDbQuestions = async () => {
    setLoading(true);
    try {
        let query = supabase.from('questions').select('*, profiles(full_name)');
        
        if (viewScope === 'MINE') {
            query = query.eq('creator_id', user?.id);
        } else {
            query = query.eq('is_public_bank', true);
        }

        const { data, error } = await query;
        if (error) throw error;
        setDbQuestions(data || []);
    } catch (err: any) {
        showNotify(err.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
        fetchDbQuestions();
    }
  }, [viewScope, user]);

  const togglePublic = async (id: string, currentStatus: boolean) => {
    try {
        const { error } = await supabase
            .from('questions')
            .update({ is_public_bank: !currentStatus })
            .eq('id', id);
        
        if (error) throw error;
        showNotify(currentStatus ? "Đã hủy chia sẻ câu hỏi." : "Đã chia sẻ câu hỏi công khai.", "success");
        fetchDbQuestions();
    } catch (err: any) {
        showNotify(err.message, "error");
    }
  };

  const displayQuestions = useMemo(() => {
    return dbQuestions.filter(q => {
        const contentStr = typeof q.content === 'string' ? q.content : (q.content as any).content || '';
        const matchSearch = contentStr.toLowerCase().includes(search.toLowerCase());
        const matchTab = activeTab === 'ALL' || q.type === activeTab;
        return matchSearch && matchTab;
    });
  }, [dbQuestions, search, activeTab]);

  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [viewingExam, setViewingExam] = useState<Exam | null>(null);

  if (isCreatingExam || viewingExam) {
    // Note: ExamCreator logic may need similar Supabase migration in the future
    return <ExamCreator 
      questions={dbQuestions} 
      viewExam={viewingExam || undefined}
      onBack={() => { setIsCreatingExam(false); setViewingExam(null); }} 
      onSaveExam={(exam) => { setExams(prev => [...prev, exam]); setIsCreatingExam(false); showNotify("Đã lưu đề thi.", "success"); }}
    />;
  }

  return (
    <div className="h-full flex flex-col md:flex-row bg-white overflow-hidden animate-fade-in font-inter relative">
      {/* Sidebar Scopes */}
      <aside className="w-full md:w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-6">
            <button onClick={() => setManagerTab('QUESTIONS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${managerTab === 'QUESTIONS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Kho Đề</button>
            <button onClick={() => setManagerTab('EXAMS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${managerTab === 'EXAMS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Đề Thi</button>
          </div>
          
          <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                  <i className="fas fa-layer-group text-blue-600"></i>
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Phạm vi dữ liệu</h3>
              </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            <button 
                onClick={() => setViewScope('MINE')} 
                className={`w-full text-left px-5 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all ${viewScope === 'MINE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-200/50'}`}
            >
                <i className="fas fa-user-shield"></i> Câu hỏi của tôi
            </button>
            <button 
                onClick={() => setViewScope('PUBLIC')} 
                className={`w-full text-left px-5 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all ${viewScope === 'PUBLIC' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-200/50'}`}
            >
                <i className="fas fa-globe-asia"></i> Thư viện cộng đồng
            </button>
            
            <div className="mt-10 p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 leading-none">Chế độ giảng viên</p>
                <p className="text-[11px] text-indigo-800/70 leading-relaxed font-medium">Bạn có thể chia sẻ câu hỏi của mình để các giảng viên khác cùng sử dụng và đóng góp cho ngân hàng đề thi chung.</p>
            </div>
        </div>
      </aside>

      {/* Main List Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="p-8 border-b border-slate-100 bg-white shadow-sm z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <nav className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                <i className="fas fa-database"></i>
                <span>/ Ngân hàng đề / {viewScope === 'MINE' ? 'Kho cá nhân' : 'Thư viện chung'}</span>
              </nav>
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                {managerTab === 'QUESTIONS' ? 'Kho quản lý câu hỏi' : 'Quản lý Đề thi'}
                <span className="text-sm font-bold bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full">
                  {displayQuestions.length}
                </span>
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
               <div className="relative group">
                 <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                 <input 
                    type="text" 
                    placeholder="Tìm nội dung câu hỏi..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white transition-all w-64" 
                 />
               </div>
               {managerTab === 'EXAMS' && (
                 <button onClick={() => setIsCreatingExam(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all">
                    Tạo đề mới <i className="fas fa-plus ml-1"></i>
                 </button>
               )}
            </div>
          </div>

          <div className="flex gap-2 mt-6 overflow-x-auto no-scrollbar pb-1">
             {['ALL', QuestionType.MULTIPLE_CHOICE, QuestionType.ESSAY].map(type => (
               <button 
                  key={type} 
                  onClick={() => setActiveTab(type as any)} 
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === type ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
               >
                 {type === 'ALL' ? 'Tất cả' : type === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm' : 'Tự luận'}
               </button>
             ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 custom-scrollbar pb-32">
          {loading ? (
              <div className="h-full flex items-center justify-center py-20"><i className="fas fa-circle-notch fa-spin text-4xl text-blue-500"></i></div>
          ) : (
            <div className="space-y-6 max-w-5xl mx-auto">
                {displayQuestions.map((q) => (
                  <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col relative overflow-hidden">
                     <div className={`absolute top-0 left-0 w-2 h-full ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                     
                     <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                           <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                               {q.type === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm' : 'Tự luận'}
                           </span>
                           <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">{q.bloom_level || 'Mặc định'}</span>
                        </div>
                        {viewScope === 'MINE' && (
                            <button 
                                onClick={() => togglePublic(q.id, q.is_public_bank)} 
                                className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${q.is_public_bank ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}
                            >
                                <i className={`fas ${q.is_public_bank ? 'fa-eye-slash' : 'fa-share-nodes'} mr-1`}></i>
                                {q.is_public_bank ? 'Hủy chia sẻ' : 'Chia sẻ công khai'}
                            </button>
                        )}
                     </div>

                     <div className="font-bold text-slate-800 leading-relaxed text-lg math-content mb-6">
                        {formatContent(typeof q.content === 'string' ? q.content : q.content.content)}
                     </div>

                     <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                               {q.profiles?.full_name?.charAt(0) || 'H'}
                           </div>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Giảng viên: {q.profiles?.full_name || 'Hệ thống'}</span>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"><i className="fas fa-edit text-xs"></i></button>
                            {viewScope === 'MINE' && (
                                <button className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                            )}
                        </div>
                     </div>
                  </div>
                ))}

                {displayQuestions.length === 0 && !loading && (
                    <div className="py-32 text-center space-y-4 bg-white rounded-[3rem] border border-dashed border-slate-200">
                        <i className="fas fa-database text-5xl text-slate-100 mb-4"></i>
                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Không tìm thấy câu hỏi nào phù hợp</p>
                    </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionBankManager;
