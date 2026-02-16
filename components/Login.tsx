
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] p-6 relative overflow-hidden font-inter">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full -mr-48 -mt-48 blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/10 rounded-full -ml-40 -mb-40 blur-[100px] animate-pulse [animation-delay:1s]"></div>
      
      <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl rounded-[3rem] border border-white/10 p-10 shadow-2xl relative z-10 animate-fade-in-up">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto shadow-2xl mb-6 shadow-blue-500/20">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">Chào mừng trở lại!</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-3">Hệ thống LMS Chuyên sâu</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[11px] font-bold text-center animate-shake">
            <i className="fas fa-circle-exclamation mr-2"></i> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Địa chỉ Email</label>
            <div className="relative group">
              <i className="fas fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-500"></i>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-medium outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mật khẩu</label>
              <a href="#" className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400">Quên mật khẩu?</a>
            </div>
            <div className="relative group">
              <i className="fas fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-500"></i>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-medium outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-900/40 hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-right-to-bracket"></i>}
            {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP NGAY'}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            Nền tảng học tập môn <br/>
            <span className="text-blue-500">Nguồn điện an toàn và môi trường</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
