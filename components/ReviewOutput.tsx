
import React from 'react';

interface ReviewOutputProps {
  review: string;
}

const ReviewOutput: React.FC<ReviewOutputProps> = ({ review }) => {
  // Split the review by code blocks, keeping the delimiters
  const parts = review.split(/(\`\`\`[\s\S]*?\`\`\`)/g);

  const renderMarkdownLine = (line: string, key: string | number) => {
    if (line.startsWith('# ')) {
      return <h1 key={key} className="text-2xl font-bold mt-8 mb-4 pb-2 border-b-2 border-base-300 dark:border-dark-base-300">{line.substring(2)}</h1>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={key} className="text-xl font-bold mt-8 mb-4 pb-2 border-b border-base-300 dark:border-dark-base-300">{line.substring(3)}</h2>;
    }
    if (line.startsWith('### ')) {
      return <h3 key={key} className="text-lg font-semibold mt-6 mb-2 text-brand-secondary">{line.substring(4)}</h3>;
    }
    if (line.trim().startsWith('* ')) {
      // Use a list element for bullet points
      return <li key={key} className="ml-5 list-disc my-1">{line.trim().substring(2)}</li>;
    }
     if (line.trim().startsWith('- ')) {
      // Also support hyphens for lists
      return <li key={key} className="ml-5 list-disc my-1">{line.trim().substring(2)}</li>;
    }
    if (line.trim() === '---') {
      return <hr key={key} className="my-6 border-base-300 dark:border-dark-base-300" />;
    }
    return <p key={key} className="my-2 leading-relaxed">{line}</p>;
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          // It's a code block
          const codeBlock = part.replace(/```[\w\s]*\n?/, '').replace(/\n?```/, '');
          return (
            <pre key={index} className="bg-base-200 dark:bg-dark-base-300 text-base-content dark:text-dark-content p-4 my-4 rounded-md overflow-x-auto text-sm font-mono shadow-inner">
              <code>{codeBlock}</code>
            </pre>
          );
        }
        // It's regular text, process line by line
        return (
          <div key={index}>
            {part.split('\n').map((line, lineIndex) => (
              renderMarkdownLine(line, `${index}-${lineIndex}`)
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default ReviewOutput;
