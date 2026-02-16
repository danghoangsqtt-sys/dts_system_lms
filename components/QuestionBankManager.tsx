
import React, { useState, useMemo, useEffect } from 'react';
import { Question, QuestionFolder, QuestionType, Exam } from '../types';
import { formatContent } from '../utils/textFormatter';
import ExamCreator from './ExamCreator';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface QuestionBankManagerProps {
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  folders: QuestionFolder[];
  setFolders: React.Dispatch<React.SetStateAction<QuestionFolder[]>>;
  exams: Exam[];
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  showNotify: (message: string, type: any) => void;
}

const BLOOM_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];

const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({ 
  questions: localQuestions, 
  setQuestions: setLocalQuestions, 
  folders, 
  setFolders, 
  exams = [], 
  setExams, 
  showNotify 
}) => {
  const { user } = useAuth();
  const [managerTab, setManagerTab] = useState<'QUESTIONS' | 'EXAMS'>('QUESTIONS');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<QuestionType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [bloomFilter, setBloomFilter] = useState('Tất cả');
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [viewScope, setViewScope] = useState<'MINE' | 'PUBLIC'>('MINE');

  // Supabase Questions State
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
    fetchDbQuestions();
  }, [viewScope]);

  const togglePublic = async (id: string, currentStatus: boolean) => {
    try {
        const { error } = await supabase
            .from('questions')
            .update({ is_public_bank: !currentStatus })
            .eq('id', id);
        
        if (error) throw error;
        showNotify("Đã cập nhật quyền chia sẻ.", "success");
        fetchDbQuestions();
    } catch (err: any) {
        showNotify(err.message, "error");
    }
  };

  // Logic lọc kết hợp (Local + DB nếu cần, ở đây ưu tiên hiển thị DB cho Giáo viên)
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
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [viewingQuestion, setViewingQuestion] = useState<any>(null);

  if (isCreatingExam || viewingExam) {
    return <ExamCreator 
      questions={localQuestions} 
      viewExam={viewingExam || undefined}
      onBack={() => { setIsCreatingExam(false); setViewingExam(null); }} 
      onSaveExam={(exam) => { setExams(prev => [...prev, exam]); setIsCreatingExam(false); showNotify("Đã lưu đề thi.", "success"); }}
    />;
  }

  return (
    <div className="h-full flex flex-col md:flex-row bg-white overflow-hidden animate-fade-in font-inter relative">
      <aside className="w-full md:w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-6">
            <button onClick={() => setManagerTab('QUESTIONS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${managerTab === 'QUESTIONS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Kho Đề</button>
            <button onClick={() => setManagerTab('EXAMS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${managerTab === 'EXAMS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Đề Thi</button>
          </div>
          
          <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                  <i className="fas fa-globe-asia text-blue-600"></i>
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Phạm vi</h3>
              </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            <button onClick={() => setViewScope('MINE')} className={`w-full text-left px-5 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all ${viewScope === 'MINE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-200/50'}`}>
                <i className="fas fa-user-circle"></i> Câu hỏi của tôi
            </button>
            <button onClick={() => setViewScope('PUBLIC')} className={`w-full text-left px-5 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all ${viewScope === 'PUBLIC' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-200/50'}`}>
                <i className="fas fa-users-viewfinder"></i> Thư viện cộng đồng
            </button>
            
            <div className="mt-10 p-6 bg-blue-50 rounded-3xl border border-blue-100">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 leading-none">Mẹo giáo viên</p>
                <p className="text-[11px] text-blue-800/70 leading-relaxed font-medium">Bạn có thể chia sẻ câu hỏi của mình để giúp các giảng viên khác xây dựng đề thi phong phú hơn.</p>
            </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="p-8 border-b border-slate-100 bg-white shadow-sm z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <nav className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                <i className="fas fa-home"></i>
                <span>/ Quản lý học liệu / {viewScope === 'MINE' ? 'Kho của tôi' : 'Cộng đồng'}</span>
              </nav>
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                {managerTab === 'QUESTIONS' ? 'Ngân hàng câu hỏi Hybrid' : 'Đề thi đã lưu'}
                <span className="text-sm font-bold bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full">
                  {displayQuestions.length}
                </span>
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
               <div className="relative group">
                 <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                 <input type="text" placeholder="Tìm kiếm câu hỏi..." value={search} onChange={e => setSearch(e.target.value)} className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white transition-all w-64" />
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 custom-scrollbar pb-32">
          {loading ? (
              <div className="h-full flex items-center justify-center"><i className="fas fa-circle-notch fa-spin text-4xl text-blue-500"></i></div>
          ) : (
            <div className="space-y-4 max-w-6xl mx-auto">
                {displayQuestions.map((q) => (
                  <div key={q.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center gap-6 relative overflow-hidden">
                     <div className={`absolute top-0 left-0 w-2 h-full ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                     <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 leading-relaxed text-base line-clamp-2 mb-2">
                          {typeof q.content === 'string' ? q.content : q.content.content}
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-tighter">Giảng viên: {q.profiles?.full_name || 'Hệ thống'}</span>
                           {q.is_public_bank && <span className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase border border-green-100">Công khai</span>}
                        </div>
                     </div>
                     {viewScope === 'MINE' && (
                        <button onClick={() => togglePublic(q.id, q.is_public_bank)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${q.is_public_bank ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                            {q.is_public_bank ? 'Hủy chia sẻ' : 'Chia sẻ'}
                        </button>
                     )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionBankManager;
