
import React, { useState, useEffect } from 'react';

interface AIThinkingOverlayProps {
  isVisible: boolean;
  taskLabel?: string; // e.g. "Đang trả lời câu hỏi...", "Đang biên soạn đề thi..."
  queuePosition?: number; // Position in queue, if rate limited
  retryAfterMs?: number;  // Retry time from 429
}

const THINKING_STEPS = [
  { icon: '🔍', text: 'Đang phân tích yêu cầu...', duration: 2500 },
  { icon: '📚', text: 'Tra cứu cơ sở tri thức & Google...', duration: 3000 },
  { icon: '🧠', text: 'Tổng hợp và suy luận chuyên sâu...', duration: 4000 },
  { icon: '✍️', text: 'Đang soạn phản hồi chi tiết...', duration: 3500 },
];

const AIThinkingOverlay: React.FC<AIThinkingOverlayProps> = ({
  isVisible,
  taskLabel,
  queuePosition,
  retryAfterMs,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }

    // Animate through thinking steps
    let stepIdx = 0;
    const advanceStep = () => {
      stepIdx = (stepIdx + 1) % THINKING_STEPS.length;
      setCurrentStep(stepIdx);
    };

    const timer = setInterval(advanceStep, THINKING_STEPS[0].duration);
    
    // Progress bar animation
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 92) return 92; // Never reach 100 until real response
        return prev + Math.random() * 3;
      });
    }, 500);

    return () => {
      clearInterval(timer);
      clearInterval(progressTimer);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md mx-4 p-8 chamfer-lg shadow-2xl border border-slate-200 relative overflow-hidden">
        
        {/* Animated top bar */}
        <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-[#14452F] via-emerald-400 to-[#14452F] transition-all duration-700 ease-in-out" 
             style={{ width: `${progress}%` }} />

        {/* Neural pulse animation */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#14452F]/10 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-[#14452F]/20 flex items-center justify-center animate-pulse">
                <span className="text-3xl">{THINKING_STEPS[currentStep]?.icon || '🧠'}</span>
              </div>
            </div>
            {/* Radiating rings */}
            <div className="absolute inset-0 rounded-full border-2 border-[#14452F]/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[-8px] rounded-full border border-[#14452F]/10 animate-ping" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Task label */}
        <p className="text-center text-[10px] font-black text-[#14452F] uppercase tracking-[0.2em] mb-4">
          {taskLabel || 'Trợ lý AI đang xử lý'}
        </p>

        {/* Thinking steps */}
        <div className="space-y-3 mb-6">
          {THINKING_STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2.5 chamfer-sm transition-all duration-500 ${
                i < currentStep
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : i === currentStep
                  ? 'bg-[#14452F]/5 text-[#14452F] border border-[#14452F]/20 scale-[1.02]'
                  : 'bg-slate-50 text-slate-300 border border-slate-100'
              }`}
            >
              <span className="text-base w-6 text-center">{step.icon}</span>
              <span className="text-[11px] font-bold flex-1">{step.text}</span>
              {i < currentStep && (
                <i className="fas fa-check-circle text-emerald-500 text-xs" />
              )}
              {i === currentStep && (
                <div className="w-4 h-4 border-2 border-[#14452F] border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          ))}
        </div>

        {/* Queue info */}
        {queuePosition && queuePosition > 0 && (
          <div className="bg-amber-50 border border-amber-100 chamfer-sm p-3 mb-4 flex items-center gap-3">
            <i className="fas fa-users text-amber-500" />
            <div>
              <p className="text-[10px] font-black text-amber-700 uppercase">Hàng đợi</p>
              <p className="text-[11px] font-bold text-amber-600">
                Vị trí của bạn: <span className="text-amber-800 text-sm">#{queuePosition}</span>
                {retryAfterMs && ` • Ước tính: ~${Math.ceil(retryAfterMs / 1000)}s`}
              </p>
            </div>
          </div>
        )}

        {/* Bottom info */}
        <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest">
          Powered by Gemini 2.5 Flash • DHsystem AI
        </p>
      </div>
    </div>
  );
};

export default AIThinkingOverlay;
