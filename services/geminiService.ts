
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { CodeFile } from "./githubService";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-flash";

export interface GroundingSource {
    web: {
        uri: string;
        title: string;
    };
}

export interface RecommendedRepo {
    text: string;
    sources: GroundingSource[];
}

const callGemini = async (prompt: string): Promise<string> => {
   try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while communicating with the Gemini API.");
  }
}

const ARCHITECTURE_PROMPT_TEMPLATE = `
You are a principal software architect. Based on the file contents of these configuration and package management files, provide a concise summary of the project's architecture.
Identify the primary language, framework, key libraries, and their roles. Describe the likely purpose and structure of the application.
The summary should be dense and technical, intended for another engineer. Do not offer suggestions, only analyze.
Format the output as clean markdown.

Files:
{{FILES_CONTENT}}
`;

export const generateArchitecturalSummary = async (structuralFiles: CodeFile[]): Promise<string> => {
    if (structuralFiles.length === 0) {
        return "No structural files (like package.json) were found to determine the project's architecture.";
    }
    const filesContent = structuralFiles.map(file => `--- File: ${file.path} ---\n${file.content}`).join('\n\n');
    const prompt = ARCHITECTURE_PROMPT_TEMPLATE.replace('{{FILES_CONTENT}}', filesContent);
    return callGemini(prompt);
};


const FILE_REVIEW_PROMPT_TEMPLATE = `
As a senior engineer, review the following code file. Your review must be informed by the project's overall architecture, provided below for context.
Focus on how this specific file adheres to or deviates from the architectural patterns, its specific role, and any potential integration issues.
Also cover standard code quality aspects like bugs, readability, and best practices.
Provide your feedback in well-structured Markdown format. Use headings (e.g., '### Bugs and Errors'), bullet points (using '*'), and code blocks.

Architectural Context:
---
{{ARCHITECTURAL_SUMMARY}}
---

Code File to Review (Path: {{FILE_PATH}}):
\`\`\`
{{CODE}}
\`\`\`
`;

export const reviewFileWithContext = async (file: CodeFile, architecturalSummary: string): Promise<string> => {
    let prompt = FILE_REVIEW_PROMPT_TEMPLATE.replace('{{ARCHITECTURAL_SUMMARY}}', architecturalSummary);
    prompt = prompt.replace('{{FILE_PATH}}', file.path);
    prompt = prompt.replace('{{CODE}}', file.content);
    return callGemini(prompt);
};

const SYNTHESIS_PROMPT_TEMPLATE = `
You are a lead software engineer synthesizing multiple code reviews from your team into a single, cohesive report for the project lead.
The goal is to provide a high-level overview of the repository's health, identify recurring patterns (both good and bad), and create a prioritized list of actionable recommendations for the entire repository.
Do not just list the individual reviews. Instead, group related findings, identify systemic issues, and provide a holistic assessment.
The final output should be a well-structured, professional report in Markdown format. Start with an executive summary.

Here are the individual file reviews to synthesize:
---
{{INDIVIDUAL_REVIEWS}}
---
`;

export const synthesizeFinalReport = async (individualReviews: string): Promise<string> => {
    const prompt = SYNTHESIS_PROMPT_TEMPLATE.replace('{{INDIVIDUAL_REVIEWS}}', individualReviews);
    return callGemini(prompt);
};

const RECOMMENDATION_PROMPT_TEMPLATE = `
Based on the following code review report, act as a developer advocate and recommend 3-5 high-quality, open-source GitHub repositories that demonstrate best practices the user could learn from.
For each recommendation, explain *why* it is relevant to the user's project, referencing specific points from their report.
Focus your search on projects that are well-maintained and considered good examples of software engineering for the technologies mentioned in the report.

Code Review Report:
---
{{REPORT}}
---
`;

export const findRecommendedRepos = async (report: string): Promise<RecommendedRepo> => {
    const prompt = RECOMMENDATION_PROMPT_TEMPLATE.replace('{{REPORT}}', report);
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            },
        });

        const text = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        // Filter out sources that might be empty or invalid
        const sources = groundingChunks.filter((chunk: any) => chunk.web && chunk.web.uri && chunk.web.title);
        
        return { text, sources };
    } catch (error) {
        console.error("Error calling Gemini API with Google Search:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
        throw new Error("An unexpected error occurred while communicating with the Gemini API.");
    }
};
