import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Question, QuestionFolder, QuestionType, Exam } from '../types';
import { formatContent } from '../utils/textFormatter';
import ExamCreator from './ExamCreator';
import { databases, APPWRITE_CONFIG, Query, ID } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import { databaseService } from '../services/databaseService';

interface QuestionBankManagerProps {
  folders: QuestionFolder[];
  setFolders: React.Dispatch<React.SetStateAction<QuestionFolder[]>>;
  exams: Exam[];
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  showNotify: (message: string, type: any) => void;
}

const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({ 
  folders, 
  setFolders, 
  exams = [], 
  setExams, 
  showNotify 
}) => {
  const { user } = useAuth();
  const [managerTab, setManagerTab] = useState<'QUESTIONS' | 'EXAMS'>('QUESTIONS');
  const [activeTab, setActiveTab] = useState<QuestionType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [viewScope, setViewScope] = useState<'MINE' | 'PUBLIC'>('MINE');
  const [dbQuestions, setDbQuestions] = useState<Question[]>([]);
  const [dbExams, setDbExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Folder State (Questions)
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL');
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('dts_custom_folders');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  // --- EXAM MANAGER STATE (Task Requirement) ---
  const [examCustomFolders, setExamCustomFolders] = useState<string[]>(() => {
      const saved = localStorage.getItem('dts_exam_folders');
      return saved ? JSON.parse(saved) : [];
  });
  const [selectedExamFolder, setSelectedExamFolder] = useState<string>('ALL');
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [isDeletingExamBulk, setIsDeletingExamBulk] = useState(false);
  const [isExamMoveModalOpen, setIsExamMoveModalOpen] = useState(false);
  const [examTargetMoveFolder, setExamTargetMoveFolder] = useState('');
  const [isMovingExamBulk, setIsMovingExamBulk] = useState(false);

  useEffect(() => {
      localStorage.setItem('dts_custom_folders', JSON.stringify(customFolders));
  }, [customFolders]);

  useEffect(() => { 
      localStorage.setItem('dts_exam_folders', JSON.stringify(examCustomFolders)); 
  }, [examCustomFolders]);

  // Edit State
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Selection & Delete State (Questions)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Bulk Move State (Questions)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveFolder, setTargetMoveFolder] = useState('');
  const [isMovingBulk, setIsMovingBulk] = useState(false);

  const fetchDbQuestions = async () => {
    setLoading(true);
    setSelectedQuestionIds([]); 
    try {
        const queries = []; 
        if (viewScope === 'MINE') {
            queries.push(Query.equal('creator_id', user?.id || ''));
        } else {
            queries.push(Query.equal('is_public_bank', true));
        }
        queries.push(Query.orderDesc('$createdAt'));
        queries.push(Query.limit(100));

        const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.questions,
            queries
        );
        
        const mappedQuestions = response.documents.map(d => {
             let meta: any = {};
             try { meta = JSON.parse(d.metadata || '{}'); } catch(e) {}
             const folder = meta.folder || d.folder_id || 'Mặc định';
             
             return {
                 id: d.$id,
                 content: d.content, 
                 type: d.type as QuestionType,
                 bloom_level: d.bloom_level,
                 category: d.category,
                 is_public_bank: d.is_public_bank,
                 creatorId: d.creator_id,
                 createdAt: new Date(d.$createdAt).getTime(),
                 options: meta.options || [],
                 correctAnswer: meta.correctAnswer,
                 explanation: meta.explanation,
                 image: meta.image,
                 bloomLevel: meta.bloomLevel,
                 folder: folder, 
                 folderId: folder
             } as Question;
        });

        setDbQuestions(mappedQuestions);
    } catch (err: any) {
        showNotify("Lỗi tải câu hỏi: " + err.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const fetchDbExams = async () => {
      setLoading(true);
      setSelectedExamIds([]);
      try {
          const response = await databases.listDocuments(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.exams,
            [Query.equal('creator_id', user?.id || '')]
          );
          
          setDbExams(response.documents.map(d => {
              let config = {};
              try { config = JSON.parse(d.config || '{}'); } catch(e){}
              return {
                  id: d.$id,
                  title: d.title,
                  type: d.type,
                  questionIds: d.question_ids,
                  config: config,
                  sharedWithClassId: d.class_id,
                  creatorId: d.creator_id,
                  createdAt: new Date(d.$createdAt).getTime(),
                  folder: (config as any).folder || 'Mặc định'
              };
          }));
      } catch (err: any) {
          showNotify("Lỗi tải đề thi: " + err.message, 'error');
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    if (user?.id) {
        if (managerTab === 'QUESTIONS') fetchDbQuestions();
        else fetchDbExams();
    }
  }, [viewScope, user, managerTab]);

  const deleteQuestion = async (id: string) => {
      if (!window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
      try {
          await databaseService.deleteQuestion(id);
          setDbQuestions(prev => prev.filter(q => q.id !== id));
          setSelectedQuestionIds(prev => prev.filter(selId => selId !== id));
          showNotify("Đã xóa câu hỏi.", "info");
      } catch (err: any) {
          showNotify("Lỗi xóa: " + err.message, "error");
      }
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingQuestion || !user) return;
      setIsSaving(true);
      try {
          const updated = await databaseService.saveQuestion(editingQuestion, user.id);
          setDbQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
          showNotify("Cập nhật câu hỏi thành công!", "success");
          setEditingQuestion(null);
      } catch (err: any) {
          showNotify("Lỗi cập nhật: " + err.message, "error");
      } finally {
          setIsSaving(false);
      }
  };

  // --- Question Folder Logic ---
  const uniqueFolders = useMemo(() => {
      const dbFolders = new Set(dbQuestions.map(q => q.folder || 'Mặc định'));
      const allFolders = new Set([...Array.from(dbFolders), ...customFolders, 'Mặc định']);
      return ['ALL', ...Array.from(allFolders).sort()];
  }, [dbQuestions, customFolders]);

  const displayQuestions = useMemo(() => {
    return dbQuestions.filter(q => {
        const contentStr = typeof q.content === 'string' ? q.content : (q.content as any).content || '';
        const matchSearch = contentStr.toLowerCase().includes(search.toLowerCase());
        const matchTab = activeTab === 'ALL' || q.type === activeTab;
        const matchFolder = selectedFolder === 'ALL' || (q.folder || 'Mặc định') === selectedFolder;
        return matchSearch && matchTab && matchFolder;
    });
  }, [dbQuestions, search, activeTab, selectedFolder]);

  // --- Exam Folder Logic ---
  const uniqueExamFolders = useMemo(() => {
      const dbFolders = new Set(dbExams.map(e => e.folder || 'Mặc định'));
      const allFolders = new Set([...Array.from(dbFolders), ...examCustomFolders, 'Mặc định']);
      return ['ALL', ...Array.from(allFolders).sort()];
  }, [dbExams, examCustomFolders]);

  const displayExams = useMemo(() => {
      return dbExams.filter(e => {
          const matchSearch = e.title.toLowerCase().includes(search.toLowerCase());
          const matchFolder = selectedExamFolder === 'ALL' || (e.folder || 'Mặc định') === selectedExamFolder;
          return matchSearch && matchFolder;
      });
  }, [dbExams, search, selectedExamFolder]);

  // --- Handlers: Questions Bulk ---
  const handleToggleSelect = (id: string) => setSelectedQuestionIds(prev => prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]);
  const handleToggleSelectAll = (filteredList: Question[]) => {
      const isAllSelected = filteredList.length > 0 && filteredList.every(q => selectedQuestionIds.includes(q.id));
      if (isAllSelected) {
          const idsToDeselect = filteredList.map(q => q.id);
          setSelectedQuestionIds(prev => prev.filter(id => !idsToDeselect.includes(id)));
      } else {
          const newIds = filteredList.map(q => q.id);
          setSelectedQuestionIds(prev => Array.from(new Set([...prev, ...newIds])));
      }
  };

  const handleBulkDelete = async () => {
      if (selectedQuestionIds.length === 0 || !window.confirm(`Xóa vĩnh viễn ${selectedQuestionIds.length} câu hỏi?`)) return;
      setIsDeletingBulk(true);
      try {
          await Promise.all(selectedQuestionIds.map(id => databaseService.deleteQuestion(id)));
          setDbQuestions(prev => prev.filter(q => !selectedQuestionIds.includes(q.id)));
          setSelectedQuestionIds([]);
          showNotify(`Đã xóa ${selectedQuestionIds.length} câu hỏi.`, "success");
      } catch (error: any) { showNotify("Lỗi xóa: " + error.message, "error"); } finally { setIsDeletingBulk(false); }
  };

  const handleBulkMove = async () => {
    if (!targetMoveFolder.trim()) return;
    setIsMovingBulk(true);
    try {
        await Promise.all(selectedQuestionIds.map(id => databaseService.updateQuestion(id, { folder: targetMoveFolder.trim() })));
        setDbQuestions(prev => prev.map(q => selectedQuestionIds.includes(q.id) ? { ...q, folder: targetMoveFolder.trim(), folderId: targetMoveFolder.trim() } : q));
        if (!customFolders.includes(targetMoveFolder.trim())) setCustomFolders(prev => [...prev, targetMoveFolder.trim()]);
        setSelectedQuestionIds([]); setIsMoveModalOpen(false); setTargetMoveFolder('');
        showNotify("Đã di chuyển thành công.", "success");
    } catch (error: any) { showNotify("Lỗi di chuyển: " + error.message, "error"); } finally { setIsMovingBulk(false); }
  };

  // --- Handlers: Exams Bulk ---
  const handleToggleExamSelect = (id: string) => setSelectedExamIds(prev => prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]);
  const handleToggleExamSelectAll = (filteredList: Exam[]) => {
      const isAllSelected = filteredList.length > 0 && filteredList.every(e => selectedExamIds.includes(e.id));
      if (isAllSelected) {
          const idsToDeselect = filteredList.map(e => e.id);
          setSelectedExamIds(prev => prev.filter(id => !idsToDeselect.includes(id)));
      } else {
          const newIds = filteredList.map(e => e.id);
          setSelectedExamIds(prev => Array.from(new Set([...prev, ...newIds])));
      }
  };

  const handleExamBulkDelete = async () => {
      if (selectedExamIds.length === 0 || !window.confirm(`Xóa vĩnh viễn ${selectedExamIds.length} đề thi?`)) return;
      setIsDeletingExamBulk(true);
      try {
          await Promise.all(selectedExamIds.map(id => databaseService.deleteExam(id)));
          setDbExams(prev => prev.filter(e => !selectedExamIds.includes(e.id)));
          setSelectedExamIds([]);
          showNotify(`Đã xóa ${selectedExamIds.length} đề thi.`, "success");
      } catch (error: any) { showNotify("Lỗi xóa: " + error.message, "error"); } finally { setIsDeletingExamBulk(false); }
  };

  const handleExamBulkMove = async () => {
      if (!examTargetMoveFolder.trim()) return;
      setIsMovingExamBulk(true);
      try {
          await Promise.all(selectedExamIds.map(id => databaseService.updateExam(id, { folder: examTargetMoveFolder.trim() })));
          setDbExams(prev => prev.map(e => selectedExamIds.includes(e.id) ? { ...e, folder: examTargetMoveFolder.trim() } : e));
          if (!examCustomFolders.includes(examTargetMoveFolder.trim())) setExamCustomFolders(prev => [...prev, examTargetMoveFolder.trim()]);
          setSelectedExamIds([]); setIsExamMoveModalOpen(false); setExamTargetMoveFolder('');
          showNotify("Đã di chuyển đề thi thành công.", "success");
      } catch (error: any) { showNotify("Lỗi di chuyển: " + error.message, "error"); } finally { setIsMovingExamBulk(false); }
  };

  const handleCreateFolder = () => {
      const folderName = window.prompt('Nhập tên thư mục mới:');
      if (folderName && folderName.trim() !== '') {
          const newName = folderName.trim();
          if (managerTab === 'QUESTIONS') {
              if (!customFolders.includes(newName)) setCustomFolders([...customFolders, newName]);
              setSelectedFolder(newName);
          } else {
              if (!examCustomFolders.includes(newName)) setExamCustomFolders([...examCustomFolders, newName]);
              setSelectedExamFolder(newName);
          }
          showNotify(`Đã tạo thư mục "${newName}"`, "success");
      }
  };

  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [viewingExam, setViewingExam] = useState<Exam | null>(null);

  const handleSaveExamToDb = async (exam: Exam) => {
      try {
          exam.folder = selectedExamFolder !== 'ALL' ? selectedExamFolder : 'Mặc định';
          await databaseService.saveExam(exam, user?.id || '');
          showNotify("Đã lưu đề thi thành công.", "success");
          setIsCreatingExam(false);
          fetchDbExams();
      } catch (err: any) {
          showNotify(`Lỗi lưu đề thi: ${err.message}`, "error");
      }
  };

  if (isCreatingExam || viewingExam) {
    return <ExamCreator 
      questions={dbQuestions} 
      viewExam={viewingExam || undefined}
      onBack={() => { setIsCreatingExam(false); setViewingExam(null); }} 
      onSaveExam={handleSaveExamToDb}
    />;
  }

  return (
    <div className="h-full flex flex-col bg-[#F0F2F5] font-[Roboto] overflow-hidden">
      {/* 1. Global Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-sm z-20 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#14452F] text-white chamfer-sm flex items-center justify-center text-lg">
                <i className={`fas ${managerTab === 'QUESTIONS' ? 'fa-database' : 'fa-file-signature'}`}></i>
            </div>
            <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    {managerTab === 'QUESTIONS' ? 'Ngân hàng câu hỏi' : 'Quản lý Đề thi'}
                </h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Tổng số: <span className="text-[#14452F]">{managerTab === 'QUESTIONS' ? displayQuestions.length : displayExams.length}</span> mục
                </p>
            </div>
        </div>
        <div className="flex bg-slate-100 p-1 chamfer-sm border border-slate-200">
            <button onClick={() => setManagerTab('QUESTIONS')} className={`px-5 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all ${managerTab === 'QUESTIONS' ? 'bg-[#14452F] text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>Kho câu hỏi</button>
            <button onClick={() => setManagerTab('EXAMS')} className={`px-5 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all ${managerTab === 'EXAMS' ? 'bg-[#14452F] text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>Đề thi</button>
        </div>
      </header>

      {/* 2. Main Layout Body (2 Columns) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50">
          
          {/* LEFT SIDEBAR: FOLDERS TREE */}
          <aside className="w-full md:w-72 flex flex-col gap-4 border-r border-slate-200 bg-white pr-0 shrink-0 z-10 h-full">
                <div className="p-6 pb-2">
                    <h3 className="font-black text-[#14452F] uppercase text-xs tracking-widest mb-4">
                        {managerTab === 'QUESTIONS' ? 'Danh mục Câu hỏi' : 'Danh mục Đề thi'}
                    </h3>
                    <button 
                        onClick={handleCreateFolder} 
                        className="w-full py-3 border-2 border-dashed border-[#14452F]/30 text-[#14452F] font-bold text-xs hover:bg-[#14452F]/5 chamfer-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-folder-plus"></i> Tạo thư mục mới
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-1 pb-4">
                    {(managerTab === 'QUESTIONS' ? uniqueFolders : uniqueExamFolders).map(folder => {
                        const isAll = folder === 'ALL';
                        const isSelected = (managerTab === 'QUESTIONS' ? selectedFolder : selectedExamFolder) === folder;
                        
                        return (
                            <button
                                key={folder}
                                onClick={() => managerTab === 'QUESTIONS' ? setSelectedFolder(folder) : setSelectedExamFolder(folder)}
                                className={`w-full text-left px-4 py-3 chamfer-sm text-xs font-bold transition-all flex items-center justify-between group ${
                                    isSelected
                                        ? 'bg-[#14452F] text-white shadow-md'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <span className="truncate">{isAll ? (managerTab === 'QUESTIONS' ? 'Tất cả câu hỏi' : 'Tất cả đề thi') : folder}</span>
                                {isSelected && <i className="fas fa-chevron-right text-[10px]"></i>}
                            </button>
                        );
                    })}
                </div>
                
                <div className="mt-auto px-4 pt-6 pb-4 border-t border-slate-100">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Scope: {viewScope === 'MINE' ? 'Cá nhân' : 'Public'}</span>
                        <i className="fas fa-database"></i>
                    </div>
                </div>
          </aside>

          {/* RIGHT CONTENT: LIST & TOOLS */}
          <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 p-6 overflow-hidden">
             
             {/* Toolbar Section */}
             <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 shrink-0">
                <div className="relative flex-1 max-w-lg w-full">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                    <input 
                        type="text" 
                        placeholder={`Tìm kiếm trong: ${managerTab === 'QUESTIONS' ? selectedFolder : selectedExamFolder}...`} 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 chamfer-sm text-xs font-bold text-slate-700 outline-none focus:border-[#14452F] shadow-sm" 
                    />
                </div>

                {/* BULK ACTIONS */}
                {(managerTab === 'QUESTIONS' ? selectedQuestionIds.length > 0 : selectedExamIds.length > 0) ? (
                    <div className="flex gap-2 animate-fade-in">
                        <button 
                            onClick={() => managerTab === 'QUESTIONS' ? setIsMoveModalOpen(true) : setIsExamMoveModalOpen(true)} 
                            className="bg-[#14452F] text-white px-5 py-3 chamfer-sm text-[10px] font-bold uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all"
                        >
                            Di chuyển ({managerTab === 'QUESTIONS' ? selectedQuestionIds.length : selectedExamIds.length})
                        </button>
                        <button 
                            onClick={() => managerTab === 'QUESTIONS' ? handleBulkDelete() : handleExamBulkDelete()} 
                            disabled={isDeletingBulk || isDeletingExamBulk} 
                            className="bg-red-500 text-white px-5 py-3 chamfer-sm text-[10px] font-bold uppercase tracking-widest shadow-lg hover:bg-red-600 transition-all"
                        >
                            Xóa ({managerTab === 'QUESTIONS' ? selectedQuestionIds.length : selectedExamIds.length})
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                        {managerTab === 'QUESTIONS' && (
                            <div className="flex gap-1 bg-white p-1 chamfer-sm border border-slate-200">
                                {['ALL', QuestionType.MULTIPLE_CHOICE, QuestionType.ESSAY].map(type => (
                                    <button key={type} onClick={() => setActiveTab(type as any)} className={`px-4 py-2 chamfer-sm text-[9px] font-black uppercase transition-all ${activeTab === type ? 'bg-[#14452F] text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                                        {type === 'ALL' ? 'Tất cả' : type === QuestionType.MULTIPLE_CHOICE ? 'TN' : 'TL'}
                                    </button>
                                ))}
                            </div>
                        )}
                        {managerTab === 'EXAMS' && (
                            <button onClick={() => setIsCreatingExam(true)} className="bg-[#14452F] text-white px-6 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] transition-all shadow-lg flex items-center gap-2">
                                <i className="fas fa-plus"></i> Tạo đề mới
                            </button>
                        )}
                    </div>
                )}
             </div>

             {/* Content Grid */}
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-[#14452F]">
                        <i className="fas fa-cog fa-spin text-4xl"></i>
                        <span className="text-xs font-black uppercase tracking-widest">Đang tải dữ liệu...</span>
                    </div>
                ) : managerTab === 'QUESTIONS' ? (
                    <div className="w-full bg-white chamfer-md border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 w-12 text-center"><input type="checkbox" onChange={() => handleToggleSelectAll(displayQuestions)} checked={displayQuestions.length > 0 && displayQuestions.every(q => selectedQuestionIds.includes(q.id))} className="w-4 h-4 accent-[#14452F] cursor-pointer rounded" /></th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung câu hỏi</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Loại</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Mức độ</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Thư mục</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-right">Tác vụ</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {displayQuestions.length === 0 ? (
                                    <tr><td colSpan={6} className="p-10 text-center text-slate-400 text-xs font-bold uppercase">Không tìm thấy dữ liệu</td></tr>
                                ) : (
                                    displayQuestions.map(q => (
                                        <tr key={q.id} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors group ${selectedQuestionIds.includes(q.id) ? 'bg-green-50/40' : ''}`}>
                                            <td className="p-4 text-center"><input type="checkbox" checked={selectedQuestionIds.includes(q.id)} onChange={() => handleToggleSelect(q.id)} className="w-4 h-4 accent-[#14452F] cursor-pointer rounded" /></td>
                                            <td className="p-4">
                                                <div className="text-sm font-medium text-slate-700 line-clamp-2 max-w-2xl leading-relaxed" title={typeof q.content === 'string' ? q.content : ''}>{formatContent(typeof q.content === 'string' ? q.content : (q.content as any).content)}</div>
                                                {/* Hiển thị hình ảnh minh họa nếu câu hỏi có chứa ảnh */}
                                                {q.image && (
                                                    <div className="mt-3 mb-2">
                                                        <img 
                                                            src={q.image} 
                                                            alt="Hình minh họa câu hỏi" 
                                                            className="max-h-32 max-w-full object-contain rounded-md border border-slate-200 shadow-sm"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4"><span className={`text-[9px] font-black px-2 py-1 chamfer-sm uppercase border ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-green-50 text-green-700 border-green-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>{q.type === QuestionType.MULTIPLE_CHOICE ? 'TN' : 'TL'}</span></td>
                                            <td className="p-4 text-xs font-bold text-slate-500">{q.bloomLevel}</td>
                                            <td className="p-4"><div className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 chamfer-sm border border-blue-100 w-fit"><i className="fas fa-folder-open text-[10px]"></i> {q.folder || 'Mặc định'}</div></td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {viewScope === 'MINE' && (
                                                        <>
                                                            <button onClick={() => setEditingQuestion(q)} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-blue-600 hover:text-white transition-all chamfer-sm shadow-sm"><i className="fas fa-pencil-alt text-xs"></i></button>
                                                            <button onClick={() => deleteQuestion(q.id)} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white transition-all chamfer-sm shadow-sm"><i className="fas fa-trash-alt text-xs"></i></button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // EXAM LIST VIEW
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {displayExams.length === 0 ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-200 chamfer-lg">
                                <i className="fas fa-file-signature text-4xl opacity-50"></i>
                                <p className="font-black uppercase tracking-widest text-xs">Chưa có đề thi nào trong thư mục này</p>
                            </div>
                        ) : (
                            displayExams.map(exam => (
                                <div key={exam.id} className={`bg-white p-6 chamfer-md border border-slate-200 hover:border-[#14452F] transition-all cursor-pointer group flex flex-col h-64 justify-between shadow-sm relative ${selectedExamIds.includes(exam.id) ? 'ring-2 ring-[#14452F] bg-green-50/20' : ''}`}>
                                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedExamIds.includes(exam.id)} onChange={() => handleToggleExamSelect(exam.id)} className="w-5 h-5 accent-[#14452F] cursor-pointer" />
                                    </div>
                                    <div onClick={() => setViewingExam({ ...exam, questionIds: exam.questionIds, config: exam.config })}>
                                        <div className="flex justify-between mb-4">
                                            <div className="w-10 h-10 bg-[#E8F5E9] chamfer-sm flex items-center justify-center text-[#14452F] font-bold"><i className="fas fa-file-alt"></i></div>
                                            <span className="text-[9px] font-black bg-slate-100 px-2 py-1 chamfer-sm text-slate-500 mr-6">{exam.questionIds?.length || 0} Câu</span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-sm leading-snug uppercase line-clamp-2 group-hover:text-[#14452F] transition-colors">{exam.title}</h4>
                                        <div className="mt-2 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 inline-block chamfer-sm"><i className="fas fa-folder-open mr-1"></i> {exam.folder || 'Mặc định'}</div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-50">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                            {exam.sharedWithClassId ? <i className="fas fa-users text-green-500"></i> : <i className="fas fa-pencil-alt text-orange-400"></i>}
                                            {exam.sharedWithClassId ? 'Đã giao' : 'Bản nháp'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
             </div>
          </main>
      </div>

      {/* EDIT MODAL (Questions) */}
      {editingQuestion && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-3xl chamfer-lg p-0 shadow-2xl animate-slide-up flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 chamfer-lg">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Chỉnh sửa câu hỏi</h3>
                    <button onClick={() => setEditingQuestion(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200"><i className="fas fa-times"></i></button>
                </div>
                
                <form onSubmit={handleUpdateQuestion} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest">Thư mục / Chủ đề</label>
                        <input list="editFolderList" value={editingQuestion.folder || ''} onChange={e => setEditingQuestion({...editingQuestion, folder: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 chamfer-sm font-bold text-sm text-slate-700 focus:bg-white focus:border-[#14452F] outline-none" placeholder="Chọn hoặc nhập tên thư mục mới..." />
                        <datalist id="editFolderList">{uniqueFolders.filter(f => f !== 'ALL').map(f => <option key={f} value={f} />)}</datalist>
                    </div>
                    {/* Content & Options editing fields... (Kept same as before) */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest">Nội dung câu hỏi</label>
                        <textarea value={typeof editingQuestion.content === 'string' ? editingQuestion.content : JSON.stringify(editingQuestion.content)} onChange={e => setEditingQuestion({...editingQuestion, content: e.target.value})} className="w-full h-32 p-4 bg-slate-50 border border-slate-200 chamfer-sm font-medium text-slate-700 focus:bg-white focus:border-[#14452F] outline-none resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest">Loại câu hỏi</label><select value={editingQuestion.type} onChange={e => setEditingQuestion({...editingQuestion, type: e.target.value as QuestionType})} className="w-full p-3 bg-slate-50 border border-slate-200 chamfer-sm font-bold text-sm"><option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm</option><option value={QuestionType.ESSAY}>Tự luận</option></select></div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest">Mức độ Bloom</label><select value={editingQuestion.bloomLevel} onChange={e => setEditingQuestion({...editingQuestion, bloomLevel: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 chamfer-sm font-bold text-sm">{['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'].map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                    </div>
                    {editingQuestion.type === QuestionType.MULTIPLE_CHOICE ? (
                        <div className="space-y-3 bg-[#E8F5E9]/30 p-6 chamfer-md border border-[#14452F]/10">
                            <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest block mb-2">Các phương án (Chọn đáp án đúng)</label>
                            {editingQuestion.options?.map((opt, i) => (
                                <div key={i} className="flex gap-2">
                                    <input type="text" value={opt} onChange={e => { const newOpts = [...(editingQuestion.options || [])]; newOpts[i] = e.target.value; setEditingQuestion({...editingQuestion, options: newOpts, correctAnswer: editingQuestion.correctAnswer === opt ? e.target.value : editingQuestion.correctAnswer}); }} className="flex-1 p-2 bg-white border border-slate-200 chamfer-sm text-sm" placeholder={`Phương án ${String.fromCharCode(65+i)}`} />
                                    <button type="button" onClick={() => setEditingQuestion({...editingQuestion, correctAnswer: opt})} className={`w-10 chamfer-sm flex items-center justify-center transition-all ${editingQuestion.correctAnswer === opt ? 'bg-green-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-300'}`}><i className="fas fa-check"></i></button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2 bg-purple-50/50 p-6 chamfer-md border border-purple-100">
                            <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Đáp án chuẩn / Gợi ý</label>
                            <textarea value={editingQuestion.correctAnswer} onChange={e => setEditingQuestion({...editingQuestion, correctAnswer: e.target.value})} className="w-full h-24 p-4 bg-white border border-purple-200 chamfer-sm font-medium text-slate-700 outline-none focus:border-purple-500" />
                        </div>
                    )}
                </form>

                <div className="p-6 border-t border-slate-100 bg-slate-50 chamfer-lg flex justify-end gap-3">
                    <button onClick={() => setEditingQuestion(null)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-100">Hủy</button>
                    <button onClick={handleUpdateQuestion} disabled={isSaving} className="px-8 py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] shadow-lg disabled:opacity-70">{isSaving ? 'Đang lưu...' : 'Cập nhật'}</button>
                </div>
            </div>
        </div>, document.body
      )}

      {/* MOVE MODAL (Questions) */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl w-[400px]">
                <h3 className="font-bold text-[#14452F] text-lg mb-4">Chuyển {selectedQuestionIds.length} câu hỏi tới:</h3>
                <input list="folder-options" value={targetMoveFolder} onChange={(e) => setTargetMoveFolder(e.target.value)} placeholder="Chọn hoặc nhập thư mục mới..." className="w-full border-2 border-slate-200 p-3 rounded mb-4 outline-none" />
                <datalist id="folder-options">{uniqueFolders.filter(f => f !== 'ALL').map(f => <option key={f} value={f} />)}</datalist>
                <div className="flex gap-2 justify-end">
                    <button onClick={() => setIsMoveModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded">Hủy</button>
                    <button onClick={handleBulkMove} disabled={isMovingBulk} className="px-4 py-2 bg-[#14452F] text-white font-bold rounded">Xác nhận</button>
                </div>
            </div>
        </div>
      )}

      {/* MOVE MODAL (Exams) */}
      {isExamMoveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl w-[400px]">
                <h3 className="font-bold text-[#14452F] text-lg mb-4">Chuyển {selectedExamIds.length} đề thi tới:</h3>
                <input list="exam-folder-options" value={examTargetMoveFolder} onChange={(e) => setExamTargetMoveFolder(e.target.value)} placeholder="Chọn hoặc nhập thư mục mới..." className="w-full border-2 border-slate-200 p-3 rounded mb-4 outline-none" />
                <datalist id="exam-folder-options">{uniqueExamFolders.filter(f => f !== 'ALL').map(f => <option key={f} value={f} />)}</datalist>
                <div className="flex gap-2 justify-end">
                    <button onClick={() => setIsExamMoveModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded">Hủy</button>
                    <button onClick={handleExamBulkMove} disabled={isMovingExamBulk} className="px-4 py-2 bg-[#14452F] text-white font-bold rounded">Xác nhận</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBankManager;