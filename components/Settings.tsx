
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
    
    // FORCE MIGRATION: Nếu phát hiện đang dùng bản 3.0 preview (gây lỗi 429), chuyển ngay về 2.5
    if (parsed.modelName === 'gemini-3-flash-preview') {
        parsed.modelName = 'gemini-2.5-flash';
        localStorage.setItem('app_settings', JSON.stringify(parsed));
    }
    return parsed;
  });

  const [userGeminiKey, setUserGeminiKey] = useState(localStorage.getItem('USER_GEMINI_KEY') || '');
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [kbSize, setKbSize] = useState(0);

  useEffect(() => {
    const kb = JSON.parse(localStorage.getItem('knowledge_base') || '[]');
    setKbSize(kb.length);
    
    // Double check migration on mount
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

  const handleCheckUpdate = async () => {
    setIsChecking(true);
    try {
      const info = await checkAppUpdate();
      setUpdateInfo(info);
      onNotify(info.isUpdateAvailable ? "Phát hiện bản cập nhật mới!" : "Hệ thống đang ở phiên bản mới nhất.", "info");
    } catch (e) {
      onNotify("Không thể kết nối máy chủ cập nhật.", "error");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in space-y-8 pb-24 text-slate-700 font-inter">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm gap-4">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-3xl flex items-center justify-center text-2xl shadow-2xl shadow-blue-200">
            <i className="fas fa-gear"></i>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Cài đặt Hệ thống</h1>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mt-2">Bảng điều khiển LMS v{pkg.version}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={saveSettings} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all">Lưu cấu hình</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-10 space-y-10">
            <div className="flex flex-col border-b border-slate-50 pb-8 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-blue-50 text-blue-600">
                        <i className="fas fa-brain"></i>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Cấu hình Gemini AI</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kích hoạt trí tuệ nhân tạo trợ giảng</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fas fa-key text-blue-500"></i> Cá nhân hóa API Key (USER_GEMINI_KEY)
                    </label>
                    <input 
                        type="password"
                        value={userGeminiKey}
                        onChange={e => setUserGeminiKey(e.target.value)}
                        placeholder="Nhập API Key cá nhân của bạn..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 italic">
                        Lưu ý: API Key này sẽ được ưu tiên sử dụng cho các yêu cầu AI của bạn.
                    </p>
                </div>
            </div>

            <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <i className="fas fa-microchip text-blue-500"></i> Mô hình (Model)
                        </label>
                        <select 
                            value={settings.modelName} 
                            onChange={e => setSettings({...settings, modelName: e.target.value})} 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Khuyên dùng - Ổn định)</option>
                            {/* Removed 3.0 Option to prevent errors */}
                        </select>
                        <p className="text-[9px] text-slate-400 italic">Phiên bản Gemini 3 Preview đã bị ẩn do vấn đề quá tải hệ thống (429).</p>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <i className="fas fa-graduation-cap text-purple-500"></i> Chế độ trợ giảng
                        </label>
                        <select 
                            value={settings.systemExpertise} 
                            onChange={e => setSettings({...settings, systemExpertise: e.target.value as any})} 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                        >
                            <option value="ACADEMIC">Hàn lâm / Giảng thuật</option>
                            <option value="FIELD_EXPERT">Chuyên gia thực tế</option>
                            <option value="STUDENT_ASSISTANT">Trợ lý học tập</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sáng tạo (Temperature)</label>
                           <span className="font-black text-blue-600 text-sm">{settings.temperature}</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.1" 
                            value={settings.temperature} 
                            onChange={e => setSettings({...settings, temperature: parseFloat(e.target.value)})} 
                            className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-blue-600 cursor-pointer" 
                        />
                    </div>
                </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
             <h3 className="text-xl font-black mb-6 uppercase tracking-tight flex items-center gap-3">
                <i className="fas fa-database text-blue-400"></i> Dữ liệu cục bộ
             </h3>
             <div className="space-y-6">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Dung lượng tri thức RAG</p>
                    <p className="text-4xl font-black">{kbSize} <span className="text-sm font-bold text-slate-500 tracking-normal">Đoạn</span></p>
                </div>
                <button onClick={clearAllData} className="w-full py-4 bg-red-500/10 text-red-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                    Xóa sạch dữ liệu bài học
                </button>
             </div>
          </section>

          <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-10 space-y-6">
             <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                <i className="fas fa-cloud-arrow-down text-blue-600"></i> Sao lưu & Phục hồi
             </h3>
             <div className="space-y-3">
                <button onClick={handleExportBackup} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 transition-all group">
                    <div className="flex items-center gap-3">
                        <i className="fas fa-file-export text-slate-400 group-hover:text-blue-600"></i>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-600">Xuất Sao lưu (.json)</span>
                    </div>
                </button>
                <label className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 transition-all group cursor-pointer border border-dashed border-slate-200">
                    <div className="flex items-center gap-3">
                        <i className="fas fa-file-import text-slate-400 group-hover:text-blue-600"></i>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-600">Nhập Sao lưu</span>
                    </div>
                    <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
                </label>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
