
import React from 'react';
import SparklesIcon from './icons/SparklesIcon';

export interface AnalysisStatus {
  stage: 'INITIALIZING' | 'FETCHING' | 'SUMMARIZING' | 'REVIEWING' | 'SYNTHESIZING';
  message: string;
  progress: {
    current: number;
    total: number;
  };
}

interface AnalysisProgressProps {
  status: AnalysisStatus;
}

const STAGE_CONFIG = {
    INITIALIZING: { title: "Initializing...", totalSteps: 4, currentStep: 1 },
    FETCHING: { title: "Fetching Repository...", totalSteps: 4, currentStep: 1 },
    SUMMARIZING: { title: "Creating Architectural Summary...", totalSteps: 4, currentStep: 2 },
    REVIEWING: { title: "Reviewing Code Files...", totalSteps: 4, currentStep: 3 },
    SYNTHESIZING: { title: "Compiling Final Report...", totalSteps: 4, currentStep: 4 },
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ status }) => {
  const config = STAGE_CONFIG[status.stage];
  const isReviewing = status.stage === 'REVIEWING' && status.progress.total > 0;
  const reviewProgress = isReviewing ? (status.progress.current / status.progress.total) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 dark:text-gray-300 p-4">
        <SparklesIcon className="w-16 h-16 text-brand-secondary animate-pulse-fast mb-6" />
        
        <div className="w-full max-w-md">
            <h2 className="text-xl font-bold text-base-content dark:text-dark-content mb-2">
                {`Step ${config.currentStep} of ${config.totalSteps}: ${config.title}`}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{status.message}</p>

            {isReviewing && (
                <div className="w-full bg-base-200 dark:bg-dark-base-300 rounded-full h-2.5 my-4 shadow-inner">
                    <div 
                        className="bg-brand-secondary h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${reviewProgress}%` }}
                    ></div>
                </div>
            )}
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
            This may take a few moments. Please don't close the tab.
        </p>
    </div>
  );
};

export default AnalysisProgress;
