
import React, { useState, useEffect, useRef } from 'react';
import { Question, QuestionType } from '../../types';
import { formatContent } from '../../utils/textFormatter';
import SummaryReview from './shared/SummaryReview';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface TimedChallengeGameProps {
  questions: Question[];
  onExit: () => void;
}

const TimedChallengeGame: React.FC<TimedChallengeGameProps> = ({ questions, onExit }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameState, setGameState] = useState<'PLAYING' | 'SUMMARY'>('PLAYING');
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [essayInput, setEssayInput] = useState('');
  const timerRef = useRef<any>(null);

  // Tích hợp hook giọng nói cho các câu tự luận nếu cần (hoặc nhập liệu văn bản)
  const { 
    isRecording, 
    transcript, 
    toggleRecording, 
    stopRecording, 
    resetTranscript 
  } = useSpeechRecognition('vi-VN');

  useEffect(() => {
    if (gameState === 'PLAYING') {
      startTimer();
    }
    return () => clearInterval(timerRef.current);
  }, [currentIdx, gameState]);

  useEffect(() => {
    if (transcript) setEssayInput(transcript);
  }, [transcript]);

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAnswer("Hết thời gian");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswer = (val: any) => {
    const nextAnswers = [...userAnswers, val];
    setUserAnswers(nextAnswers);
    stopRecording();
    resetTranscript();
    
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
      setEssayInput('');
      setTimeLeft(60);
    } else {
      setGameState('SUMMARY');
    }
  };

  if (gameState === 'SUMMARY') {
    return (
      <div className="min-h-full bg-slate-950 p-8 overflow-y-auto custom-scrollbar">
        <SummaryReview questions={questions} userAnswers={userAnswers} onExit={onExit} />
      </div>
    );
  }

  const currentQ = questions[currentIdx];

  return (
    <div className="min-h-full bg-slate-950 text-white flex flex-col font-inter">
      <header className="p-6 flex justify-between border-b border-white/10 items-center">
        <div className="font-black text-xs uppercase tracking-widest text-slate-400">
          CÂU {currentIdx + 1} / {questions.length}
        </div>
        <div className="text-orange-500 font-black text-3xl tabular-nums animate-pulse">
          {timeLeft}S
        </div>
        <button onClick={onExit} className="text-white/40 hover:text-white transition">
          <i className="fas fa-times"></i>
        </button>
      </header>
      
      <main className="flex-1 p-8 flex flex-col items-center justify-center max-w-4xl mx-auto w-full overflow-y-auto custom-scrollbar">
        <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 w-full mb-10 shadow-2xl relative">
          <div className="text-2xl md:text-3xl font-black text-center leading-relaxed">
            {formatContent(currentQ.content)}
          </div>
          
          {/* Hiển thị ảnh minh họa - Fix: use currentQ.image instead of imageUrl */}
          {currentQ.image && (
            <div className="mt-8 flex justify-center">
                <img 
                    src={currentQ.image} 
                    alt="Minh họa câu hỏi" 
                    className="max-h-64 object-contain rounded-xl mx-auto my-4 shadow-md border border-white/10" 
                />
            </div>
          )}
        </div>

        {currentQ.type === QuestionType.MULTIPLE_CHOICE ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {currentQ.options?.map((opt, i) => (
              <button 
                key={i} 
                onClick={() => handleAnswer(opt)} 
                className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-blue-600 hover:border-blue-400 hover:scale-[1.02] active:scale-95 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black group-hover:bg-white group-hover:text-blue-600 transition">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div className="flex-1 text-sm font-bold">
                    {formatContent(opt)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="w-full space-y-6">
            <div className="relative">
              <textarea 
                value={essayInput} 
                onChange={e => setEssayInput(e.target.value)} 
                placeholder="Nhập câu trả lời hoặc nhấn Mic để nói..."
                className="w-full h-48 bg-white/5 border border-white/10 rounded-[2rem] p-8 text-lg font-medium outline-none focus:border-blue-500 transition-all resize-none shadow-inner" 
              />
              <button 
                onClick={toggleRecording}
                className={`absolute bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}`}
              >
                <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
              </button>
            </div>
            <button 
              onClick={() => handleAnswer(essayInput)} 
              className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95"
            >
              NỘP BÀI <i className="fas fa-paper-plane ml-2"></i>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default TimedChallengeGame;
