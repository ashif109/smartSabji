import React from 'react';
import { MapPin, Mail, Phone, ExternalLink } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#1a1a1a] text-white pt-16 pb-8 mt-20 border-t-8 border-[#0055a5]">
      <div className="institutional-container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* About Column */}
          <div className="md:col-span-1">
            <h4 className="text-lg font-serif font-bold mb-6 border-l-4 border-orange-500 pl-4">About Us</h4>
            <p className="text-[12px] text-gray-400 leading-relaxed mb-6 italic">
              Triyambakam Gurukulam Association is dedicated to the fusion of ancient Indian wisdom with modern scientific inquiry, creating a holistic path for future generations.
            </p>
            <div className="flex gap-4">
              {/* Social icons placeholder */}
              <div className="w-8 h-8 bg-blue-900 flex items-center justify-center rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                <span className="text-[12px] font-bold">f</span>
              </div>
              <div className="w-8 h-8 bg-sky-600 flex items-center justify-center rounded-full cursor-pointer hover:bg-sky-500 transition-colors">
                <span className="text-[12px] font-bold">x</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-serif font-bold mb-6 border-l-4 border-blue-500 pl-4">Quick Links</h4>
            <ul className="space-y-3 text-[11px] font-bold text-gray-400">
              <li className="hover:text-white cursor-pointer transition-colors flex items-center gap-2 group">
                <ExternalLink size={10} className="group-hover:translate-x-1 transition-transform" /> IMPORTANT LINKS
              </li>
              <li className="hover:text-white cursor-pointer transition-colors flex items-center gap-2 group">
                <ExternalLink size={10} className="group-hover:translate-x-1 transition-transform" /> PRIVACY POLICY
              </li>
              <li className="hover:text-white cursor-pointer transition-colors flex items-center gap-2 group">
                <ExternalLink size={10} className="group-hover:translate-x-1 transition-transform" /> DISCLAIMER
              </li>
              <li className="hover:text-white cursor-pointer transition-colors flex items-center gap-2 group">
                <ExternalLink size={10} className="group-hover:translate-x-1 transition-transform" /> HOW TO REACH
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="md:col-span-2">
            <h4 className="text-lg font-serif font-bold mb-6 border-l-4 border-green-500 pl-4">Contact Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="bg-gray-800 p-3 rounded-sm h-fit">
                  <MapPin size={18} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase mb-1">Headquarters</p>
                  <p className="text-[12px] text-gray-400">Haridwar, Uttarakhand<br />India - 249401</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-gray-800 p-3 rounded-sm h-fit">
                  <Mail size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase mb-1">Email Support</p>
                  <p className="text-[12px] text-gray-400">info@triyambakam.org<br />support@triyambakam.org</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 mt-12 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          <p>© 2026 Triyambakam Gurukulam Association. All rights reserved.</p>
          <div className="flex gap-8">
            <span className="hover:text-white cursor-pointer">Sitemap</span>
            <span className="hover:text-white cursor-pointer">Accessibility</span>
            <span className="hover:text-white cursor-pointer">Feedback</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
