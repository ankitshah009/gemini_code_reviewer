
import React from 'react';
import { RecommendedRepo } from '../services/geminiService';
import ReviewOutput from './ReviewOutput';
import GitHubIcon from './icons/GitHubIcon';

interface RecommendationsProps {
  recommendations: RecommendedRepo;
}

const Recommendations: React.FC<RecommendationsProps> = ({ recommendations }) => {
  return (
    <div>
      <h3 className="text-xl font-bold text-base-content dark:text-dark-content mb-4 pb-2 border-b-2 border-brand-secondary">
        Recommended Repositories
      </h3>
      
      <div className="mb-6">
        <ReviewOutput review={recommendations.text} />
      </div>

      {recommendations.sources && recommendations.sources.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-base-content dark:text-dark-content mb-3">Sources to Explore:</h4>
          <ul className="space-y-3">
            {recommendations.sources.map((source, index) => (
              <li key={index} className="flex items-start gap-3">
                <GitHubIcon className="w-5 h-5 text-brand-secondary flex-shrink-0 mt-1" />
                <div>
                    <a
                    href={source.web.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors"
                    >
                    {source.web.title || new URL(source.web.uri).hostname}
                    </a>
                    <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{source.web.uri}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Recommendations;
