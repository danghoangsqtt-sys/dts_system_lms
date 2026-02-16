
import React, { useState } from 'react';
import { Question } from '../../types';
import { evaluateOralAnswer } from '../../services/geminiService';
import { formatContent } from '../../utils/textFormatter';
import SummaryReview from './shared/SummaryReview';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface OralGameProps {
  questions: Question[];
  onExit: () => void;
}

const OralGame: React.FC<OralGameProps> = ({ questions, onExit }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [gameState, setGameState] = useState<'PLAYING' | 'SUMMARY'>('PLAYING');
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Sử dụng custom hook để quản lý giọng nói tập trung
  const { 
    isRecording, 
    transcript, 
    toggleRecording, 
    stopRecording, 
    resetTranscript, 
    error: speechError 
  } = useSpeechRecognition('vi-VN');

  const handleEvaluate = async () => {
    const finalAnswer = transcript.trim();
    if (!finalAnswer) return;
    
    setIsEvaluating(true);
    stopRecording(); 

    try {
      const currentQ = questions[currentIdx];
      const res = await evaluateOralAnswer(currentQ.content, currentQ.correctAnswer, finalAnswer);
      
      const newScores = [...scores, res.score];
      const newAnswers = [...userAnswers, finalAnswer];
      
      setScores(newScores);
      setUserAnswers(newAnswers);

      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(currentIdx + 1);
        resetTranscript(); 
      } else {
        setGameState('SUMMARY');
      }
    } catch (e) {
      alert("Hệ thống AI đang bận xử lý dữ liệu. Vui lòng thử lại sau.");
    } finally {
      setIsEvaluating(false);
    }
  };

  if (gameState === 'SUMMARY') {
    return (
      <div className="min-h-full bg-slate-950 p-8 overflow-y-auto custom-scrollbar">
        <SummaryReview questions={questions} userAnswers={scores} onExit={onExit} />
      </div>
    );
  }

  const currentQ = questions[currentIdx];

  return (
    <div className="min-h-full bg-slate-950 text-white p-6 md:p-12 flex flex-col items-center justify-center font-inter overflow-y-auto custom-scrollbar relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 animate-pulse"></div>
      
      <div className="w-full max-w-4xl space-y-10 animate-fade-in py-10">
        <header className="flex justify-between items-center mb-4">
           <div>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] block mb-1">AI ORAL EXAMINATION</span>
              <h1 className="text-xl font-black text-white tracking-tighter uppercase">Vấn đáp Chuyên gia AI</h1>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Trình độ hiện tại</span>
              <span className="text-lg font-black text-white tabular-nums">{currentIdx + 1} <span className="text-slate-600">/</span> {questions.length}</span>
           </div>
        </header>

        {/* Question Card */}
        <div className="bg-white/5 border border-white/10 p-12 rounded-[3.5rem] text-center shadow-[0_30px_90px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
          
          <div className="text-3xl md:text-4xl font-black mb-8 leading-tight tracking-tight text-blue-50">
            {formatContent(currentQ.content)}
          </div>
          
          {/* Ảnh minh họa chuyên môn - Fix: use currentQ.image instead of imageUrl */}
          {currentQ.image && (
            <div className="mb-8 flex justify-center animate-fade-in-up">
                <img 
                    src={currentQ.image} 
                    alt="Sơ đồ kỹ thuật" 
                    className="max-h-64 object-contain rounded-3xl shadow-2xl border border-white/10 bg-slate-900 mx-auto my-4 transition-transform group-hover:scale-105 duration-700" 
                />
            </div>
          )}
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 rounded-full border border-blue-500/20">
              <i className="fas fa-robot text-blue-400 text-xs animate-pulse"></i>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none pt-0.5">Giảng viên AI đang sẵn sàng...</p>
          </div>
        </div>

        {/* Voice Feedback Display */}
        <div className="space-y-6">
            <div className="relative group">
               <textarea 
                value={transcript} 
                readOnly
                placeholder="Nhấn Mic và bắt đầu nói để trình bày kiến thức của bạn..."
                className="w-full h-64 bg-white/5 border border-white/10 rounded-[3rem] p-12 text-xl font-medium outline-none focus:border-blue-500/50 transition-all resize-none shadow-inner leading-relaxed text-blue-100/90 italic" 
              />
              {isRecording && (
                  <div className="absolute top-8 right-10 flex items-center gap-3">
                     <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>
                     <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">RECORDING LIVE</span>
                  </div>
              )}
            </div>

            {speechError && (
               <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-xs font-bold text-center animate-shake">
                   <i className="fas fa-exclamation-triangle mr-2"></i> {speechError}
               </div>
            )}

            <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
              <button 
                onClick={toggleRecording} 
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-[0_0_50px_rgba(0,0,0,0.3)] transform active:scale-90 relative ${isRecording ? 'bg-red-500 shadow-red-500/40' : 'bg-blue-600 shadow-blue-600/40 hover:scale-110'}`}
              >
                {isRecording && <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>}
                <i className={`fas ${isRecording ? 'fa-square' : 'fa-microphone'} text-3xl text-white relative z-10`}></i>
              </button>
              
              <button 
                onClick={handleEvaluate} 
                disabled={isEvaluating || !transcript.trim()} 
                className="px-16 py-6 bg-white text-slate-950 rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-2xl transition-all hover:bg-blue-600 hover:text-white transform hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed flex items-center gap-4 group"
              >
                {isEvaluating ? (
                  <i className="fas fa-circle-notch fa-spin"></i>
                ) : (
                  <i className="fas fa-brain group-hover:rotate-12 transition-transform"></i>
                )}
                {isEvaluating ? "AI ĐANG CHẤM ĐIỂM..." : "NỘP BÀI CHẤM ĐIỂM"}
              </button>

              <button 
                onClick={onExit}
                className="text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition"
              >
                Thoát Game
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default OralGame;
