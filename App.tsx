import React, { useState, useCallback } from 'react';
import { 
  generateArchitecturalSummary, reviewFileWithContext, synthesizeFinalReport, 
  findRecommendedRepos, RecommendedRepo, generateVisualDocumentation, 
  VisualDocumentationData, startOrContinueChat, ChatMessage
} from './services/geminiService';
import { startRepositoryAnalysis, RepoAnalysisData } from './services/githubService';
import Header from './components/Header';
import ReviewOutput from './components/ReviewOutput';
import ErrorMessage from './components/ErrorMessage';
import SparklesIcon from './components/icons/SparklesIcon';
import GitHubInput from './components/GitHubInput';
import AnalysisProgress, { AnalysisStatus } from './components/AnalysisProgress';
import Recommendations from './components/Recommendations';
import SearchIcon from './components/icons/SearchIcon';
import VisualDocumentation from './components/VisualDocumentation';
import DiagramIcon from './components/icons/DiagramIcon';

const App: React.FC = () => {
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [review, setReview] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // State for repository context to pass to Deep Wiki
  const [repoDataForWiki, setRepoDataForWiki] = useState<RepoAnalysisData | null>(null);
  const [architecturalSummaryForWiki, setArchitecturalSummaryForWiki] = useState<string>('');

  // State for Recommendations
  const [isSearchingRecs, setIsSearchingRecs] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedRepo | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  
  // State for Deep Wiki
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [visualDocs, setVisualDocs] = useState<VisualDocumentationData | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);


  const resetState = () => {
    setReview('');
    setError(null);
    setRecommendations(null);
    setRecommendationError(null);
    setVisualDocs(null);
    setDocError(null);
    setRepoDataForWiki(null);
    setArchitecturalSummaryForWiki('');
    setChatHistory([]);
  };

  const handleRepoAnalysis = useCallback(async () => {
    if (!githubUrl.trim()) {
      setError('Please enter a GitHub repository URL.');
      return;
    }
    setIsProcessing(true);
    resetState();

    try {
      const updateCallback = (status: AnalysisStatus) => setAnalysisStatus(status);
      const repoData = await startRepositoryAnalysis(githubUrl, updateCallback);
      
      if (repoData.codeFiles.length === 0) {
        throw new Error("Could not find any reviewable source code files in this repository.");
      }
      setRepoDataForWiki(repoData); // Save for Wiki

      updateCallback({ stage: 'SUMMARIZING', message: 'Generating architectural summary...', progress: { current: 0, total: 0 } });
      const archSummary = await generateArchitecturalSummary(repoData.structuralFiles);
      setArchitecturalSummaryForWiki(archSummary); // Save for Wiki

      const individualReviews: string[] = [];
      for (let i = 0; i < repoData.codeFiles.length; i++) {
        const file = repoData.codeFiles[i];
        updateCallback({
          stage: 'REVIEWING',
          message: `Reviewing ${file.path}...`,
          progress: { current: i + 1, total: repoData.codeFiles.length },
        });
        const fileReview = await reviewFileWithContext(file, archSummary);
        individualReviews.push(`--- Review for ${file.path} ---\n${fileReview}`);
      }

      updateCallback({ stage: 'SYNTHESIZING', message: 'Compiling final report...', progress: { current: 0, total: 0 } });
      const finalReport = await synthesizeFinalReport(individualReviews.join('\n\n'));
      setReview(finalReport);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Analysis Failed: ${errorMessage}`);
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
    } finally {
      setIsSearchingRecs(false);
    }
  }, [review]);

  const handleGenerateVisualDocs = useCallback(async () => {
    if (!repoDataForWiki || !architecturalSummaryForWiki) return;
    setIsGeneratingDocs(true);
    setDocError(null);
    setVisualDocs(null);
    try {
        const docs = await generateVisualDocumentation(repoDataForWiki, architecturalSummaryForWiki);
        setVisualDocs(docs);
    } catch(err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setDocError(`Failed to generate documentation: ${errorMessage}`);
    } finally {
        setIsGeneratingDocs(false);
    }
  }, [repoDataForWiki, architecturalSummaryForWiki]);
  
  const handleChatSubmit = useCallback(async (message: string) => {
    if (!visualDocs || !repoDataForWiki || !architecturalSummaryForWiki) return;
    
    const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
    setChatHistory(prev => [...prev, newUserMessage]);
    setIsChatting(true);

    try {
      const response = await startOrContinueChat(
        [...chatHistory, newUserMessage],
        repoDataForWiki,
        architecturalSummaryForWiki,
        visualDocs
      );
      const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response }] };
      setChatHistory(prev => [...prev, modelMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      const errorResponse: ChatMessage = { role: 'model', parts: [{ text: `Sorry, an error occurred: ${errorMessage}`}]};
      setChatHistory(prev => [...prev, errorResponse]);
    } finally {
      setIsChatting(false);
    }
  }, [visualDocs, repoDataForWiki, architecturalSummaryForWiki, chatHistory]);


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

        <div className="bg-base-100 dark:bg-dark-base-200 rounded-lg shadow-lg overflow-hidden flex flex-col flex-grow" style={{minHeight: '60vh'}}>
          <div className="p-4 border-b border-base-300 dark:border-dark-base-300">
            <h2 className="text-xl font-bold text-base-content dark:text-dark-content">Analysis Report</h2>
          </div>
          <div className="p-6 flex-grow overflow-y-auto">
            {isProcessing && analysisStatus && <AnalysisProgress status={analysisStatus} />}
            {error && <ErrorMessage message={error} />}
            {!isProcessing && !error && review && (
              <>
                <ReviewOutput review={review} />
                
                {/* Post-analysis actions */}
                <div className="mt-8 pt-6 border-t border-base-300 dark:border-dark-base-300 space-y-8">
                   {/* Deep Wiki Section */}
                   <div>
                    {!visualDocs && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold">Explore Further</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Generate diagrams and start a conversation with an AI assistant about this repo.</p>
                            </div>
                            <button
                                onClick={handleGenerateVisualDocs}
                                disabled={isGeneratingDocs}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isGeneratingDocs ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <DiagramIcon className="w-5 h-5" />
                                        <span>Generate Visual Docs</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                    {isGeneratingDocs && (
                        <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 py-8">
                            <DiagramIcon className="w-12 h-12 mb-4 text-gray-400 dark:text-gray-500 animate-pulse-fast" />
                            <p className="text-lg font-semibold">Generating visual documentation...</p>
                            <p className="mt-1 text-sm">This can take a moment as the AI analyzes the codebase.</p>
                        </div>
                    )}
                    {docError && <ErrorMessage message={docError} />}
                    {visualDocs && (
                        <VisualDocumentation
                            docs={visualDocs}
                            messages={chatHistory}
                            isChatting={isChatting}
                            onChatSubmit={handleChatSubmit}
                        />
                    )}
                   </div>

                   {/* Recommendations Section */}
                   <div className="pt-8 border-t border-base-300 dark:border-dark-base-300">
                    {!recommendations && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold">Find Similar Projects</h3>
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
                                <span>Find Recommended Repos</span>
                            </>
                            )}
                        </button>
                        </div>
                    )}
                    {isSearchingRecs && (
                        <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 py-8">
                            <SearchIcon className="w-12 h-12 mb-4 text-gray-400 dark:text-gray-500 animate-pulse-fast" />
                            <p className="text-lg font-semibold">Searching for relevant repositories...</p>
                        </div>
                    )}
                    {recommendationError && <ErrorMessage message={recommendationError} />}
                    {recommendations && <Recommendations recommendations={recommendations} />}
                   </div>
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