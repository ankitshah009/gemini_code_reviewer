import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { VisualDocumentationData, ChatMessage } from '../services/geminiService';
import ReviewOutput from './ReviewOutput';
import SparklesIcon from './icons/SparklesIcon';

interface VisualDocumentationProps {
  docs: VisualDocumentationData;
  messages: ChatMessage[];
  isChatting: boolean;
  onChatSubmit: (message: string) => void;
}

const Diagram: React.FC<{ title: string; mermaidCode: string; id: string }> = ({ title, mermaidCode, id }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && mermaidCode) {
      mermaid.render(id, mermaidCode)
        .then(({ svg }) => {
          if(ref.current) ref.current.innerHTML = svg;
        })
        .catch(e => console.error(`Mermaid render error for ${id}:`, e));
    }
  }, [mermaidCode, id]);

  if (!mermaidCode || mermaidCode.trim() === 'graph TD' || mermaidCode.trim() === '') {
    return null; // Don't render empty or placeholder diagrams
  }

  return (
    <div className="bg-base-100 dark:bg-dark-base-200 p-4 rounded-lg shadow-md mb-6">
      <h4 className="text-lg font-bold mb-4 text-base-content dark:text-dark-content">{title}</h4>
      <div ref={ref} className="mermaid-diagram-container flex justify-center items-center overflow-auto">
        <div id={id} className="mermaid">{mermaidCode}</div>
      </div>
    </div>
  );
};

const VisualDocumentation: React.FC<VisualDocumentationProps> = ({ docs, messages, isChatting, onChatSubmit }) => {
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && !isChatting) {
      onChatSubmit(newMessage);
      setNewMessage('');
    }
  };

  return (
    <div>
      <h3 className="text-xl font-bold text-base-content dark:text-dark-content mb-4 pb-2 border-b-2 border-green-500">
        Visual Documentation & AI Assistant
      </h3>
      
      {/* Diagrams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Diagram title="Architecture Diagram" mermaidCode={docs.architectureDiagram} id="mermaid-arch" />
        <Diagram title="Dependency Graph" mermaidCode={docs.dependencyGraph} id="mermaid-deps" />
        <Diagram title="Primary Flowchart" mermaidCode={docs.flowchart} id="mermaid-flow" />
        <Diagram title="Class Diagram" mermaidCode={docs.classDiagram} id="mermaid-class" />
      </div>

      {/* Chat Assistant */}
      <div className="bg-base-100 dark:bg-dark-base-200 rounded-lg shadow-lg">
        <div className="p-4 border-b border-base-300 dark:border-dark-base-300">
          <h4 className="text-lg font-bold text-base-content dark:text-dark-content">DeepWiki Assistant</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ask questions about the repository based on the diagrams and analysis.</p>
        </div>
        <div className="h-96 flex flex-col">
          <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <SparklesIcon className="w-12 h-12 mb-4 text-gray-400" />
                    <p className="font-semibold">I'm ready to help!</p>
                    <p className="text-sm">Ask me something like "What is the purpose of the App component?" or "Explain the dependency graph".</p>
                </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                <div className={`rounded-lg p-3 max-w-lg ${msg.role === 'user' ? 'bg-brand-secondary text-white' : 'bg-base-200 dark:bg-dark-base-300'}`}>
                    <ReviewOutput review={msg.parts.map(p => p.text).join('')} />
                </div>
              </div>
            ))}
             {isChatting && (
                <div className="flex items-end gap-2">
                    <div className="rounded-lg p-3 bg-base-200 dark:bg-dark-base-300">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-brand-secondary rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-brand-secondary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            <div className="w-2 h-2 bg-brand-secondary rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                        </div>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 border-t border-base-300 dark:border-dark-base-300">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ask a question..."
                disabled={isChatting}
                className="flex-grow w-full px-4 py-2 border border-base-300 dark:border-dark-base-300 rounded-lg bg-base-200 dark:bg-dark-base-100 focus:ring-2 focus:ring-brand-secondary focus:border-brand-secondary outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isChatting || !newMessage.trim()}
                className="px-6 py-2 bg-brand-secondary hover:bg-blue-600 text-white font-bold rounded-lg shadow-md transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualDocumentation;