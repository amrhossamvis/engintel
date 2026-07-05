'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { ReactNode } from 'react';
import { AppHeader } from './AppHeader';

type ComingSoonProps = {
  title: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  features: string[];
};

export const ComingSoon = ({ title, description, icon, gradient, features }: ComingSoonProps) => {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      <AppHeader
        title={title}
        subtitle={description}
        icon={icon}
        gradient={`bg-gradient-to-r ${gradient}`}
      />

      <main className="flex-1 container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            Coming Soon
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Under Development</h2>
          <p className="text-gray-600 text-lg mb-10">
            This initiative is part of the Engineering Intelligence portfolio and is currently being built.
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-left">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Planned Features</h3>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 mt-0.5">{i + 1}</span>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10">
            <Link href="/" className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition">
              <ArrowLeft className="w-4 h-4" /> Return to Hub
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
