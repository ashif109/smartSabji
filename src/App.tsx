import React from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Causes from './components/Causes';
import ImpactStats from './components/ImpactStats';
import MainContent from './components/MainContent';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';

/**
 * App Component
 * Orchestrates the modularized NGO website structure.
 * Designed for production readiness with premium aesthetics.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      <Header />
      <Navbar />
      
      <main className="flex-grow">
        <Hero />
        <Causes />
        <ImpactStats />
        
        <div className="institutional-container py-24">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-16">
            {/* Primary Page Content */}
            <MainContent />
            
            {/* Contextual Sidebars */}
            <Sidebar />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
