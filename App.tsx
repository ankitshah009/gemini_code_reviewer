
import React, { useState, useCallback } from 'react';
import { generateArchitecturalSummary, reviewFileWithContext, synthesizeFinalReport, findRecommendedRepos, RecommendedRepo } from './services/geminiService';
import { startRepositoryAnalysis, RepoAnalysisData } from './services/githubService';
import Header from './components/Header';
import ReviewOutput from './components/ReviewOutput';
import ErrorMessage from './components/ErrorMessage';
import SparklesIcon from './components/icons/SparklesIcon';
import GitHubInput from './components/GitHubInput';
import AnalysisProgress, { AnalysisStatus } from './components/AnalysisProgress';
import Recommendations from './components/Recommendations';
import SearchIcon from './components/icons/SearchIcon';

const App: React.FC = () => {
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [review, setReview] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isSearchingRecs, setIsSearchingRecs] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedRepo | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  const handleRepoAnalysis = useCallback(async () => {
    if (!githubUrl.trim()) {
      setError('Please enter a GitHub repository URL.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    setReview('');
    setRecommendations(null);
    setRecommendationError(null);

    try {
      const updateCallback = (status: AnalysisStatus) => {
        setAnalysisStatus(status);
      };

      // Step 1: Fetch repo structure and file contents
      const repoData: RepoAnalysisData = await startRepositoryAnalysis(githubUrl, updateCallback);

      if (repoData.codeFiles.length === 0) {
        throw new Error("Could not find any reviewable source code files in this repository.");
      }

      // Step 2: Generate architectural summary
      updateCallback({ stage: 'SUMMARIZING', message: 'Generating architectural summary...', progress: { current: 0, total: 0 } });
      const architecturalSummary = await generateArchitecturalSummary(repoData.structuralFiles);

      // Step 3: Review individual files with context
      const individualReviews: string[] = [];
      for (let i = 0; i < repoData.codeFiles.length; i++) {
        const file = repoData.codeFiles[i];
        updateCallback({
          stage: 'REVIEWING',
          message: `Reviewing ${file.path}...`,
          progress: { current: i + 1, total: repoData.codeFiles.length },
        });
        const fileReview = await reviewFileWithContext(file, architecturalSummary);
        individualReviews.push(`--- Review for ${file.path} ---\n${fileReview}`);
      }

      // Step 4: Synthesize the final report
      updateCallback({ stage: 'SYNTHESIZING', message: 'Compiling final report...', progress: { current: 0, total: 0 } });
      const finalReport = await synthesizeFinalReport(individualReviews.join('\n\n'));
      setReview(finalReport);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Analysis Failed: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsProcessing(false);
      setAnalysisStatus(null);
    }
  }, [githubUrl]);

  const handleFindRecommendations = useCallback(async () => {
    if (!review) return;
    setIsSearchingRecs(true);
    setRecommendationError(null);
    setRecommendations(null);
    try {
      const recs = await findRecommendedRepos(review);
      setRecommendations(recs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setRecommendationError(`Failed to find recommendations: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsSearchingRecs(false);
    }
  }, [review]);


  return (
    <div className="min-h-screen flex flex-col font-sans bg-base-200 dark:bg-dark-base-100 text-base-content dark:text-dark-content">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 flex flex-col gap-6">
        <GitHubInput
          url={githubUrl}
          setUrl={setGithubUrl}
          onAnalyze={handleRepoAnalysis}
          isAnalyzing={isProcessing}
        />

        <div className="bg-base-100 dark:bg-dark-base-200 rounded-lg shadow-lg overflow-hidden flex flex-col flex-grow" style={{minHeight: '50vh'}}>
          <div className="p-4 border-b border-base-300 dark:border-dark-base-300">
            <h2 className="text-xl font-bold text-base-content dark:text-dark-content">Analysis Report</h2>
          </div>
          <div className="p-6 flex-grow overflow-y-auto">
            {isProcessing && analysisStatus && <AnalysisProgress status={analysisStatus} />}
            {error && <ErrorMessage message={error} />}
            {!isProcessing && !error && review && (
              <>
                <ReviewOutput review={review} />
                <div className="mt-8 pt-6 border-t border-base-300 dark:border-dark-base-300">
                  {!recommendations && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold">Next Step</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Find open-source repositories that exemplify best practices based on this analysis.</p>
                      </div>
                      <button
                        onClick={handleFindRecommendations}
                        disabled={isSearchingRecs}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-900 text-white font-bold rounded-lg shadow-md transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isSearchingRecs ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Searching...</span>
                          </>
                        ) : (
                          <>
                            <SearchIcon className="w-5 h-5" />
                            <span>Find Recommended Repositories</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {isSearchingRecs && (
                     <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 py-8">
                        <SearchIcon className="w-12 h-12 mb-4 text-gray-400 dark:text-gray-500 animate-pulse-fast" />
                        <p className="text-lg font-semibold">Searching for relevant repositories...</p>
                        <p className="mt-1 text-sm">Using Google Search to find the best examples for you.</p>
                    </div>
                  )}
                  {recommendationError && <ErrorMessage message={recommendationError} />}
                  {recommendations && <Recommendations recommendations={recommendations} />}
                </div>
              </>
            )}
            {!isProcessing && !error && !review && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                <SparklesIcon className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-500" />
                <p className="text-lg font-semibold">Your full repository analysis will appear here.</p>
                <p className="mt-1 text-sm">Enter a public GitHub repository URL to get started.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-gray-500 dark:text-gray-400">
        Powered by Google Gemini
      </footer>
    </div>
  );
};

export default App;
