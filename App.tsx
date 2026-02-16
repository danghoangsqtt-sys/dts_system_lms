
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Chatbot from './components/Chatbot';
import QuestionGenerator from './components/QuestionGenerator/index'; 
import Documents from './components/Documents';
import GameQuiz from './components/GameQuiz';
import Settings from './components/Settings';
import QuestionBankManager from './components/QuestionBankManager';
import ChangelogModal from './components/ChangelogModal';
import Login from './components/Login';
import AdminDashboard from './components/Admin/AdminDashboard';
import TeacherStudents from './components/Teacher/TeacherStudents';
import LectureManager from './components/Teacher/LectureManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Question, VectorChunk, QuestionFolder, Exam } from './types';
import pkg from './package.json';

const SidebarLink = ({ to, icon, label }: { to: string, icon: string, label: string }) => {
  const location = useLocation();
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 font-bold ${
        active 
          ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 translate-x-1' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'
      }`}
    >
      <i className={`fas ${icon} w-6 text-center text-lg`}></i>
      <span className="text-[14px]">{label}</span>
    </Link>
  );
};

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-full w-full flex items-center justify-center"><div className="loader-spin"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const Dashboard = ({ questionsCount, examsCount }: any) => {
    const { user } = useAuth();
    return (
        <div className="p-8 space-y-12 animate-fade-in max-w-7xl mx-auto pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center gap-3 text-blue-600 font-black text-[11px] uppercase tracking-[0.3em]">
                    <i className="fas fa-graduation-cap animate-bounce"></i>
                    Xin chào, {user?.fullName}!
                  </div>
                  <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none">
                    LMS Core <br/> <span className="text-blue-600">Learning Center</span>
                  </h1>
                  <p className="text-slate-500 text-xl font-medium max-w-xl">
                    Hệ thống thông minh hỗ trợ học tập môn "Nguồn điện an toàn và môi trường".
                  </p>
                </div>
                <div className="flex flex-col gap-4 relative z-10">
                  <Link to="/game" className="bg-slate-900 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 group">
                    <i className="fas fa-play group-hover:scale-110 transition"></i> ÔN LUYỆN NGAY
                  </Link>
                  {user?.role !== 'student' && (
                    <Link to="/generate" className="bg-blue-50 text-blue-600 px-10 py-5 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-3">
                        <i className="fas fa-magic"></i> AI BIÊN SOẠN
                    </Link>
                  )}
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <StatCard icon="fa-database" color="blue" label="Hệ thống câu hỏi" value={questionsCount} unit="Câu hỏi" />
                <StatCard icon="fa-file-invoice" color="indigo" label="Đề thi hiện có" value={examsCount} unit="Đề thi" />
                <StatCard icon="fa-layer-group" color="orange" label="Chuyên đề học tập" value={JSON.parse(localStorage.getItem('question_folders') || '[]').length} unit="Chủ đề" />
                <StatCard icon="fa-file-pdf" color="purple" label="Kho giáo trình" value={JSON.parse(localStorage.getItem('elearning_docs') || '[]').length} unit="Tài liệu" />
            </div>
        </div>
    );
};

const StatCard = ({ icon, color, label, value, unit }: any) => (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm transition-all hover:shadow-xl group">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 text-xl bg-${color}-50 text-${color}-600 border border-${color}-100/50`}>
            <i className={`fas ${icon}`}></i>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <div className="flex items-end gap-2 mt-2">
            <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
            <p className="text-xs font-bold text-slate-400 mb-1.5">{unit}</p>
        </div>
    </div>
);

const AppContent: React.FC = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [folders, setFolders] = useState<QuestionFolder[]>([{"id":"default","name":"Mặc định","createdAt":0}]);
  const [knowledgeBase, setKnowledgeBase] = useState<VectorChunk[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [notifications, setNotifications] = useState<{ id: number, message: string, type: string }[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

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

  if (authLoading || !isDataLoaded) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900"><div className="loader-spin"></div></div>;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        
        <Route path="*" element={
          <ProtectedRoute>
            <div className="flex h-screen w-full overflow-hidden">
              <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 shadow-sm overflow-hidden">
                <div className="p-10 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-[1.8rem] flex items-center justify-center text-2xl shadow-xl shadow-blue-500/30 transform -rotate-3">
                      <i className="fas fa-graduation-cap"></i>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-black tracking-tighter leading-none text-slate-900">LMS Core</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">E-SafePower</span>
                    </div>
                  </div>
                </div>

                <nav className="flex-1 px-6 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                  {user?.role === 'admin' && (
                    <>
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] px-4 mb-4">Hệ thống</div>
                      <SidebarLink to="/admin" icon="fa-user-shield" label="Quản trị Admin" />
                    </>
                  )}

                  {user?.role === 'teacher' && (
                    <>
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] px-4 mb-4">Lớp học</div>
                      <SidebarLink to="/teacher/students" icon="fa-users-gear" label="Quản lý Học viên" />
                    </>
                  )}

                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] px-4 mt-6 mb-4">Học tập</div>
                  <SidebarLink to="/" icon="fa-house" label="Tổng quan" />
                  <SidebarLink to="/lectures" icon="fa-file-video" label="Bài giảng lớp" />
                  <SidebarLink to="/documents" icon="fa-book-open" label="Tài liệu chuyên đề" />
                  
                  {user?.role !== 'student' && (
                    <>
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] px-4 mt-10 mb-4">Biên soạn</div>
                      <SidebarLink to="/bank" icon="fa-database" label="Ngân hàng đề" />
                      <SidebarLink to="/generate" icon="fa-wand-magic-sparkles" label="AI Biên soạn" />
                    </>
                  )}
                  
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] px-4 mt-10 mb-4">Đánh giá</div>
                  <SidebarLink to="/game" icon="fa-gamepad-modern" label="Trung tâm Game" />
                  
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] px-4 mt-10 mb-4">Cài đặt</div>
                  <SidebarLink to="/settings" icon="fa-gear" label="Cấu hình" />
                </nav>

                <div className="p-10 border-t border-slate-50 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-black">
                      {user?.fullName.charAt(0)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-black text-slate-800 truncate">{user?.fullName}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user?.role}</span>
                    </div>
                  </div>
                  <button onClick={signOut} className="w-full py-3 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all border border-slate-100">
                    <i className="fas fa-right-from-bracket mr-2"></i> Đăng xuất
                  </button>
                </div>
              </aside>

              <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <Routes>
                    <Route path="/" element={<Dashboard questionsCount={questions.length} examsCount={exams.length} />} />
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

      <div className="fixed top-8 right-8 z-[100] space-y-3 pointer-events-none">
          {notifications.map(n => (
              <div key={n.id} className={`px-6 py-4 rounded-3xl shadow-2xl border flex items-center gap-4 animate-fade-in-up pointer-events-auto bg-white min-w-[320px] border-${n.type === 'success' ? 'green' : n.type === 'error' ? 'red' : 'blue'}-100`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-${n.type === 'success' ? 'green' : n.type === 'error' ? 'red' : 'blue'}-50`}>
                      <i className={`fas ${n.type === 'success' ? 'fa-check-circle text-green-500' : n.type === 'error' ? 'fa-triangle-exclamation text-red-500' : 'fa-info-circle text-blue-500'}`}></i>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{n.message}</span>
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
