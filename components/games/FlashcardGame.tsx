
import React, { useState } from 'react';
import { Question, QuestionType } from '../../types';
import { formatContent } from '../../utils/textFormatter';

interface FlashcardGameProps {
  questions: Question[];
  onExit: () => void;
}

const FlashcardGame: React.FC<FlashcardGameProps> = ({ questions, onExit }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentIdx(prev => (prev + 1) % questions.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentIdx(prev => (prev - 1 + questions.length) % questions.length);
    }, 150);
  };

  const currentQ = questions[currentIdx];

  return (
    <div className="min-h-full bg-slate-950 text-white p-6 md:p-10 flex flex-col items-center justify-center font-inter">
      <header className="w-full max-w-2xl flex justify-between items-center mb-10">
          <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Smart Flashcards</div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{currentIdx + 1} / {questions.length}</div>
          <button onClick={onExit} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500 transition-all">
            <i className="fas fa-times"></i>
          </button>
      </header>

      <div 
        className="w-full max-w-2xl aspect-[4/3] relative perspective-1000 group cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Mặt trước: Câu hỏi */}
          <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-[3.5rem] p-12 flex flex-col items-center justify-center text-slate-900 border-4 border-blue-500/20 shadow-2xl overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
             <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-8">Câu hỏi / Khái niệm</p>
             <div className="text-2xl md:text-3xl font-black text-center leading-tight">
                {formatContent(currentQ.content)}
             </div>
             {currentQ.image && (
                <img src={currentQ.image} alt="Minh họa" className="mt-8 max-h-48 object-contain rounded-xl shadow-md border border-slate-100" />
             )}
             <p className="mt-auto text-[9px] font-black text-slate-300 uppercase tracking-widest">Chạm để xem đáp án</p>
          </div>

          {/* Mặt sau: Đáp án */}
          <div className="absolute inset-0 w-full h-full backface-hidden bg-slate-900 rotate-y-180 rounded-[3.5rem] p-12 flex flex-col items-center justify-center text-white border-4 border-green-500/20 shadow-2xl overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
             <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.4em] mb-8">Đáp án chuẩn</p>
             <div className="text-xl md:text-2xl font-bold text-center leading-relaxed text-green-50">
                {formatContent(currentQ.correctAnswer)}
             </div>
             {currentQ.explanation && (
                 <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/5 text-[11px] text-slate-400 italic text-center max-w-sm">
                    {currentQ.explanation}
                 </div>
             )}
             <p className="mt-auto text-[9px] font-black text-white/20 uppercase tracking-widest">Chạm để quay lại</p>
          </div>

        </div>
      </div>

      <div className="mt-12 flex gap-6 items-center">
          <button onClick={handlePrev} className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-blue-600 transition-all active:scale-90">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="px-10 py-4 bg-white/5 rounded-full border border-white/10 font-black text-xs uppercase tracking-widest">
            Level: {currentQ.bloomLevel}
          </div>
          <button onClick={handleNext} className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-blue-600 transition-all active:scale-90">
            <i className="fas fa-arrow-right"></i>
          </button>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};

export default FlashcardGame;
