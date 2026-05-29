
import React, { useState } from 'react';
// Correct named imports for the modular Firebase Auth SDK
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // Modular SDK call for popup sign-in
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Auth Error:", err.code, err.message);
      if (err.code === 'auth/unauthorized-domain') {
        setError(
          <div className="text-left space-y-2">
            <p className="font-bold">Domain Not Authorized</p>
            <p className="text-[11px] leading-tight opacity-90">Please authorize this domain in Firebase Console.</p>
          </div>
        );
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('The account credentials provided are invalid.');
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // Modular SDK call for user creation
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName && userCredential.user) {
          // Modular SDK call for profile update
          await updateProfile(userCredential.user, { displayName });
        }
      } else {
        // Modular SDK call for email sign-in
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      let message = 'An error occurred during authentication.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden p-8 md:p-10 space-y-6 text-center border border-slate-800/20">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-emerald-500 p-3 rounded-2xl shadow-xl shadow-emerald-500/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">VISTA SHORE</h1>
        </div>

        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-xs font-medium animate-shake">{error}</div>}

          <button onClick={handleGoogleLogin} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] disabled:opacity-50">
            {loading && !email ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : (
              <span className="text-sm">Sign in with Google</span>
            )}
          </button>

          <div className="flex items-center gap-4 py-2">
            <div className="h-[1px] bg-slate-100 flex-1"></div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Or email</span>
            <div className="h-[1px] bg-slate-100 flex-1"></div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3 text-left">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-sm" placeholder="John Doe" required={isSignUp} />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-sm" placeholder="name@company.com" required />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-sm" placeholder="••••••••" required />
            </div>
            
            <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl shadow-lg active:scale-[0.98] disabled:opacity-50">
              {loading && email ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mx-auto"></span> : (
                <span className="text-sm">{isSignUp ? 'Create Account' : 'Sign In'}</span>
              )}
            </button>
          </form>
        </div>

        <div className="pt-6 border-t border-slate-50 text-xs">
          {isSignUp ? 'Already have an account?' : "New here?"}{' '}
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-emerald-600 font-bold hover:underline">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
