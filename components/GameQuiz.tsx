
import React, { useState, useMemo, useEffect } from 'react';
import { Question, QuestionType, QuestionFolder, Exam } from '../types';
import TimedChallengeGame from './games/TimedChallengeGame';
import OralGame from './games/OralGame';
import FlashcardGame from './games/FlashcardGame';
import MillionaireGame from './games/MillionaireGame';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface GameQuizProps {
  folders: QuestionFolder[];
}

type GameMode = 'LOBBY' | 'TIMED' | 'ORAL' | 'FLASHCARD' | 'MILLIONAIRE';

const GameQuiz: React.FC<GameQuizProps> = ({ folders }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<GameMode>('LOBBY');
  const [gameState, setGameState] = useState<'SELECT_EXAM' | 'CONFIG' | 'READY'>('SELECT_EXAM');
  
  // Data States
  const [assignedExams, setAssignedExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch Exams or General Questions on Load
  useEffect(() => {
    if (!user) return;

    const initializeGameLobby = async () => {
        setLoading(true);
        try {
            if (user.role === 'student' && user.classId) {
                // HỌC VIÊN: Lấy đề thi được gán cho lớp
                const { data, error } = await supabase
                    .from('exams')
                    .select('*')
                    .eq('class_id', user.classId);
                
                if (error) throw error;
                setAssignedExams(data || []);
                setGameState('SELECT_EXAM');
            } else {
                // GIẢNG VIÊN/ADMIN: Lấy ngẫu nhiên câu hỏi để ôn tập nhanh
                const { data, error } = await supabase
                    .from('questions')
                    .select('*')
                    .limit(20); // Lấy 20 câu mẫu cho lobby
                
                if (error) throw error;
                setActiveQuestions(data || []);
                setGameState('CONFIG');
            }
        } catch (e) {
            console.error("Lobby initialization error:", e);
        } finally {
            setLoading(false);
        }
    };

    initializeGameLobby();
  }, [user]);

  // Handle Exam Selection for Students
  const handleSelectExam = async (exam: Exam) => {
    setSelectedExam(exam);
    setLoading(true);
    try {
        // Fetch specific questions listed in the exam
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .in('id', exam.questionIds);
        
        if (error) throw error;
        setActiveQuestions(data || []);
        setGameState('CONFIG');
    } catch (e) {
        alert("Không thể tải nội dung đề thi.");
    } finally {
        setLoading(false);
    }
  };

  // UI Helper: Game Card
  const GameCard = ({ onClick, icon, color, title, description, availableCount, requiredType }: any) => {
    const filteredCount = requiredType 
        ? activeQuestions.filter(q => q.type === requiredType).length 
        : activeQuestions.length;
    
    const isAvailable = filteredCount > 0;

    return (
        <button 
          onClick={onClick}
          disabled={!isAvailable}
          className={`group p-10 bg-white rounded-[3.5rem] border border-slate-100 shadow-sm text-left transition-all hover:shadow-2xl hover:scale-[1.02] active:scale-95 flex flex-col items-start h-full disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed relative overflow-hidden`}
        >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 text-2xl transition-all group-hover:rotate-12 bg-${color}-50 text-${color}-600 border border-${color}-100`}>
            <i className={`fas ${icon}`}></i>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight leading-none">{title}</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 flex-1">{description}</p>
          
          <div className="flex justify-between items-center w-full mt-auto">
              <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isAvailable ? `text-${color}-600` : 'text-slate-400'}`}>
                {isAvailable ? (
                    <>CHƠI NGAY <i className="fas fa-arrow-right"></i></>
                ) : (
                    <>KHÔNG KHẢ DỤNG <i className="fas fa-lock text-[8px]"></i></>
                )}
              </div>
              <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">
                  {filteredCount} Câu hỏi
              </span>
          </div>
        </button>
    );
  };

  // Game Engine Router
  if (mode === 'TIMED') {
    return <TimedChallengeGame questions={activeQuestions} onExit={() => setMode('LOBBY')} />;
  }

  if (mode === 'ORAL') {
    return <OralGame questions={activeQuestions.filter(q => q.type === QuestionType.ESSAY)} onExit={() => setMode('LOBBY')} />;
  }

  if (mode === 'FLASHCARD') {
    return <FlashcardGame questions={activeQuestions} onExit={() => setMode('LOBBY')} />;
  }

  if (mode === 'MILLIONAIRE') {
    return <MillionaireGame questions={activeQuestions.filter(q => q.type === QuestionType.MULTIPLE_CHOICE)} onExit={() => setMode('LOBBY')} />;
  }

  return (
    <div className="h-full p-8 bg-gray-50 overflow-y-auto custom-scrollbar font-inter">
      <header className="max-w-6xl mx-auto mb-12 animate-fade-in flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-4 text-blue-600 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
            <i className="fas fa-gamepad"></i> Trung tâm Khảo thí & Ôn luyện
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Vượt qua <br/> <span className="text-blue-600">Mọi Thử Thách</span></h2>
        </div>

        <div className="bg-white px-8 py-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-blue-100">
              <i className="fas fa-user-graduate"></i>
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{user?.role === 'student' ? 'Học viên' : 'Giảng viên'}</p>
              <h4 className="font-black text-slate-800 text-sm">{user?.fullName}</h4>
           </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-10">
        {/* Step 1: Select Exam (Students Only) */}
        {user?.role === 'student' && gameState === 'SELECT_EXAM' && (
            <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm animate-fade-in-up">
                <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-4">
                    <i className="fas fa-file-contract text-blue-600"></i>
                    Đề thi được gán cho lớp của bạn
                </h3>
                {loading ? (
                    <div className="py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i></div>
                ) : assignedExams.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                        Giảng viên chưa gán đề thi nào cho lớp của bạn
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {assignedExams.map(exam => (
                            <button 
                                key={exam.id} 
                                onClick={() => handleSelectExam(exam)}
                                className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-2xl hover:scale-[1.02] transition-all text-left group"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <i className="fas fa-file-invoice"></i>
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">
                                        {exam.questionIds.length} Câu hỏi
                                    </span>
                                </div>
                                <h4 className="font-black text-slate-800 text-lg leading-snug">{exam.title}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 group-hover:text-blue-600 transition-colors">Nhấn để bắt đầu ôn luyện <i className="fas fa-arrow-right ml-1"></i></p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* Step 2: Select Game Mode (Config Mode) */}
        {(user?.role !== 'student' || gameState === 'CONFIG') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
                {selectedExam && (
                    <div className="lg:col-span-2 bg-blue-600 p-8 rounded-[3rem] text-white flex items-center justify-between shadow-2xl shadow-blue-900/20">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-white/20 rounded-[1.8rem] flex items-center justify-center text-3xl backdrop-blur-md">
                                <i className="fas fa-award"></i>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Nội dung ôn luyện theo đề:</p>
                                <h3 className="text-2xl font-black">{selectedExam.title}</h3>
                            </div>
                        </div>
                        {user?.role === 'student' && (
                            <button onClick={() => setGameState('SELECT_EXAM')} className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                                Đổi đề thi khác
                            </button>
                        )}
                    </div>
                )}

                {user?.role !== 'student' && !selectedExam && (
                    <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[3rem] text-white flex items-center gap-6 shadow-2xl">
                         <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-xl">
                            <i className="fas fa-bolt"></i>
                         </div>
                         <div>
                            <h3 className="text-xl font-black">Chế độ Ôn luyện Nhanh (Giảng viên)</h3>
                            <p className="text-xs text-slate-400 font-medium mt-1">Hệ thống tự động lấy ngẫu nhiên 20 câu hỏi từ ngân hàng để bạn trải nghiệm game.</p>
                         </div>
                    </div>
                )}

                <GameCard 
                    onClick={() => setMode('TIMED')}
                    icon="fa-bolt-lightning"
                    color="orange"
                    title="Thử thách 60s"
                    description="Kiểm tra phản xạ nhanh với các câu hỏi kiến thức an toàn điện dưới áp lực thời gian."
                />
                <GameCard 
                    onClick={() => setMode('MILLIONAIRE')}
                    icon="fa-money-bill-trend-up"
                    color="green"
                    title="Ai là triệu phú"
                    description="Vượt qua các mốc câu hỏi trắc nghiệm để nhận phần thưởng điểm số tối đa."
                    requiredType={QuestionType.MULTIPLE_CHOICE}
                />
                 <GameCard 
                    onClick={() => setMode('ORAL')}
                    icon="fa-microphone"
                    color="blue"
                    title="Vấn đáp AI"
                    description="AI trực tiếp chấm điểm phần trình bày kiến thức bằng giọng nói của bạn."
                    requiredType={QuestionType.ESSAY}
                />
                <GameCard 
                    onClick={() => setMode('FLASHCARD')}
                    icon="fa-clone"
                    color="purple"
                    title="Thẻ ghi nhớ"
                    description="Ôn tập kiến thức thông qua phương pháp lật thẻ ghi nhớ (Active Recall)."
                />
            </div>
        )}
        
        {loading && <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-3xl text-blue-600"></i></div>}
      </div>
    </div>
  );
};

export default GameQuiz;
