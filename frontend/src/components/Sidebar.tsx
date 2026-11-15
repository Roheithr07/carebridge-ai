import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Pill, CalendarClock, History, Calendar, 
  Users, Activity, Sparkles, Bell, Settings, ShieldCheck, X,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const role = user?.role || 'elderly';

  const getDashboardPath = () => {
    if (role === 'elderly') return '/elder/dashboard';
    if (role === 'family') return '/family/dashboard';
    return '/caregiver/dashboard';
  };

  const navSections = [
    {
      title: 'Care Overview',
      links: [
        {
          name: 'Dashboard',
          path: getDashboardPath(),
          icon: LayoutDashboard,
        },
        {
          name: role === 'elderly' ? "Today's Schedule" : 'Daily Dose Tracker',
          path: '/schedule',
          icon: CalendarClock,
        },
        {
          name: 'Medications',
          path: '/medications',
          icon: Pill,
        },
        {
          name: 'Adherence Analytics',
          path: '/history',
          icon: History,
        },
        {
          name: 'Doctor Appointments',
          path: '/appointments',
          icon: Calendar,
        },
      ]
    },
    {
      title: 'Connected Circle',
      links: [
        {
          name: role === 'elderly' ? 'Family & Caregivers' : 'Patient Connections',
          path: '/family-access',
          icon: Users,
        },
        {
          name: 'Activity Timeline',
          path: '/timeline',
          icon: Activity,
        },
        {
          name: 'Grok AI Health Summary',
          path: '/ai-summary',
          icon: Sparkles,
          badge: 'Grok'
        },
      ]
    },
    {
      title: 'Preferences',
      links: [
        {
          name: 'Notifications',
          path: '/notifications',
          icon: Bell,
        },
        {
          name: 'Profile & Settings',
          path: '/settings',
          icon: Settings,
        },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-navy-950/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 md:top-16 left-0 z-50 md:z-20 h-full md:h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Mobile Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between md:hidden">
          <span className="font-extrabold text-navy-950 text-base">CareBridge AI</span>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="p-3 space-y-6 overflow-y-auto">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </div>

              {section.links.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => onClose()}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-teal-50/80 text-teal-800 font-bold shadow-xs border border-teal-200/60'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-navy-950'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {item.badge ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-navy-950 text-teal-300 border border-teal-500/30">
                            {item.badge}
                          </span>
                        ) : isActive ? (
                          <ChevronRight className="w-3.5 h-3.5 text-teal-600 opacity-60" />
                        ) : null}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <div className="w-7 h-7 rounded-lg bg-teal-100/70 text-teal-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="leading-tight text-[11px]">
              <span className="font-bold text-navy-900 block">Encrypted Healthcare</span>
              <span className="text-slate-400">Passcode Access Control</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
