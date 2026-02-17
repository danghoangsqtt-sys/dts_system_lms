
import React, { useState, useEffect } from 'react';
import { AppSettings, AppVersionInfo } from '../types';
import { checkAppUpdate } from '../services/updateService';
import pkg from '../package.json';

interface SettingsProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  modelName: 'gemini-2.5-flash',
  aiVoice: 'Zephyr',
  temperature: 0.7,
  maxOutputTokens: 2048,
  autoSave: true,
  ragTopK: 5,
  thinkingBudget: 0,
  systemExpertise: 'ACADEMIC',
  manualApiKey: ''
};

const Settings: React.FC<SettingsProps> = ({ onNotify }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    if (parsed.modelName === 'gemini-3-flash-preview') {
        parsed.modelName = 'gemini-2.5-flash';
        localStorage.setItem('app_settings', JSON.stringify(parsed));
    }
    return parsed;
  });

  const [userGeminiKey, setUserGeminiKey] = useState(localStorage.getItem('USER_GEMINI_KEY') || '');
  const [kbSize, setKbSize] = useState(0);

  useEffect(() => {
    const kb = JSON.parse(localStorage.getItem('knowledge_base') || '[]');
    setKbSize(kb.length);
    if (settings.modelName === 'gemini-3-flash-preview') {
        const newSettings = { ...settings, modelName: 'gemini-2.5-flash' };
        setSettings(newSettings);
        localStorage.setItem('app_settings', JSON.stringify(newSettings));
        onNotify("Đã tự động chuyển về Gemini 2.5 Flash để đảm bảo ổn định.", "info");
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
    localStorage.setItem('USER_GEMINI_KEY', userGeminiKey);
    onNotify("Đã lưu cấu hình hệ thống LMS.", "success");
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        questions: JSON.parse(localStorage.getItem('questions') || '[]'),
        folders: JSON.parse(localStorage.getItem('question_folders') || '[]'),
        docs: JSON.parse(localStorage.getItem('elearning_docs') || '[]'),
        knowledgeBase: JSON.parse(localStorage.getItem('knowledge_base') || '[]'),
        settings: settings,
        exportDate: new Date().toISOString(),
        system: "LMS Core Management"
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `LMS_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      onNotify("Đã xuất dữ liệu sao lưu thành công.", "success");
    } catch (err) {
      onNotify("Lỗi khi tạo bản sao lưu.", "error");
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.system || !data.system.includes("LMS")) {
          throw new Error("Tệp không đúng định dạng sao lưu của Hệ thống LMS.");
        }

        if (window.confirm("CẢNH BÁO: Hành động này sẽ thay thế toàn bộ dữ liệu hiện tại bằng dữ liệu từ bản sao lưu. Tiếp tục?")) {
          if (data.questions) localStorage.setItem('questions', JSON.stringify(data.questions));
          if (data.folders) localStorage.setItem('question_folders', JSON.stringify(data.folders));
          if (data.docs) localStorage.setItem('elearning_docs', JSON.stringify(data.docs));
          if (data.knowledgeBase) localStorage.setItem('knowledge_base', JSON.stringify(data.knowledgeBase));
          if (data.settings) {
              localStorage.setItem('app_settings', JSON.stringify(data.settings));
              setSettings(data.settings);
          }
          
          onNotify("Khôi phục dữ liệu thành công! Hệ thống đang tải lại...", "success");
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (err: any) {
        onNotify(err.message || "Lỗi khi nhập tệp sao lưu.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const clearAllData = () => {
    if (window.confirm("CẢNH BÁO: Hành động này sẽ xóa toàn bộ Câu hỏi, Tri thức RAG và Giáo trình đã nạp. Bạn có chắc chắn?")) {
      localStorage.removeItem('questions');
      localStorage.removeItem('knowledge_base');
      localStorage.removeItem('elearning_docs');
      localStorage.removeItem('question_folders');
      onNotify("Đã xóa sạch bộ nhớ hệ thống. Đang tải lại...", "info");
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-6 pb-24 text-slate-700 font-[Roboto]">
      
      {/* New Header Layout: Minimal & Horizontal */}
      <header className="flex items-center justify-between bg-white p-6 chamfer-lg border-b-4 border-[#14452F] shadow-sm">
        <div>
            <h1 className="text-2xl font-black text-[#14452F] uppercase tracking-tighter">Trung tâm Cấu hình</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">DHsystem Core v{pkg.version}</p>
        </div>
        <button onClick={saveSettings} className="px-8 py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-[#0F3624] transition-all active:scale-95">
            Lưu thay đổi
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Data Management (Moved from Right to Left) */}
        <div className="space-y-6">
          <section className="bg-slate-900 chamfer-lg p-8 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#14452F] opacity-20 chamfer-diag -mr-10 -mb-10"></div>
             <h3 className="text-lg font-black mb-6 uppercase tracking-tight flex items-center gap-3 border-b border-white/10 pb-4">
                <i className="fas fa-server text-[#14452F]"></i> Quản trị Dữ liệu
             </h3>
             
             <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center bg-white/5 p-4 chamfer-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Vector RAG</span>
                    <span className="text-xl font-black text-white">{kbSize}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExportBackup} className="p-4 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 chamfer-sm transition-all group text-center">
                        <i className="fas fa-download text-blue-400 group-hover:text-white mb-2 text-xl"></i>
                        <p className="text-[9px] font-black uppercase text-blue-100">Backup</p>
                    </button>
                    <label className="p-4 bg-green-600/20 hover:bg-green-600 border border-green-500/30 chamfer-sm transition-all group text-center cursor-pointer">
                        <i className="fas fa-upload text-green-400 group-hover:text-white mb-2 text-xl"></i>
                        <p className="text-[9px] font-black uppercase text-green-100">Restore</p>
                        <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
                    </label>
                </div>

                <button onClick={clearAllData} className="w-full py-3 bg-red-500/10 text-red-400 chamfer-sm font-black text-[10px] uppercase tracking-widest border border-red-500/20 hover:bg-red-600 hover:text-white transition-all mt-4">
                    <i className="fas fa-trash-alt mr-2"></i> Reset Hệ thống
                </button>
             </div>
          </section>

          <div className="bg-[#E8F5E9] p-6 chamfer-lg border border-[#14452F]/10">
            <p className="text-[10px] font-black text-[#14452F] uppercase mb-2">Thông tin bản quyền</p>
            <p className="text-xs text-[#14452F]/80 font-medium leading-relaxed">
                Hệ thống thuộc bản quyền <strong>DHsystem</strong>. Mọi hành vi sao chép trái phép đều bị nghiêm cấm.
            </p>
          </div>
        </div>

        {/* Right Column: Configuration (Moved from Left to Right, spanning 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white chamfer-lg border border-slate-200 chamfer-shadow p-8 h-full">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 chamfer-sm flex items-center justify-center bg-[#14452F] text-white">
                    <i className="fas fa-sliders-h"></i>
                </div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">Tham số vận hành</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* API Key Section */}
                <div className="col-span-full bg-slate-50 p-6 chamfer-md border border-slate-200">
                    <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest block mb-3">
                        <i className="fas fa-key mr-2"></i> Google Gemini API Key (Bắt buộc)
                    </label>
                    <div className="relative">
                        <input 
                            type="password"
                            value={userGeminiKey}
                            onChange={e => setUserGeminiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full pl-4 pr-4 py-3 bg-white border-2 border-slate-200 chamfer-sm font-bold text-slate-800 outline-none focus:border-[#14452F] transition-all"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium italic">Key của bạn được lưu cục bộ trên trình duyệt.</p>
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">AI Model</label>
                    <select 
                        value={settings.modelName} 
                        onChange={e => setSettings({...settings, modelName: e.target.value})} 
                        className="w-full p-3 bg-white border border-slate-300 chamfer-sm font-bold text-slate-700 outline-none focus:border-[#14452F] shadow-sm"
                    >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Standard)</option>
                    </select>
                </div>

                {/* Role Selection */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Vai trò Trợ lý</label>
                    <select 
                        value={settings.systemExpertise} 
                        onChange={e => setSettings({...settings, systemExpertise: e.target.value as any})} 
                        className="w-full p-3 bg-white border border-slate-300 chamfer-sm font-bold text-slate-700 outline-none focus:border-[#14452F] shadow-sm"
                    >
                        <option value="ACADEMIC">Giảng viên Hàn lâm</option>
                        <option value="FIELD_EXPERT">Kỹ sư Thực địa</option>
                        <option value="STUDENT_ASSISTANT">Trợ giảng Thân thiện</option>
                    </select>
                </div>

                {/* Temperature Slider */}
                <div className="col-span-full space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Độ sáng tạo (Temperature)</label>
                       <span className="bg-[#14452F] text-white text-xs font-bold px-2 py-1 chamfer-sm">{settings.temperature}</span>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.1" 
                        value={settings.temperature} 
                        onChange={e => setSettings({...settings, temperature: parseFloat(e.target.value)})} 
                        className="w-full h-2 bg-slate-200 appearance-none accent-[#14452F] cursor-pointer chamfer-sm" 
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase">
                        <span>Chính xác</span>
                        <span>Cân bằng</span>
                        <span>Sáng tạo</span>
                    </div>
                </div>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};

export default Settings;
