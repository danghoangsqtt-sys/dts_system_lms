
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Chatbot from './components/Chatbot';
import QuestionGenerator from './components/QuestionGenerator/index'; 
import Documents from './components/Documents';
import GameQuiz from './components/GameQuiz';
import Settings from './components/Settings';
import ProfileSettings from './components/ProfileSettings';
import QuestionBankManager from './components/QuestionBankManager';
import ChangelogModal from './components/ChangelogModal';
import Login from './components/Login';
import AdminDashboard from './components/Admin/AdminDashboard';
import TeacherStudents from './components/Teacher/TeacherStudents';
import LectureManager from './components/Teacher/LectureManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Question, VectorChunk, QuestionFolder, Exam } from './types';
import pkg from './package.json';

// --- Sidebar Link Component (Chamfered) ---
const SidebarLink = ({ to, icon, label, onClick }: { to: string, icon: string, label: string, onClick?: () => void }) => {
  const location = useLocation();
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group flex items-center gap-4 px-6 py-4 transition-all duration-200 mb-1 mx-3 font-bold text-sm chamfer-sm ${
        active 
          ? 'bg-[#14452F] text-white chamfer-shadow' 
          : 'text-slate-500 hover:bg-[#E8F5E9] hover:text-[#14452F]'
      }`}
    >
      <i className={`fas ${icon} w-6 text-center text-lg ${active ? 'text-white' : 'text-slate-400 group-hover:text-[#14452F]'} transition-colors`}></i>
      <span className="tracking-wide font-[Roboto]">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 bg-white chamfer-sm"></div>}
    </Link>
  );
};

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-full w-full flex items-center justify-center font-[Roboto] text-sm text-[#14452F] font-bold uppercase tracking-widest"><i className="fas fa-circle-notch fa-spin mr-3"></i> Loading System...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// --- Dashboard Component (New Bento Grid Style) ---
const Dashboard = ({ questionsCount, examsCount }: any) => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const foldersCount = JSON.parse(localStorage.getItem('question_folders') || '[]').length;
    const docsCount = JSON.parse(localStorage.getItem('elearning_docs') || '[]').length;

    return (
        <div className="p-6 md:p-10 space-y-8 animate-slide-up max-w-[1920px] mx-auto pb-24 font-[Roboto]">
            
            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. Hero Section (Span 8) */}
                <div className="lg:col-span-8 bg-white chamfer-xl chamfer-shadow border-l-8 border-[#14452F] p-8 md:p-12 relative overflow-hidden group flex flex-col justify-between min-h-[300px]">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#14452F]/5 chamfer-diag -mr-20 -mt-20 group-hover:bg-[#14452F]/10 transition-colors duration-500"></div>
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-3 text-slate-400">
                            <span className="bg-slate-100 px-3 py-1 chamfer-sm text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest animate-pulse text-[#14452F]">
                                • System Online
                            </span>
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-tight">
                                Xin chào, <br/> <span className="text-[#14452F]">{user?.fullName}</span>
                            </h1>
                            <p className="text-slate-500 text-sm font-medium max-w-xl leading-relaxed mt-4">
                                Chào mừng trở lại trung tâm điều hành. Hệ thống AI đang ở trạng thái sẵn sàng hỗ trợ công việc giảng dạy và học tập của bạn.
                            </p>
                        </div>
                    </div>
                    <div className="relative z-10 flex gap-4 mt-8">
                        <Link to="/game" className="bg-[#14452F] text-white px-8 py-4 chamfer-md font-black text-xs uppercase tracking-widest shadow-xl hover:bg-[#0F3624] transition-all active:scale-95 flex items-center gap-3">
                            <i className="fas fa-rocket"></i> Vào học ngay
                        </Link>
                    </div>
                </div>

                {/* 2. System Status / Clock (Span 4) */}
                <div className="lg:col-span-4 bg-[#14452F] text-white chamfer-xl chamfer-shadow p-10 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="flex justify-between items-start z-10">
                        <i className="fas fa-microchip text-4xl text-green-400 opacity-80"></i>
                        <div className="text-right">
                            <div className="text-5xl font-black tracking-tighter tabular-nums">
                                {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-green-400 mt-1">Realtime Clock</div>
                        </div>
                    </div>
                    <div className="space-y-4 z-10 mt-8">
                        <div className="bg-white/10 p-4 chamfer-md border border-white/10 flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">AI Core</span>
                            <span className="text-xs font-black text-green-400 flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div> Active</span>
                        </div>
                        <div className="bg-white/10 p-4 chamfer-md border border-white/10 flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Database</span>
                            <span className="text-xs font-black text-blue-400">Local Synced</span>
                        </div>
                    </div>
                </div>

                {/* 3. Quick Stats (Span 12 -> 4 cols) */}
                <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon="fa-database" label="Ngân hàng câu hỏi" value={questionsCount} unit="Câu" color="blue" />
                    <StatCard icon="fa-file-signature" label="Đề thi đã tạo" value={examsCount} unit="Đề" color="purple" />
                    <StatCard icon="fa-folder-tree" label="Chuyên đề" value={foldersCount} unit="Mục" color="orange" />
                    <StatCard icon="fa-server" label="Tri thức RAG" value={docsCount} unit="Tài liệu" color="teal" />
                </div>

                {/* 4. Quick Actions (Span 12 - Full Width) */}
                <div className="lg:col-span-12 space-y-6">
                    <div className="bg-white p-8 chamfer-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-slate-100 chamfer-sm flex items-center justify-center text-[#14452F]">
                                <i className="fas fa-bolt"></i>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Truy cập nhanh</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {user?.role !== 'student' ? (
                                <>
                                    <Link to="/generate" className="group p-6 bg-slate-50 border border-slate-200 chamfer-md hover:bg-[#14452F] hover:text-white transition-all cursor-pointer">
                                        <i className="fas fa-robot text-2xl text-slate-400 group-hover:text-green-400 mb-3 transition-colors"></i>
                                        <h4 className="font-bold text-sm uppercase">AI Soạn thảo</h4>
                                        <p className="text-[10px] text-slate-500 group-hover:text-white/60 mt-1">Tạo câu hỏi từ PDF</p>
                                    </Link>
                                    <Link to="/bank" className="group p-6 bg-slate-50 border border-slate-200 chamfer-md hover:bg-[#14452F] hover:text-white transition-all cursor-pointer">
                                        <i className="fas fa-layer-group text-2xl text-slate-400 group-hover:text-green-400 mb-3 transition-colors"></i>
                                        <h4 className="font-bold text-sm uppercase">Ngân hàng đề</h4>
                                        <p className="text-[10px] text-slate-500 group-hover:text-white/60 mt-1">Quản lý kho dữ liệu</p>
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link to="/lectures" className="group p-6 bg-slate-50 border border-slate-200 chamfer-md hover:bg-[#14452F] hover:text-white transition-all cursor-pointer">
                                        <i className="fas fa-chalkboard-teacher text-2xl text-slate-400 group-hover:text-green-400 mb-3 transition-colors"></i>
                                        <h4 className="font-bold text-sm uppercase">Bài giảng số</h4>
                                        <p className="text-[10px] text-slate-500 group-hover:text-white/60 mt-1">Xem bài giảng lớp học</p>
                                    </Link>
                                    <Link to="/game" className="group p-6 bg-slate-50 border border-slate-200 chamfer-md hover:bg-[#14452F] hover:text-white transition-all cursor-pointer">
                                        <i className="fas fa-gamepad text-2xl text-slate-400 group-hover:text-green-400 mb-3 transition-colors"></i>
                                        <h4 className="font-bold text-sm uppercase">Trò chơi</h4>
                                        <p className="text-[10px] text-slate-500 group-hover:text-white/60 mt-1">Ôn tập tương tác</p>
                                    </Link>
                                </>
                            )}
                            <Link to="/documents" className="group p-6 bg-slate-50 border border-slate-200 chamfer-md hover:bg-[#14452F] hover:text-white transition-all cursor-pointer">
                                <i className="fas fa-book-open text-2xl text-slate-400 group-hover:text-green-400 mb-3 transition-colors"></i>
                                <h4 className="font-bold text-sm uppercase">Tài liệu</h4>
                                <p className="text-[10px] text-slate-500 group-hover:text-white/60 mt-1">Tra cứu giáo trình</p>
                            </Link>
                            <Link to="/settings" className="group p-6 bg-slate-50 border border-slate-200 chamfer-md hover:bg-[#14452F] hover:text-white transition-all cursor-pointer">
                                <i className="fas fa-sliders text-2xl text-slate-400 group-hover:text-green-400 mb-3 transition-colors"></i>
                                <h4 className="font-bold text-sm uppercase">Cấu hình</h4>
                                <p className="text-[10px] text-slate-500 group-hover:text-white/60 mt-1">API Key & Hệ thống</p>
                            </Link>
                        </div>
                    </div>
                    
                    {/* Placeholder for Recent Activity */}
                    <div className="bg-white p-8 chamfer-xl border border-slate-200 shadow-sm min-h-[200px]">
                         <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-slate-100 chamfer-sm flex items-center justify-center text-[#14452F]">
                                <i className="fas fa-history"></i>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Hoạt động gần đây</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 border-l-4 border-slate-200 bg-slate-50/50">
                                <div className="text-[10px] font-bold text-slate-400 min-w-[60px]">{currentTime.toLocaleTimeString()}</div>
                                <div className="text-sm font-bold text-slate-700">Đăng nhập hệ thống thành công.</div>
                            </div>
                            {/* More mock items could go here */}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

// --- Stat Card (Chamfered & Enhanced) ---
const StatCard = ({ icon, label, value, unit, color }: any) => {
    const colorClasses: any = {
        blue: "text-blue-600 bg-blue-50 border-blue-200",
        purple: "text-purple-600 bg-purple-50 border-purple-200",
        orange: "text-orange-600 bg-orange-50 border-orange-200",
        teal: "text-teal-600 bg-teal-50 border-teal-200",
    };
    const activeColor = colorClasses[color] || colorClasses.blue;

    return (
        <div className="bg-white p-6 chamfer-lg chamfer-shadow border border-slate-100 flex flex-col justify-between h-40 hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-16 h-16 chamfer-sm -mr-6 -mt-6 opacity-20 ${activeColor.split(' ')[1]}`}></div>
            
            <div className="flex justify-between items-start relative z-10">
                <div className={`w-12 h-12 flex items-center justify-center chamfer-sm text-xl ${activeColor}`}>
                    <i className={`fas ${icon}`}></i>
                </div>
            </div>
            
            <div className="mt-auto relative z-10">
                <h3 className="text-4xl font-black text-slate-800 tracking-tight">{value}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                    {label} <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 chamfer-sm">{unit}</span>
                </p>
            </div>
        </div>
    );
}

