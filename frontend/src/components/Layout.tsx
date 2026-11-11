import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Activity, ShieldCheck } from 'lucide-react';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname: string): { title: string; subtitle: string } => {
    if (pathname === '/') {
      return { title: 'Dashboard', subtitle: 'Overview of system status and quick metrics' };
    }
    if (pathname === '/datasets') {
      return { title: 'Datasets', subtitle: 'Manage training data, video uploads, and classes' };
    }
    if (pathname.startsWith('/datasets/')) {
      return { title: 'Dataset Details', subtitle: 'Inspect videos, validation reports, and class remapping' };
    }
    if (pathname === '/training') {
      return { title: 'Training Jobs', subtitle: 'Monitor PyTorch model training runs and status' };
    }
    if (pathname === '/training/new') {
      return { title: 'New Training Job', subtitle: 'Configure hyperparameter settings and start a job' };
    }
    if (pathname.startsWith('/training/')) {
      return { title: 'Training Details', subtitle: 'Live loss, accuracy curves, and epoch metrics' };
    }
    if (pathname === '/models') {
      return { title: 'Model Registry', subtitle: 'Trained model checkpoints and deployment weights' };
    }
    if (pathname === '/analysis') {
      return { title: 'Video Inference & Analysis', subtitle: 'Upload a video to predict actions using trained models' };
    }
    return { title: 'ActivityAI', subtitle: 'AI-Based Human Activity Recognition Platform' };
  };

  const { title, subtitle } = getPageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-gray-950 flex text-gray-100">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <header className="h-16 sticky top-0 z-30 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
                {title}
              </h1>
              <p className="hidden md:block text-xs text-gray-400">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 border border-gray-800 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-300">API:</span>
              <span className="font-mono text-emerald-400 font-semibold">Online</span>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
