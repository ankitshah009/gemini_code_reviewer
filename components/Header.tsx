
import React from 'react';
import CodeIcon from './icons/CodeIcon';

const Header: React.FC = () => {
  return (
    <header className="bg-base-100 dark:bg-dark-base-200 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-secondary rounded-lg">
            <CodeIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-base-content dark:text-dark-content">
            Gemini Code Reviewer
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;