const AppContent: React.FC = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [folders, setFolders] = useState<QuestionFolder[]>([{"id":"default","name":"Mặc định","createdAt":0}]);
  const [knowledgeBase, setKnowledgeBase] = useState<VectorChunk[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [notifications, setNotifications] = useState<{ id: number, message: string, type: string }[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const initData = async () => {
      setQuestions(JSON.parse(localStorage.getItem('questions') || '[]'));
      setFolders(JSON.parse(localStorage.getItem('question_folders') || '[{"id":"default","name":"Mặc định","createdAt":0}]'));
      setKnowledgeBase(JSON.parse(localStorage.getItem('knowledge_base') || '[]'));
      setExams(JSON.parse(localStorage.getItem('exams') || '[]'));
      setIsDataLoaded(true);
    };
    initData();
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem('questions', JSON.stringify(questions));
    localStorage.setItem('question_folders', JSON.stringify(folders));
    localStorage.setItem('knowledge_base', JSON.stringify(knowledgeBase));
    localStorage.setItem('exams', JSON.stringify(exams));
  }, [questions, folders, knowledgeBase, exams, isDataLoaded]);

  const showNotify = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  if (authLoading || !isDataLoaded) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-[#14452F] font-[Roboto]"><i className="fas fa-circle-notch fa-spin text-4xl mb-4"></i><span className="text-sm font-black uppercase tracking-widest">Đang khởi động hệ thống...</span></div>;

  return (
    <div className="flex h-screen bg-[#F0F2F5] font-[Roboto] overflow-hidden relative">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        
        <Route path="*" element={
          <ProtectedRoute>
            <div className="flex h-screen w-full overflow-hidden relative">
              
              {/* Mobile Hamburger Button */}
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 w-12 h-12 bg-white chamfer-shadow chamfer-sm flex items-center justify-center text-[#14452F] border border-slate-100"
              >
                <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
              </button>

              {/* Mobile Sidebar Overlay */}
              {isSidebarOpen && (
                <div 
                  className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden backdrop-blur-sm transition-opacity"
                  onClick={closeSidebar}
                ></div>
              )}

              {/* Sidebar */}
              <aside className={`
                fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              `}>
                <div className="p-8 border-b border-slate-100 flex items-center gap-4 bg-white">
                  <div className="w-12 h-12 bg-[#14452F] chamfer-sm flex items-center justify-center text-white font-bold text-xl chamfer-shadow">
                    <i className="fas fa-graduation-cap"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#14452F] tracking-tight uppercase">ĐTS LMS</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">V3.9 Tech-Edu</p>
                  </div>
                </div>

                <nav className="flex-1 py-6 overflow-y-auto custom-scrollbar space-y-1">
                  {user?.role === 'admin' && (
                    <>
                      <div className="px-8 mb-3 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quản trị Hệ thống</div>
                      <SidebarLink to="/admin" icon="fa-shield-halved" label="Admin Panel" onClick={closeSidebar} />
                    </>
                  )}

                  {user?.role === 'teacher' && (
                    <>
                      <div className="px-8 mb-3 mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Khu vực Giảng viên</div>
                      <SidebarLink to="/teacher/students" icon="fa-users-gear" label="Quản lý Học viên" onClick={closeSidebar} />
                    </>
                  )}

                  <div className="px-8 mb-3 mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Không gian Học tập</div>
                  <SidebarLink to="/" icon="fa-gauge-high" label="Tổng quan" onClick={closeSidebar} />
                  <SidebarLink to="/lectures" icon="fa-film" label="Bài giảng Số" onClick={closeSidebar} />
                  <SidebarLink to="/documents" icon="fa-book-open" label="Tài liệu & RAG" onClick={closeSidebar} />
                  
                  {user?.role !== 'student' && (
                    <>
                      <div className="px-8 mb-3 mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Công cụ Biên soạn</div>
                      <SidebarLink to="/bank" icon="fa-server" label="Ngân hàng Đề" onClick={closeSidebar} />
                      <SidebarLink to="/generate" icon="fa-robot" label="AI Soạn thảo" onClick={closeSidebar} />
                    </>
                  )}
                  
                  <div className="px-8 mb-3 mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiện ích Mở rộng</div>
                  <SidebarLink to="/game" icon="fa-gamepad" label="Trò chơi Ôn tập" onClick={closeSidebar} />
                  <SidebarLink to="/settings" icon="fa-sliders" label="Cấu hình" onClick={closeSidebar} />
                </nav>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                  <Link to="/profile" className="flex items-center gap-4 mb-4 bg-white p-3 chamfer-sm border border-slate-200 hover:border-[#14452F] transition-all cursor-pointer group">
                    <div className="w-10 h-10 bg-[#E8F5E9] chamfer-sm flex items-center justify-center text-[#14452F] text-sm font-black overflow-hidden group-hover:shadow-md transition-all">
                      {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : user?.fullName.charAt(0)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold text-slate-800 truncate group-hover:text-[#14452F] transition-colors">{user?.fullName}</span>
                      <span className="text-[9px] text-[#14452F] font-bold uppercase tracking-wider">{user?.role === 'admin' ? 'Quản trị viên' : user?.role === 'teacher' ? 'Giảng viên' : 'Học viên'}</span>
                    </div>
                  </Link>
                  <button onClick={signOut} className="w-full py-3 bg-white border border-slate-200 text-slate-600 chamfer-sm text-[10px] font-black uppercase tracking-widest hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                    <i className="fas fa-sign-out-alt"></i> Đăng xuất
                  </button>
                </div>
              </aside>

              <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#F0F2F5]">
                <div className="flex-1 overflow-auto custom-scrollbar p-0">
                  <Routes>
                    <Route path="/" element={<Dashboard questionsCount={questions.length} examsCount={exams.length} />} />
                    <Route path="/profile" element={<ProfileSettings onNotify={showNotify} />} />
                    <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard onNotify={showNotify}/></ProtectedRoute>} />
                    <Route path="/teacher/students" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherStudents onNotify={showNotify}/></ProtectedRoute>} />
                    <Route path="/lectures" element={<LectureManager onNotify={showNotify}/>} />
                    <Route path="/documents" element={<Documents onUpdateKnowledgeBase={(chunks) => setKnowledgeBase(p => [...p, ...chunks])} onDeleteDocumentData={(id) => setKnowledgeBase(p => p.filter(c => c.docId !== id))} onNotify={showNotify} />} />
                    <Route path="/generate" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><QuestionGenerator folders={folders} onSaveQuestions={(q)=>setQuestions(p=>[...p,...q])} onNotify={showNotify}/></ProtectedRoute>} />
                    <Route path="/bank" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><QuestionBankManager folders={folders} setFolders={setFolders} exams={exams} setExams={setExams} showNotify={showNotify} /></ProtectedRoute>} />
                    <Route path="/game" element={<GameQuiz folders={folders} />} />
                    <Route path="/settings" element={<Settings onNotify={showNotify} />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>
                <Chatbot knowledgeBase={knowledgeBase} onNotify={showNotify} />
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>

      {/* Notifications - Chamfered Style */}
      <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none">
          {notifications.map(n => (
              <div key={n.id} className={`px-6 py-4 bg-white border-l-4 chamfer-shadow chamfer-md flex items-center gap-4 animate-slide-up pointer-events-auto min-w-[340px] transform hover:scale-105 transition-all ${
                  n.type === 'success' ? 'border-[#14452F]' : n.type === 'error' ? 'border-red-500' : 'border-blue-500'
              }`}>
                  <div className={`w-8 h-8 chamfer-sm flex items-center justify-center shrink-0 ${
                      n.type === 'success' ? 'bg-[#E8F5E9] text-[#14452F]' : n.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                  }`}>
                    <i className={`fas ${
                        n.type === 'success' ? 'fa-check' : n.type === 'error' ? 'fa-exclamation' : 'fa-info'
                    } text-sm`}></i>
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${
                        n.type === 'success' ? 'text-[#14452F]' : n.type === 'error' ? 'text-red-500' : 'text-blue-500'
                    }`}>
                        {n.type === 'success' ? 'Thành công' : n.type === 'error' ? 'Lỗi hệ thống' : 'Thông báo'}
                    </p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{n.message}</p>
                  </div>
              </div>
          ))}
      </div>
      <ChangelogModal />
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <AppContent />
    </Router>
  </AuthProvider>
);

export default App;
