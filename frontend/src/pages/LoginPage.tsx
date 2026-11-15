import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, Lock, Mail, ArrowRight, User, Users, HeartHandshake, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { QuickDemoBar } from '../components/QuickDemoBar';
import { MedicalSafetyBanner } from '../components/MedicalSafetyBanner';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const { login, quickDemoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.search.includes('expired=true')) {
      setSessionExpiredNotice(true);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === 'elderly') navigate('/elder/dashboard');
      else if (loggedInUser.role === 'family') navigate('/family/dashboard');
      else navigate('/caregiver/dashboard');
    } catch (e) {
      // toast shown in context
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role: 'elderly' | 'family' | 'caregiver') => {
    setLoading(true);
    try {
      const loggedInUser = await quickDemoLogin(role);
      if (loggedInUser.role === 'elderly') navigate('/elder/dashboard');
      else if (loggedInUser.role === 'family') navigate('/family/dashboard');
      else navigate('/caregiver/dashboard');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <QuickDemoBar />
      <MedicalSafetyBanner />

      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-card-elevated border border-slate-200/80 p-7 sm:p-9 relative">
          
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-2 mb-3 group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-navy-950 via-navy-900 to-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                <Heart className="w-5 h-5 fill-white" />
              </div>
            </Link>
            <h1 className="text-2xl font-black text-navy-950 tracking-tight">Welcome Back</h1>
            <p className="text-xs text-slate-500 mt-1">Sign in to your CareBridge AI workspace</p>
          </div>

          {sessionExpiredNotice && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Your session has expired. Please sign in to resume.</span>
            </div>
          )}

          {/* Quick Demo Logins for Hackathon Evaluators */}
          <div className="mb-6 p-4 rounded-2xl bg-teal-50/50 border border-teal-200/80">
            <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Hackathon 1-Click Access
              </span>
              <span className="text-[9px] bg-teal-200/80 px-2 py-0.5 rounded text-teal-950 font-bold">Demo Ready</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('elderly')}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white border border-teal-200 hover:border-teal-400 text-center transition-all shadow-xs hover:shadow-sm disabled:opacity-60"
              >
                <User className="w-4 h-4 mx-auto text-teal-600 mb-1" />
                <span className="text-[11px] font-extrabold text-navy-950 block leading-tight">Senior</span>
                <span className="text-[9px] text-slate-400">Eleanor</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('family')}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white border border-sky-200 hover:border-sky-400 text-center transition-all shadow-xs hover:shadow-sm disabled:opacity-60"
              >
                <Users className="w-4 h-4 mx-auto text-sky-600 mb-1" />
                <span className="text-[11px] font-extrabold text-navy-950 block leading-tight">Family</span>
                <span className="text-[9px] text-slate-400">Sarah</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('caregiver')}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 text-center transition-all shadow-xs hover:shadow-sm disabled:opacity-60"
              >
                <HeartHandshake className="w-4 h-4 mx-auto text-emerald-600 mb-1" />
                <span className="text-[11px] font-extrabold text-navy-950 block leading-tight">Caregiver</span>
                <span className="text-[9px] text-slate-400">David RN</span>
              </button>
            </div>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-3 text-slate-400 font-bold tracking-wider">Or email login</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-navy-950 hover:bg-navy-900 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Need an account?{' '}
            <Link to="/register" className="font-bold text-teal-600 hover:text-teal-700">
              Create an account
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
};
