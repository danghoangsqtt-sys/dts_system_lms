
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
                const { data, error } = await supabase.from('exams').select('*').eq('class_id', user.classId);
                if (error) throw error;
                setAssignedExams(data || []);
                setGameState('SELECT_EXAM');
            } else {
                const { data, error } = await supabase.from('questions').select('*').limit(20);
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

  const handleSelectExam = async (exam: Exam) => {
    setSelectedExam(exam);
    setLoading(true);
    try {
        const { data, error } = await supabase.from('questions').select('*').in('id', exam.questionIds);
        if (error) throw error;
        setActiveQuestions(data || []);
        setGameState('CONFIG');
    } catch (e) {
        alert("Không thể tải nội dung đề thi.");
    } finally {
        setLoading(false);
    }
  };

  // Game Engine Router
  if (mode === 'TIMED') return <TimedChallengeGame questions={activeQuestions} onExit={() => setMode('LOBBY')} />;
  if (mode === 'ORAL') return <OralGame questions={activeQuestions.filter(q => q.type === QuestionType.ESSAY)} onExit={() => setMode('LOBBY')} />;
  if (mode === 'FLASHCARD') return <FlashcardGame questions={activeQuestions} onExit={() => setMode('LOBBY')} />;
  if (mode === 'MILLIONAIRE') return <MillionaireGame questions={activeQuestions.filter(q => q.type === QuestionType.MULTIPLE_CHOICE)} onExit={() => setMode('LOBBY')} />;

  return (
    <div className="h-full p-8 bg-[#0F172A] overflow-y-auto custom-scrollbar font-[Roboto] text-white">
      
      {/* Hero Header */}
      <header className="max-w-7xl mx-auto mb-12 flex items-center justify-between bg-[#14452F] p-8 chamfer-lg border border-green-800 shadow-[0_0_30px_rgba(20,69,47,0.5)]">
        <div>
            <p className="text-[10px] font-black text-green-300 uppercase tracking-[0.3em] mb-2">Trung tâm Gamification</p>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                Đấu trường Tri thức DHsystem
            </h2>
        </div>
        <div className="text-right">
            <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Người chơi</div>
            <div className="font-black text-xl">{user?.fullName}</div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {/* Step 1: Select Exam (Students Only) */}
        {user?.role === 'student' && gameState === 'SELECT_EXAM' && (
            <div className="space-y-6 animate-fade-in-up">
                <h3 className="text-lg font-black text-slate-300 uppercase tracking-tight pl-2 border-l-4 border-[#14452F]">Chọn đề thi để bắt đầu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assignedExams.map(exam => (
                        <button 
                            key={exam.id} 
                            onClick={() => handleSelectExam(exam)}
                            className="bg-[#1E293B] p-8 chamfer-md border border-slate-700 hover:bg-[#14452F] hover:border-green-500 hover:-translate-y-1 transition-all text-left group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-green-500/20 transition-all"></div>
                            <div className="relative z-10">
                                <h4 className="font-black text-white text-lg mb-2">{exam.title}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest group-hover:text-green-200">
                                    {exam.questionIds.length} Câu hỏi • Bắt đầu ngay <i className="fas fa-arrow-right ml-1"></i>
                                </p>
                            </div>
                        </button>
                    ))}
                    {assignedExams.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-600 font-bold uppercase tracking-widest border border-dashed border-slate-800 chamfer-md">
                            Chưa có đề thi nào
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Step 2: BENTO GRID for Game Modes */}
        {(user?.role !== 'student' || gameState === 'CONFIG') && (
            <div className="animate-fade-in-up">
                {selectedExam && (
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                        <h3 className="text-xl font-bold text-green-400">Đang ôn tập: {selectedExam.title}</h3>
                        {user?.role === 'student' && (
                            <button onClick={() => setGameState('SELECT_EXAM')} className="text-xs font-black uppercase text-slate-400 hover:text-white transition-all underline decoration-dotted">Đổi đề thi</button>
                        )}
                    </div>
                )}

                {/* BENTO GRID LAYOUT */}
                <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-6 h-[600px]">
                    
                    {/* Large Featured Card: Millionaire (2x2) */}
                    <button 
                        onClick={() => setMode('MILLIONAIRE')}
                        className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-yellow-600/20 to-yellow-900/40 border border-yellow-600/30 chamfer-lg p-10 flex flex-col items-start justify-end group hover:bg-yellow-600/30 transition-all relative overflow-hidden"
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[150px] text-yellow-500/10 group-hover:scale-110 transition-transform duration-700">
                            <i className="fas fa-money-bill-trend-up"></i>
                        </div>
                        <div className="relative z-10 w-full">
                            <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 group-hover:text-yellow-400 transition-colors">Ai là Triệu phú</h3>
                            <p className="text-sm text-yellow-100/70 font-medium max-w-sm">Chinh phục 15 câu hỏi trắc nghiệm với 4 quyền trợ giúp để trở thành người chiến thắng.</p>
                            <div className="mt-6 inline-block px-6 py-2 bg-yellow-500 text-black font-black text-xs uppercase tracking-widest chamfer-sm">Play Now</div>
                        </div>
                    </button>

                    {/* Wide Card: Timed (2x1) */}
                    <button 
                        onClick={() => setMode('TIMED')}
                        className="md:col-span-2 bg-gradient-to-r from-orange-600/20 to-red-900/40 border border-orange-500/30 chamfer-lg p-8 flex items-center justify-between group hover:bg-orange-600/30 transition-all"
                    >
                        <div className="text-left">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter group-hover:text-orange-400">Thử thách 60s</h3>
                            <p className="text-xs text-orange-100/70 font-medium mt-1">Áp lực thời gian thực</p>
                        </div>
                        <i className="fas fa-bolt text-5xl text-orange-500 group-hover:rotate-12 transition-transform"></i>
                    </button>

                    {/* Small Card: Oral (1x1) */}
                    <button 
                        onClick={() => setMode('ORAL')}
                        className="bg-gradient-to-br from-blue-600/20 to-blue-900/40 border border-blue-500/30 chamfer-lg p-6 flex flex-col items-center justify-center text-center group hover:bg-blue-600/30 transition-all"
                    >
                        <i className="fas fa-microphone text-4xl text-blue-400 mb-4 group-hover:scale-110 transition-transform"></i>
                        <h3 className="text-lg font-black text-white uppercase">Vấn đáp AI</h3>
                        <p className="text-[9px] text-blue-200/60 font-bold uppercase tracking-widest mt-1">Chấm điểm giọng nói</p>
                    </button>

                    {/* Small Card: Flashcard (1x1) */}
                    <button 
                        onClick={() => setMode('FLASHCARD')}
                        className="bg-gradient-to-br from-purple-600/20 to-purple-900/40 border border-purple-500/30 chamfer-lg p-6 flex flex-col items-center justify-center text-center group hover:bg-purple-600/30 transition-all"
                    >
                        <i className="fas fa-clone text-4xl text-purple-400 mb-4 group-hover:scale-110 transition-transform"></i>
                        <h3 className="text-lg font-black text-white uppercase">Thẻ nhớ</h3>
                        <p className="text-[9px] text-purple-200/60 font-bold uppercase tracking-widest mt-1">Active Recall</p>
                    </button>

                </div>
            </div>
        )}
        
        {loading && <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-3xl text-green-500"></i></div>}
      </div>
    </div>
  );
};

export default GameQuiz;
