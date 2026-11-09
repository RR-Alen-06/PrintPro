'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Receipt, 
  Package, 
  Users, 
  DollarSign, 
  BarChart3, 
  Settings as SettingsIcon,
  FileText,
  CreditCard,
  Menu, 
  X, 
  Printer,
  Database,
  QrCode,
  LogOut,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Create Bill', href: '/billing', icon: Receipt },
    { label: 'Products', href: '/products', icon: Package },
    { label: 'Customers', href: '/customers', icon: Users },
    { label: 'Manage Bills', href: '/bills', icon: FileText },
    { label: 'Payments', href: '/payments', icon: CreditCard },
    { label: 'Expenses', href: '/expenses', icon: DollarSign },
    { label: 'Accounting', href: '/accounting', icon: BookOpen },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Audit Log', href: '/audit', icon: ShieldCheck },
    { label: 'Settings', href: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch {
      // Ignore sign out error
    } finally {
      router.push('/login');
    }
  };

  return (
    <>
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 w-full bg-slate-900 text-slate-100 border-b border-slate-800 flex justify-between items-center px-4 md:px-6 h-16 shadow-md print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:bg-blue-500 transition-colors">
              <Printer size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg leading-tight tracking-tight text-white">PrintPro ERP</span>
              <span className="text-[10px] font-medium text-blue-400 leading-none">Xerox & POS Terminal</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!isSupabaseConfigured && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Database size={13} />
              <span>Offline / Local DB</span>
            </span>
          )}
          <button className="w-9 h-9 hidden sm:flex items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 transition active:scale-95" title="Scan QR">
            <QrCode size={20} />
          </button>
          <Link 
            href="/billing" 
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm px-3.5 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Receipt size={16} />
            <span>+ New Bill</span>
          </Link>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            title="Sign Out"
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      {/* Main Navigation Bar */}
      <nav className="bg-slate-800 text-slate-200 border-b border-slate-700 hidden lg:block print:hidden shadow-inner">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href} prefetch={false}
                className={`flex items-center space-x-2 px-3.5 py-3 text-xs font-semibold transition border-b-2 ${
                  isActive
                    ? 'border-blue-400 text-white bg-slate-900/60'
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm lg:hidden print:hidden" onClick={() => setMobileOpen(false)}>
          <div 
            className="fixed top-0 left-0 bottom-0 w-3/4 max-w-xs bg-slate-900 text-slate-100 p-5 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center space-x-2 font-bold text-lg">
                  <Printer className="text-blue-400" size={20} />
                  <span>PrintPro ERP</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href} prefetch={false}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-rose-950/40 text-rose-400 py-2.5 rounded-lg text-xs font-semibold border border-slate-700"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
              <div className="text-[10px] text-slate-500 text-center">
                PrintPro ERP Terminal v2.0
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
