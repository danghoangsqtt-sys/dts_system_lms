import React, { useState, useEffect } from 'react';
import { Question, QuestionFolder } from '../../types';
import AIGeneratorTab from './AIGeneratorTab';
import ManualCreatorTab from './ManualCreatorTab';
import ReviewList from './ReviewList';
import { Link } from 'react-router-dom';
import { databases, APPWRITE_CONFIG, ID, Query } from '../../lib/appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databaseService } from '../../services/databaseService';

interface QuestionGeneratorProps {
  folders: QuestionFolder[];
  onSaveQuestions: (questions: Question[]) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type TabMode = 'AI' | 'MANUAL';

const QuestionGenerator: React.FC<QuestionGeneratorProps> = ({ folders, onSaveQuestions, onNotify }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabMode>('AI');
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('default');
  
  // State to hold unique folder names fetched from DB
  const [availableFolders, setAvailableFolders] = useState<string[]>(['Mặc định']);

  // Fetch existing folders to provide suggestions
  useEffect(() => {
      const fetchFolders = async () => {
          if (!user?.id) return;
          try {
              const questions = await databaseService.fetchQuestions(user.id);
              const folders = new Set(questions.map(q => q.folder || 'Mặc định'));
              setAvailableFolders(Array.from(folders).sort());
          } catch (e) {
              console.warn("Failed to fetch existing folders", e);
          }
      };
      fetchFolders();
  }, [user]);

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

  const handleSaveFinal = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        await databaseService.bulkInsertQuestions(pendingQuestions, user.id);

        onSaveQuestions(pendingQuestions);
        setPendingQuestions([]);
        setIsPreviewMode(false);
        onNotify(`Đã lưu ${pendingQuestions.length} câu hỏi mới vào Ngân hàng dữ liệu Cloud.`, "success");
    } catch (err: any) {
        onNotify(`Lỗi lưu trữ: ${err.message}`, "error");
    } finally {
        setIsLoading(false);
    }
  };

  if (isPreviewMode) {
    return (
      <ReviewList 
        questions={pendingQuestions}
        folders={folders} // Note: ReviewList might still use old folderId logic for display, but that's acceptable for now as we transition.
        selectedFolderId={selectedFolderId}
        onUpdateQuestion={handleUpdatePending}
        onRemoveQuestion={handleRemovePending}
        onApproveAll={handleSaveFinal}
        onCancel={() => { setPendingQuestions([]); setIsPreviewMode(false); }}
      />
    );
  }

  return (
    <div className="bg-white chamfer-xl chamfer-shadow border border-slate-100 max-w-7xl mx-auto flex h-[800px] overflow-hidden animate-fade-in-up">
      <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 p-6">
        <div className="mb-8">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Studio Soạn thảo</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Trợ lý AI Đa năng</p>
        </div>

        <nav className="flex-1 space-y-2">
            <button onClick={() => setActiveTab('AI')} className={`w-full text-left px-5 py-4 chamfer-sm font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'AI' ? 'bg-[#14452F] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}><i className="fas fa-wand-magic-sparkles"></i> AI Tự động</button>
            <button onClick={() => setActiveTab('MANUAL')} className={`w-full text-left px-5 py-4 chamfer-sm font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'MANUAL' ? 'bg-[#14452F] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}><i className="fas fa-keyboard"></i> Nhập thủ công</button>
        </nav>

        <div className="bg-[#E8F5E9] p-4 chamfer-md border border-[#14452F]/10 mt-auto">
            <p className="text-[9px] font-bold text-[#14452F] uppercase mb-1">Trạng thái</p>
            <div className="flex items-center gap-2 text-xs font-bold text-[#14452F]">
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
                {isLoading ? 'Đang xử lý...' : 'Sẵn sàng'}
            </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
            {activeTab === 'AI' ? (
            <AIGeneratorTab 
                folders={folders} 
                availableFolders={availableFolders}
                onQuestionsGenerated={handleQuestionsGenerated} 
                onNotify={onNotify} 
                isLoading={isLoading} 
                setIsLoading={setIsLoading} 
            />
            ) : (
            <ManualCreatorTab 
                folders={folders} 
                availableFolders={availableFolders}
                onQuestionCreated={handleSingleQuestionCreated} 
                onQuestionsGenerated={handleQuestionsGenerated} 
                onNotify={onNotify} 
                isLoading={isLoading} 
                setIsLoading={setIsLoading} 
            />
            )}
        </div>
      </div>
    </div>
  );
};

export default QuestionGenerator;