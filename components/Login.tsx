
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Validation cơ bản
    if (password.length < 6) {
        setError("Mật khẩu phải có ít nhất 6 ký tự.");
        setLoading(false);
        return;
    }

    try {
      if (mode === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // SIGN UP LOGIC
        if (!fullName.trim()) {
            throw new Error("Vui lòng nhập họ và tên hiển thị.");
        }

        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: 'student', // Mặc định là student, chờ Admin nâng cấp
              status: 'active' // Hoặc 'pending' tùy logic business
            }
          }
        });

        if (error) throw error;

        // Nếu Auto-confirm tắt, Supabase sẽ không đăng nhập ngay.
        if (data.user && !data.session) {
            setSuccessMsg("Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản trước khi đăng nhập.");
            setMode('LOGIN');
        } else {
            // Nếu Auto-confirm bật, user sẽ được đăng nhập ngay
            // Tuy nhiên, để an toàn và đúng luồng, ta vẫn thông báo.
            setSuccessMsg("Tài khoản đã được tạo. Vui lòng liên hệ Admin để được cấp quyền Giảng viên.");
        }
      }
    } catch (err: any) {
      // Xử lý các lỗi phổ biến của Supabase
      if (err.message.includes('User already registered')) {
          setError('Email này đã được sử dụng. Vui lòng đăng nhập.');
      } else if (err.message.includes('rate limit')) {
          setError('Thao tác quá nhanh. Vui lòng đợi 60 giây rồi thử lại.');
      } else {
          setError(err.message || 'Đã xảy ra lỗi hệ thống.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-[Roboto] bg-[#020617]">
      {/* BACKGROUND EFFECTS */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#051120] to-[#020617]"></div>
        <div 
          className="absolute inset-0 opacity-[0.15]" 
          style={{
            backgroundImage: `radial-gradient(circle at 50% 0, #14452F 20%, transparent 21%)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '0 0'
          }}
        ></div>
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-[#14452F] rounded-full blur-[150px] opacity-40 animate-pulse"></div>
      </div>

      {/* AUTH CARD */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-[#14452F] rounded-2xl blur opacity-40 group-hover:opacity-75 transition duration-1000"></div>
        
        <div className="relative bg-[#0F172A]/80 backdrop-blur-2xl border border-white/5 p-8 md:p-10 rounded-2xl shadow-2xl">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="relative inline-flex items-center justify-center w-20 h-20 mb-4">
               <div className="absolute inset-0 bg-[#14452F] opacity-20 animate-spin-slow" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
               <i className="fas fa-graduation-cap text-3xl text-emerald-300 relative z-10"></i>
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-1">
              ĐTS LMS <span className="text-emerald-500">SYSTEM</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                {mode === 'LOGIN' ? 'Cổng đăng nhập an toàn' : 'Khởi tạo định danh mới'}
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border-l-2 border-red-500 text-red-400 text-xs font-bold flex items-start gap-3 animate-shake rounded-r-lg">
              <i className="fas fa-bug mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}
          
          {successMsg && (
            <div className="mb-6 p-4 bg-green-500/10 border-l-2 border-green-500 text-green-400 text-xs font-bold flex items-start gap-3 rounded-r-lg">
              <i className="fas fa-check-circle mt-0.5"></i>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-5">
            {mode === 'SIGNUP' && (
                <div className="space-y-1 animate-slide-up">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ và Tên</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none"><i className="fas fa-id-badge text-slate-500"></i></div>
                        <input 
                            type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A"
                            className="w-full pl-11 pr-4 py-3 bg-[#020617]/60 border border-slate-700 rounded-lg text-white text-sm font-bold outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
                        />
                    </div>
                </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none"><i className="fas fa-envelope text-slate-500"></i></div>
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@domain.edu.vn"
                  className="w-full pl-11 pr-4 py-3 bg-[#020617]/60 border border-slate-700 rounded-lg text-white text-sm font-bold outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none"><i className="fas fa-lock text-slate-500"></i></div>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-[#020617]/60 border border-slate-700 rounded-lg text-white text-sm font-bold outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
                />
              </div>
              {mode === 'SIGNUP' && <p className="text-[9px] text-slate-500 italic pl-1">* Tối thiểu 6 ký tự</p>}
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full py-4 mt-2 bg-gradient-to-r from-[#14452F] to-emerald-800 hover:from-emerald-700 hover:to-emerald-600 text-white font-black text-[11px] uppercase tracking-[0.25em] rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-3"
            >
              {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className={`fas ${mode === 'LOGIN' ? 'fa-sign-in-alt' : 'fa-user-plus'}`}></i>}
              {mode === 'LOGIN' ? 'TRUY CẬP HỆ THỐNG' : 'ĐĂNG KÝ TÀI KHOẢN'}
            </button>
          </form>

          {/* Switcher & Guide */}
          <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-4">
            <p className="text-slate-400 text-xs font-medium">
                {mode === 'LOGIN' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                <button 
                    onClick={() => { setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN'); setError(null); setSuccessMsg(null); }}
                    className="ml-2 text-emerald-400 font-bold hover:text-emerald-300 underline decoration-dashed underline-offset-4"
                >
                    {mode === 'LOGIN' ? 'Đăng ký ngay' : 'Đăng nhập'}
                </button>
            </p>
            
            {mode === 'SIGNUP' && (
                <div className="bg-emerald-900/20 border border-emerald-500/20 p-3 rounded-lg">
                    <p className="text-[10px] text-emerald-200/80 leading-relaxed text-left">
                        <i className="fas fa-info-circle mr-1"></i> 
                        <strong>Lưu ý cho Giáo viên:</strong> Sau khi đăng ký thành công, tài khoản sẽ ở quyền <em>Học viên</em>. Vui lòng liên hệ Admin để được nâng cấp quyền.
                    </p>
                </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .animate-spin-slow { animation: spin-slow 10s linear infinite; }`}</style>
    </div>
  );
};

export default Login;
