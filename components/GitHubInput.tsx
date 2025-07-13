import React from 'react';
import { RepoIcon } from './icons/RepoIcon';

interface GitHubInputProps {
  url: string;
  setUrl: (url: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const GitHubInput: React.FC<GitHubInputProps> = ({ url, setUrl, onAnalyze, isAnalyzing }) => {
  return (
    <div className="bg-base-100 dark:bg-dark-base-200 rounded-lg shadow-lg p-4">
       <h2 className="text-xl font-bold text-base-content dark:text-dark-content mb-3">
        Analyze a GitHub Repository
      </h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-grow">
          <RepoIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter a public GitHub repository URL (e.g., https://github.com/owner/repo)"
            disabled={isAnalyzing}
            className="w-full pl-10 pr-4 py-2 border border-base-300 dark:border-dark-base-300 rounded-lg bg-base-200 dark:bg-dark-base-100 focus:ring-2 focus:ring-brand-secondary focus:border-brand-secondary outline-none transition-colors"
            aria-label="GitHub Repository URL"
            onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
          />
        </div>
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || !url}
          className="flex items-center justify-center gap-2 px-6 py-2 bg-brand-secondary hover:bg-blue-600 text-white font-bold rounded-lg shadow-md transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 dark:focus:ring-offset-dark-base-200"
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <RepoIcon className="w-5 h-5" />
              <span>Analyze Repository</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default GitHubInput;