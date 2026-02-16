
import React, { useState, useMemo, useEffect } from 'react';
import { Question } from '../../types';
import { formatContent } from '../../utils/textFormatter';

interface MillionaireGameProps {
  questions: Question[];
  onExit: () => void;
}

const MONEY_PYRAMID = [
  "150.000.000", "85.000.000", "50.000.000", "35.000.000", "22.000.000",
  "14.000.000", "10.000.000", "6.000.000", "3.000.000", "2.000.000",
  "1.000.000", "600.000", "400.000", "200.000", "100.000"
];

type LifelineType = 'FIFTY' | 'PHONE' | 'AUDIENCE' | 'CONSULT';

const MillionaireGame: React.FC<MillionaireGameProps> = ({ questions, onExit }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'PLAYING' | 'CHECKING' | 'CORRECT' | 'WRONG' | 'WIN'>('PLAYING');
  const [showResultModal, setShowResultModal] = useState(false);
  
  // Lifelines State
  const [lifelines, setLifelines] = useState({
    fifty: true,
    phone: true,
    audience: true,
    consult: true
  });
  const [hiddenOptions, setHiddenOptions] = useState<string[]>([]);
  const [activeLifeline, setActiveLifeline] = useState<{ type: LifelineType, data: any } | null>(null);

  // Logic tính tiền thưởng đã đạt được
  const achievedPrize = useMemo(() => {
    if (currentIdx === 0) return "0";
    return MONEY_PYRAMID[MONEY_PYRAMID.length - currentIdx];
  }, [currentIdx]);

  // Get current question with safety fallback
  const currentQ = useMemo(() => {
    const q = questions[currentIdx] || questions[0];
    const options = q.options && q.options.length >= 4 ? q.options : ['A', 'B', 'C', 'D'];
    return { ...q, options };
  }, [questions, currentIdx]);

  const handleSelect = (ans: string) => {
    if (gameState !== 'PLAYING') return;
    setSelectedAns(ans);
    setGameState('CHECKING');
    
    // Dramatic pause like the MC
    setTimeout(() => {
        if (ans === currentQ.correctAnswer) {
            setGameState('CORRECT');
        } else {
            setGameState('WRONG');
        }
        setTimeout(() => setShowResultModal(true), 1200);
    }, 2000);
  };

  const handleNextQuestion = () => {
    setShowResultModal(false);
    if (currentIdx + 1 < questions.length && currentIdx + 1 < MONEY_PYRAMID.length) {
        setCurrentIdx(prev => prev + 1);
        setSelectedAns(null);
        setHiddenOptions([]);
        setGameState('PLAYING');
    } else {
        setGameState('WIN');
    }
  };

  // --- LIFELINES LOGIC ---
  const useLifeline = (type: LifelineType) => {
    if (!lifelines[type.toLowerCase() as keyof typeof lifelines] || gameState !== 'PLAYING') return;

    setLifelines(prev => ({ ...prev, [type.toLowerCase()]: false }));

    if (type === 'FIFTY') {
      const incorrectOptions = currentQ.options.filter(opt => opt !== currentQ.correctAnswer);
      const toHide = [...incorrectOptions].sort(() => 0.5 - Math.random()).slice(0, 2);
      setHiddenOptions(toHide);
    } else if (type === 'PHONE') {
      const isCorrect = Math.random() > 0.2; 
      const advice = isCorrect 
        ? `Tớ vừa tra cứu xong, câu này chắc chắn là: "${currentQ.correctAnswer}". Đáp án này chuẩn 100%!` 
        : `Câu này khó quá, tớ không chắc nhưng có lẽ là: "${currentQ.options.find(o => o !== currentQ.correctAnswer)}".`;
      setActiveLifeline({ type, data: advice });
    } else if (type === 'AUDIENCE') {
      const results: Record<string, number> = {};
      let remaining = 100;
      currentQ.options.forEach(opt => {
        const weight = opt === currentQ.correctAnswer ? 55 : 15;
        const val = Math.min(remaining, Math.floor(Math.random() * weight) + 5);
        results[opt] = val;
        remaining -= val;
      });
      results[currentQ.correctAnswer] += remaining;
      setActiveLifeline({ type, data: results });
    } else if (type === 'CONSULT') {
      const team = [
        { name: "Chuyên gia Điện", choice: currentQ.correctAnswer },
        { name: "Kỹ sư HSE", choice: currentQ.correctAnswer },
        { name: "Sinh viên ưu tú", choice: currentQ.options.find(o => o !== currentQ.correctAnswer) || "?" }
      ];
      setActiveLifeline({ type, data: team });
    }
  };

  if (gameState === 'WIN') {
    return (
        <div className="min-h-full bg-[#020b2c] flex flex-col items-center justify-center text-center p-10 space-y-8 animate-fade-in">
            <div className="w-44 h-44 bg-yellow-400 rounded-full flex items-center justify-center text-slate-900 text-7xl shadow-[0_0_80px_rgba(250,204,21,0.6)] animate-bounce">
                <i className="fas fa-trophy"></i>
            </div>
            <div className="space-y-4">
                <h2 className="text-7xl font-black text-white tracking-tighter uppercase">PHI THƯỜNG!</h2>
                <p className="text-2xl font-bold text-blue-400">CHÚC MỪNG TÂN TRIỆU PHÚ TRI THỨC</p>
            </div>
            <p className="text-yellow-400 text-4xl font-black tracking-widest bg-yellow-400/10 px-12 py-6 rounded-full border border-yellow-400/30">
                THƯỞNG: {MONEY_PYRAMID[0]} VNĐ
            </p>
            <button onClick={onExit} className="px-16 py-6 bg-white text-slate-900 rounded-[2.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-600 hover:text-white transition-all transform hover:scale-105 active:scale-95">QUAY LẠI TRUNG TÂM</button>
        </div>
    );
  }

  return (
    <div className="h-full bg-[#020b2c] text-white flex overflow-hidden font-inter relative select-none">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.1),transparent)] pointer-events-none"></div>

      {/* LEFT: MAIN GAME AREA (75%) */}
      <div className="flex-[3] flex flex-col relative z-10 border-r border-white/5 overflow-hidden">
        {/* TOP BAR: LIFELINES */}
        <header className="p-6 flex justify-between items-center bg-black/30 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center shadow-lg border border-white/10">
                  <i className="fas fa-coins text-xl text-yellow-400"></i>
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tighter uppercase leading-none">AI LÀ TRIỆU PHÚ</h1>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">Học phần: Nguồn điện an toàn & Môi trường</p>
              </div>
            </div>

            <div className="flex gap-4">
                <LifelineButton active={lifelines.fifty} onClick={() => useLifeline('FIFTY')} icon="fa-divide" label="50:50" />
                <LifelineButton active={lifelines.phone} onClick={() => useLifeline('PHONE')} icon="fa-phone-volume" label="Gọi điện" />
                <LifelineButton active={lifelines.audience} onClick={() => useLifeline('AUDIENCE')} icon="fa-users" label="Khán giả" />
                <LifelineButton active={lifelines.consult} onClick={() => useLifeline('CONSULT')} icon="fa-user-group" label="Tư vấn" />
            </div>

            <button onClick={onExit} className="px-6 py-2 rounded-xl bg-white/5 text-slate-400 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                Dừng chơi
            </button>
        </header>

        {/* MIDDLE: QUESTION & ANSWERS */}
        <main className="flex-1 flex flex-col items-center justify-center px-12 py-10 space-y-16 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar">
            
            {/* Logo Placeholder / Center Ornament */}
            <div className="w-48 h-48 rounded-full border-4 border-blue-500/20 flex items-center justify-center opacity-30 animate-pulse relative shrink-0">
                <div className="absolute inset-0 border-2 border-dashed border-blue-400/30 rounded-full animate-spin-slow"></div>
                <i className="fas fa-graduation-cap text-6xl text-blue-400"></i>
            </div>

            {/* Question Container */}
            <div className="w-full relative animate-fade-in-up">
                {/* Floating Question Index */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-blue-900/90 px-8 py-2 rounded-full text-[12px] font-black text-yellow-400 uppercase tracking-[0.4em] border border-yellow-500/40 z-[100] shadow-[0_0_20px_rgba(234,179,8,0.2)] backdrop-blur-sm">
                    CÂU HỎI {currentIdx + 1}
                </div>

                {/* Horizontal Connector Lines */}
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent -z-10"></div>
                
                {/* Question Box (Hexagonal Style) */}
                <div 
                    className="bg-[#0c142b] border-2 border-blue-500/60 p-8 md:p-12 text-center shadow-[0_0_80px_rgba(37,99,235,0.15)] relative overflow-visible mt-4"
                    style={{ clipPath: 'polygon(2% 0, 98% 0, 100% 50%, 98% 100%, 2% 100%, 0 50%)' }}
                >
                    <div className="text-lg md:text-xl font-bold leading-relaxed text-white tracking-tight math-content px-10 py-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                        {formatContent(currentQ.content)}
                    </div>
                </div>
            </div>

            {/* Answers Grid (2x2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 w-full items-stretch">
                {currentQ.options.map((opt, i) => {
                    const isHidden = hiddenOptions.includes(opt);
                    const letter = String.fromCharCode(65 + i);
                    
                    let btnStyle = "bg-[#0c142b] border-blue-500/30 text-slate-300 hover:bg-blue-600/10 hover:border-blue-500 hover:text-white shadow-lg";
                    
                    if (selectedAns === opt) {
                        if (gameState === 'CHECKING') btnStyle = "bg-yellow-500 border-yellow-400 text-slate-900 animate-pulse shadow-[0_0_40px_rgba(234,179,8,0.4)]";
                        if (gameState === 'CORRECT') btnStyle = "bg-green-600 border-green-400 text-white shadow-[0_0_50px_rgba(34,197,94,0.5)]";
                        if (gameState === 'WRONG') btnStyle = "bg-red-600 border-red-400 text-white shadow-[0_0_50px_rgba(220,38,38,0.5)]";
                    } else if (gameState === 'WRONG' && opt === currentQ.correctAnswer) {
                        btnStyle = "bg-green-600 border-green-400 text-white animate-pulse shadow-[0_0_50px_rgba(34,197,94,0.5)]";
                    }

                    return (
                        <button 
                            key={i} 
                            onClick={() => handleSelect(opt)}
                            disabled={gameState !== 'PLAYING' || isHidden}
                            className={`py-4 px-8 border-2 transition-all text-left flex items-center gap-5 group relative rounded-2xl min-h-[90px] h-auto whitespace-normal break-words ${btnStyle} ${isHidden ? 'opacity-0 pointer-events-none translate-y-4' : 'animate-fade-in-up hover:scale-[1.01]'} [animation-delay:${i*0.1}s]`}
                        >
                            <span className="text-yellow-500 font-black text-sm shrink-0 border-r border-white/10 pr-4">{letter}</span>
                            <div className="font-bold text-sm md:text-base flex-1 leading-tight py-1">
                                {formatContent(opt)}
                            </div>
                        </button>
                    );
                })}
            </div>
        </main>
      </div>

      {/* RIGHT: MONEY PYRAMID (25%) */}
      <div className="flex-1 bg-black/40 backdrop-blur-xl flex flex-col p-8 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-900/5 pointer-events-none"></div>
          
          <div className="text-center mb-10 border-b border-white/5 pb-8">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-2 leading-none">Bậc thang điểm thưởng</p>
              <h3 className="text-2xl font-black text-white tracking-tighter">LEVEL {currentIdx + 1}</h3>
          </div>

          <div className="flex-1 flex flex-col-reverse justify-between py-2 overflow-y-auto custom-scrollbar pr-2">
              {MONEY_PYRAMID.slice().reverse().map((amount, i) => {
                  const idx = MONEY_PYRAMID.length - 1 - i;
                  const isCurrent = idx === currentIdx;
                  const isPassed = idx < currentIdx;
                  const isMilestone = (idx + 1) % 5 === 0;

                  return (
                    <div 
                        key={i} 
                        className={`flex items-center gap-5 px-6 py-3 rounded-2xl transition-all duration-700 relative group ${
                            isCurrent 
                                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white scale-110 shadow-2xl translate-x-3 z-10' 
                                : isPassed 
                                    ? 'text-green-500 font-bold opacity-80' 
                                    : isMilestone ? 'text-yellow-400 font-black scale-[1.02]' : 'text-slate-500'
                        }`}
                    >
                        {isCurrent && (
                            <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse"></div>
                        )}
                        <span className="text-[11px] font-black w-6 text-center shrink-0">{idx + 1}</span>
                        <div className={`h-[1px] flex-1 ${isCurrent ? 'bg-white/30' : 'bg-white/5'}`}></div>
                        <span className="text-sm font-black tracking-widest tabular-nums">{amount}</span>
                        {isCurrent && <i className="fas fa-caret-left animate-bounce-x text-white text-lg"></i>}
                    </div>
                  );
              })}
          </div>

          <div className="mt-10 pt-8 border-t border-white/5">
              <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/5 rounded-3xl p-6 border border-blue-500/20 shadow-inner">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <i className="fas fa-vault"></i> Tích lũy an toàn
                  </p>
                  <p className="text-3xl font-black text-white tabular-nums tracking-tighter">
                    {achievedPrize} <span className="text-xs text-slate-500 font-medium tracking-normal ml-1">VNĐ</span>
                  </p>
              </div>
          </div>
      </div>

      {/* RESULT MODAL WITH EXPLANATION */}
      {showResultModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-2xl animate-fade-in">
              <div className="bg-[#0c142b] w-full max-w-2xl rounded-[4rem] border-2 border-blue-500/40 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] p-12 flex flex-col text-center space-y-10 animate-fade-in-up relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                  
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto text-4xl shadow-2xl ${gameState === 'CORRECT' ? 'bg-green-600 text-white shadow-green-500/30' : 'bg-red-600 text-white shadow-red-500/30'}`}>
                      <i className={`fas ${gameState === 'CORRECT' ? 'fa-check' : 'fa-times'}`}></i>
                  </div>
                  
                  <div className="space-y-3">
                      <h3 className={`text-5xl font-black tracking-tighter uppercase ${gameState === 'CORRECT' ? 'text-green-500' : 'text-red-500'}`}>
                          {gameState === 'CORRECT' ? 'CHÍNH XÁC!' : 'SAI MẤT RỒI!'}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.4em] leading-none">Phân tích chuyên môn từ hệ thống</p>
                  </div>

                  <div className="bg-white/5 p-8 rounded-[3rem] border border-white/5 text-left space-y-5 shadow-inner">
                      <div className="flex justify-between items-center pb-4 border-b border-white/10">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Phương án đúng:</span>
                          <span className="text-green-400 font-black text-xl">{currentQ.correctAnswer}</span>
                      </div>
                      <div className="text-slate-300 font-medium leading-relaxed italic text-base">
                          {currentQ.explanation ? formatContent(currentQ.explanation) : "Nội dung này yêu cầu kiến thức nền tảng về an toàn điện và các tiêu chuẩn bảo vệ môi trường trong ngành năng lượng."}
                      </div>
                  </div>

                  {gameState === 'CORRECT' ? (
                      <button 
                        onClick={handleNextQuestion}
                        className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-3xl font-black uppercase text-sm tracking-[0.3em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 hover:scale-[1.02] hover:shadow-blue-500/20"
                      >
                        SANG CÂU TIẾP THEO <i className="fas fa-arrow-right animate-bounce-x"></i>
                      </button>
                  ) : (
                      <button 
                        onClick={onExit}
                        className="w-full py-6 bg-white text-slate-900 rounded-3xl font-black uppercase text-sm tracking-[0.3em] shadow-xl transition-all active:scale-95 hover:bg-slate-200"
                      >
                        KẾT THÚC VÒNG CHƠI
                      </button>
                  )}
              </div>
          </div>
      )}

      {/* LIFELINE FEEDBACK OVERLAYS */}
      {activeLifeline && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-slate-900 w-full max-w-lg rounded-[4rem] border-2 border-yellow-500/40 shadow-[0_40px_100px_rgba(0,0,0,0.6)] p-12 space-y-10 animate-fade-in-up relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-400/10 rounded-full blur-3xl"></div>
                
                <div className="flex items-center gap-6 border-b border-white/10 pb-8">
                    <div className="w-16 h-16 bg-yellow-500 text-slate-900 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-yellow-500/20">
                        <i className={`fas ${activeLifeline.type === 'PHONE' ? 'fa-phone-volume' : activeLifeline.type === 'AUDIENCE' ? 'fa-users' : 'fa-user-group'}`}></i>
                    </div>
                    <div>
                        <h4 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Trợ giúp</h4>
                        <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mt-2">Dữ liệu từ hệ thống hỗ trợ</p>
                    </div>
                </div>

                <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/5 text-lg font-bold leading-relaxed text-blue-50 italic shadow-inner">
                    {activeLifeline.type === 'PHONE' ? (
                        <p>"{activeLifeline.data}"</p>
                    ) : activeLifeline.type === 'CONSULT' ? (
                        <div className="space-y-5 not-italic">
                            {activeLifeline.data.map((p: any, i: number) => (
                                <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <span className="text-slate-400 text-xs font-black uppercase tracking-widest">{p.name}:</span>
                                    <span className="text-blue-400 font-black">Chọn {formatContent(p.choice)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6 not-italic">
                            {Object.entries(activeLifeline.data).map(([key, val]: any) => (
                                <div key={key} className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                                        <span className="truncate max-w-[80%]">Phương án {key}</span>
                                        <span className="text-blue-400">{val}%</span>
                                    </div>
                                    <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                                        <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${val}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button 
                    onClick={() => setActiveLifeline(null)}
                    className="w-full py-5 bg-yellow-500 text-slate-900 rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-xl hover:bg-yellow-400 transition-all active:scale-95"
                >
                    TÔI ĐÃ HIỂU, TIẾP TỤC
                </button>
            </div>
        </div>
      )}

      <style>{`
        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 15s linear infinite;
        }
        .math-content p { display: inline; }
      `}</style>
    </div>
  );
};

const LifelineButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
    <button 
        onClick={onClick}
        disabled={!active}
        className={`flex flex-col items-center gap-2 group transition-all ${!active ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-110 active:scale-90'}`}
        title={label}
    >
        <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-lg transition-all ${active ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 group-hover:bg-blue-600 group-hover:text-white shadow-[0_0_25px_rgba(37,99,235,0.3)]' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
            <i className={`fas ${icon}`}></i>
        </div>
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-400 transition-colors">{label}</span>
    </button>
);

export default MillionaireGame;
