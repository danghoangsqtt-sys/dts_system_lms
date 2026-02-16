
import React, { useState, useEffect } from 'react';
import { Question, QuestionFolder } from '../../types';
import AIGeneratorTab from './AIGeneratorTab';
import ManualCreatorTab from './ManualCreatorTab';
import ReviewList from './ReviewList';
import { Link } from 'react-router-dom';

interface QuestionGeneratorProps {
  folders: QuestionFolder[];
  onSaveQuestions: (questions: Question[]) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type TabMode = 'AI' | 'MANUAL';

const QuestionGenerator: React.FC<QuestionGeneratorProps> = ({ folders, onSaveQuestions, onNotify }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('AI');
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('default');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const key = localStorage.getItem('USER_GEMINI_KEY');
    setHasApiKey(!!key);
  }, []);

  const handleQuestionsGenerated = (questions: Question[]) => {
    setPendingQuestions(questions);
    setIsPreviewMode(true);
  };

  const handleSingleQuestionCreated = (question: Question) => {
    setPendingQuestions(prev => [...prev, question]);
    setIsPreviewMode(true);
  };

  const handleUpdatePending = (index: number, updated: Question) => {
    const newList = [...pendingQuestions];
    newList[index] = updated;
    setPendingQuestions(newList);
  };

  const handleRemovePending = (index: number) => {
    const newList = pendingQuestions.filter((_, i) => i !== index);
    setPendingQuestions(newList);
    if (newList.length === 0) setIsPreviewMode(false);
  };

  const handleSaveFinal = () => {
    onSaveQuestions(pendingQuestions);
    setPendingQuestions([]);
    setIsPreviewMode(false);
    onNotify(`Đã lưu ${pendingQuestions.length} câu hỏi mới vào hệ thống.`, "success");
  };

  if (!hasApiKey && activeTab === 'AI') {
    return (
        <div className="h-full flex items-center justify-center p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm max-w-4xl mx-auto">
            <div className="text-center space-y-8">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">
                    <i className="fas fa-key"></i>
                </div>
                <div className="space-y-3">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Thiếu cấu hình AI</h2>
                    <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed">Để sử dụng tính năng Biên soạn AI, bạn cần nhập Google Gemini API Key của mình vào phần cấu hình hệ thống.</p>
                </div>
                <Link to="/settings" className="inline-flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all">
                    Đi tới Cấu hình ngay <i className="fas fa-arrow-right"></i>
                </Link>
            </div>
        </div>
    );
  }

  if (isPreviewMode) {
    return (
      <ReviewList 
        questions={pendingQuestions}
        folders={folders}
        selectedFolderId={selectedFolderId}
        onUpdateQuestion={handleUpdatePending}
        onRemoveQuestion={handleRemovePending}
        onApproveAll={handleSaveFinal}
        onCancel={() => { setPendingQuestions([]); setIsPreviewMode(false); }}
      />
    );
  }

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 max-w-6xl mx-auto flex flex-col h-[780px] overflow-hidden animate-fade-in-up">
      <div className="p-10 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 shrink-0 gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-3">Biên soạn học liệu AI</h2>
          <p className="text-slate-500 text-sm font-medium italic flex items-center gap-2">
            <i className="fas fa-microchip text-blue-500"></i> Sử dụng Trí tuệ nhân tạo để tự động hóa quy trình
          </p>
        </div>
        
        <div className="flex bg-gray-100/80 p-1.5 rounded-[1.8rem] border border-gray-200">
          <button onClick={() => setActiveTab('AI')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'AI' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Phân tích PDF</button>
          <button onClick={() => setActiveTab('MANUAL')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Nhập liệu & Ảnh</button>
        </div>
      </div>

      <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
        {activeTab === 'AI' ? (
          <AIGeneratorTab folders={folders} selectedFolderId={selectedFolderId} onQuestionsGenerated={handleQuestionsGenerated} onNotify={onNotify} isLoading={isLoading} setIsLoading={setIsLoading} />
        ) : (
          <ManualCreatorTab folders={folders} selectedFolderId={selectedFolderId} onQuestionCreated={handleSingleQuestionCreated} onQuestionsGenerated={handleQuestionsGenerated} onNotify={onNotify} isLoading={isLoading} setIsLoading={setIsLoading} />
        )}
      </div>
    </div>
  );
};

export default QuestionGenerator;
