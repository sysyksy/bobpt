
import React, { useState } from 'react';
import { ArrowRight, Mail, Lock, Github, Chrome, Video, Sparkles, User as UserIcon, AlertCircle } from 'lucide-react';
import Logo from './Logo';
import { authService } from '../../services/studio-episode/authService';
import { User } from '../../types/studio-episode';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let user;
      if (isSignup) {
        if (!name) throw new Error("Name is required");
        user = await authService.signup(name, email, password);
      } else {
        user = await authService.login(email, password);
      }
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-950 text-white font-sans">
      {/* Left Panel - Branding & Visuals */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gray-900 overflow-hidden flex-col justify-between p-12">
        {/* Dynamic Background */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 z-0 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/95 to-black z-0"></div>
        
        {/* Abstract shapes - Adjusted to lighter glow for black logo visibility */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-gray-700/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-episode-600/10 rounded-full blur-[80px]"></div>

        <div className="relative z-10">
          <div className="mb-8 pl-2">
             <Logo variant="full" size={80} is3D={true} />
          </div>
          
          <h1 className="text-5xl font-extrabold leading-tight mb-6 text-white">
            Where <span className="text-episode-500">Stories</span> <br />
            Ignite.
          </h1>
          <p className="text-lg text-gray-300 max-w-md leading-relaxed mb-8">
            {isSignup ? "Join the creators defining the future." : "Welcome back. Your AI-powered production suite is ready."} 
            Analyze, Edit, and Publish with the precision of Studio Episode.
          </p>

          <div className="flex gap-4">
            <div className="px-4 py-2 bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg flex items-center gap-2">
                <Video className="w-4 h-4 text-episode-400"/>
                <span className="text-sm font-medium">Smart Cut</span>
            </div>
            <div className="px-4 py-2 bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400"/>
                <span className="text-sm font-medium">Gen AI</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex gap-4 text-sm text-gray-500 font-medium">
          <span>© 2024 Studio Episode</span>
          <span>•</span>
          <span className="text-episode-500/80">Internal Build v2.5</span>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-950">
        <div className="w-full max-w-md space-y-8">
          
          {/* Mobile Logo View */}
          <div className="lg:hidden flex justify-center mb-8">
             <Logo variant="full" is3D={true} />
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">{isSignup ? 'Create Account' : 'Operator Login'}</h2>
            <p className="mt-2 text-gray-400">
              {isSignup ? 'Enter your details to get started.' : 'Enter your studio credentials to access the workspace.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {isSignup && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required={isSignup}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-episode-500 focus:border-transparent transition-all"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Studio ID / Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-episode-500 focus:border-transparent transition-all"
                    placeholder="name@studioepisode.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    Password
                    </label>
                    {!isSignup && (
                      <a href="#" className="text-sm font-medium text-episode-500 hover:text-episode-400">
                      Forgot password?
                      </a>
                    )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-episode-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-episode-500 hover:bg-episode-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-episode-500 transition-all transform active:scale-[0.98] shadow-lg shadow-episode-600/20"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                    <span>{isSignup ? 'Create Account' : 'Enter Studio'}</span>
                    <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
              <button 
                onClick={() => { setIsSignup(!isSignup); setError(null); }}
                className="font-medium text-episode-500 hover:text-episode-400 transition-colors"
              >
                {isSignup ? "Log in" : "Sign up"}
              </button>
            </p>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-950 text-gray-500">Or connect via</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-700 rounded-xl shadow-sm bg-gray-900 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors">
                <Chrome className="w-5 h-5" />
                <span className="hidden sm:inline">Google</span>
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-700 rounded-xl shadow-sm bg-gray-900 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors">
                <Github className="w-5 h-5" />
                <span className="hidden sm:inline">GitHub</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
