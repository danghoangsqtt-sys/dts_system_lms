
import React, { useState, useEffect } from 'react';
import { AppSettings, AppVersionInfo } from '../types';
import { checkAppUpdate } from '../services/updateService';
import { validateApiKey } from '../services/geminiService';
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
  systemExpertise: 'ACADEMIC'
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

  const [kbSize, setKbSize] = useState(0);
  
  // API Key State
  const [customApiKey, setCustomApiKey] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'IDLE' | 'TESTING' | 'VALID' | 'INVALID'>('IDLE');

  useEffect(() => {
    const kb = JSON.parse(localStorage.getItem('knowledge_base') || '[]');
    setKbSize(kb.length);
    if (settings.modelName === 'gemini-3-flash-preview') {
        const newSettings = { ...settings, modelName: 'gemini-2.5-flash' };
        setSettings(newSettings);
        localStorage.setItem('app_settings', JSON.stringify(newSettings));
        onNotify("Đã tự động chuyển về Gemini 2.5 Flash để đảm bảo ổn định.", "info");
    }

    // Load custom API key
    const storedKey = localStorage.getItem('DTS_GEMINI_API_KEY');
    if (storedKey) {
        setCustomApiKey(storedKey);
        setKeyStatus('IDLE'); // Assuming valid if previously stored, or allow re-test
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
    onNotify("Đã lưu cấu hình hệ thống LMS.", "success");
  };

  const handleSaveApiKey = () => {
    if (!customApiKey.trim()) {
        onNotify("Vui lòng nhập API Key hợp lệ.", "warning");
        return;
    }
    localStorage.setItem('DTS_GEMINI_API_KEY', customApiKey.trim());
    onNotify("Đã lưu Gemini API Key cá nhân.", "success");
    setKeyStatus('IDLE');
  };

  const handleTestApiKey = async () => {
    if (!customApiKey) return;
    setKeyStatus('TESTING');
    const isValid = await validateApiKey(customApiKey);
    if (isValid) {
        setKeyStatus('VALID');
        onNotify("Kết nối Gemini thành công!", "success");
    } else {
        setKeyStatus('INVALID');
        onNotify("API Key không hợp lệ hoặc hết hạn mức.", "error");
    }
  };

  const handleDeleteApiKey = () => {
    localStorage.removeItem('DTS_GEMINI_API_KEY');
    setCustomApiKey('');
    setKeyStatus('IDLE');
    onNotify("Đã xóa Key cá nhân. Hệ thống sẽ sử dụng Key mặc định.", "info");
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
        
        {/* Left Column: Data Management */}
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

        {/* Right Column: Configuration (Spanning 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* NEW SECTION: AI API Key Configuration */}
          <section className="bg-white chamfer-lg border border-slate-200 chamfer-shadow p-8">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 chamfer-sm flex items-center justify-center bg-blue-600 text-white">
                    <i className="fas fa-key"></i>
                </div>
                <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">Cấu hình AI (Gemini)</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Bring Your Own Key (BYOK)</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Gemini API Key Cá nhân</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input 
                                type={isKeyVisible ? "text" : "password"} 
                                value={customApiKey}
                                onChange={(e) => { setCustomApiKey(e.target.value); setKeyStatus('IDLE'); }}
                                placeholder="Nhập API Key của bạn (bắt đầu bằng AIza...)"
                                className={`w-full p-3 pr-10 bg-slate-50 border-2 chamfer-sm font-bold text-slate-700 outline-none focus:bg-white transition-all ${keyStatus === 'VALID' ? 'border-green-500' : keyStatus === 'INVALID' ? 'border-red-500' : 'border-slate-200 focus:border-[#14452F]'}`}
                            />
                            <button 
                                onClick={() => setIsKeyVisible(!isKeyVisible)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#14452F]"
                            >
                                <i className={`fas ${isKeyVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                        <button 
                            onClick={handleSaveApiKey}
                            className="bg-[#14452F] text-white px-5 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] shadow-md transition-all"
                        >
                            Lưu
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                        Nếu để trống, hệ thống sẽ sử dụng API Key mặc định. Key cá nhân giúp bạn tránh giới hạn quota chung.
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={handleTestApiKey} 
                        disabled={keyStatus === 'TESTING' || !customApiKey}
                        className={`px-4 py-2 chamfer-sm font-black text-[10px] uppercase tracking-widest border transition-all flex items-center gap-2 ${
                            keyStatus === 'VALID' ? 'bg-green-100 text-green-700 border-green-200' :
                            keyStatus === 'INVALID' ? 'bg-red-100 text-red-700 border-red-200' :
                            'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                        }`}
                    >
                        {keyStatus === 'TESTING' ? <i className="fas fa-circle-notch fa-spin"></i> : 
                         keyStatus === 'VALID' ? <i className="fas fa-check-circle"></i> : 
                         keyStatus === 'INVALID' ? <i className="fas fa-exclamation-triangle"></i> : 
                         <i className="fas fa-plug"></i>}
                        {keyStatus === 'TESTING' ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                    </button>

                    {customApiKey && (
                        <button 
                            onClick={handleDeleteApiKey}
                            className="px-4 py-2 chamfer-sm font-black text-[10px] uppercase tracking-widest border border-red-100 text-red-500 hover:bg-red-50 transition-all"
                        >
                            <i className="fas fa-trash-alt mr-2"></i> Xóa Key
                        </button>
                    )}
                </div>
            </div>
          </section>

          <section className="bg-white chamfer-lg border border-slate-200 chamfer-shadow p-8 h-auto">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 chamfer-sm flex items-center justify-center bg-[#14452F] text-white">
                    <i className="fas fa-sliders-h"></i>
                </div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">Tham số vận hành</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
