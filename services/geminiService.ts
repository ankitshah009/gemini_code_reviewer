
import { GoogleGenAI, GenerateContentResponse, Type, Chat, Part, Content } from "@google/genai";
import { CodeFile, RepoAnalysisData } from "./githubService";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-flash";

// --- Interfaces ---
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

export interface VisualDocumentationData {
    architectureDiagram: string;
    dependencyGraph: string;
    flowchart: string;
    classDiagram: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: Part[];
}

// --- Helper Functions ---

const callGeminiWithRetry = async (prompt: string, isJson: boolean = false): Promise<any> => {
   try {
    const config = isJson ? { responseMimeType: "application/json" } : {};
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config
    });
    return isJson ? JSON.parse(response.text) : response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while communicating with the Gemini API.");
  }
}

// --- Core Analysis Functions ---

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
    return callGeminiWithRetry(prompt);
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
    return callGeminiWithRetry(prompt);
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
    return callGeminiWithRetry(prompt);
};


// --- Post-Analysis Functions ---

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
        
        const sources: GroundingSource[] = groundingChunks
            .filter(chunk => chunk.web && chunk.web.uri && chunk.web.title)
            .map(chunk => ({
                web: {
                    uri: chunk.web!.uri!,
                    title: chunk.web!.title!,
                },
            }));
        
        return { text, sources };
    } catch (error) {
        console.error("Error calling Gemini API with Google Search:", error);
        if (error instanceof Error) throw new Error(`Gemini API Error: ${error.message}`);
        throw new Error("An unexpected error occurred while communicating with the Gemini API.");
    }
};


// --- Deep Wiki Functions ---

const VISUAL_DOCS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    architectureDiagram: {
      type: Type.STRING,
      description: "Mermaid syntax for a C4-style component diagram showing the main components and their relationships.",
    },
    dependencyGraph: {
      type: Type.STRING,
      description: "Mermaid syntax for a graph showing dependencies between the analyzed files.",
    },
    flowchart: {
      type: Type.STRING,
      description: "Mermaid syntax for a flowchart illustrating a primary user flow or data process.",
    },
    classDiagram: {
        type: Type.STRING,
        description: "Mermaid syntax for a class diagram for any object-oriented structures found. Can be an empty string if not applicable."
    }
  },
  required: ["architectureDiagram", "dependencyGraph", "flowchart", "classDiagram"]
};

const VISUAL_DOCS_PROMPT = `
You are a software documentation specialist. Analyze the provided repository context, including the architectural summary and file contents, to generate visual diagrams.
Produce Mermaid.js syntax for each of the requested diagram types.
- For the architecture diagram, focus on the main software components and their interactions.
- For the dependency graph, show how the provided files import or depend on one another.
- For the flowchart, pick a single, critical process (like user registration, data processing, or the main application loop) and map it out.
- For the class diagram, represent the primary classes and their inheritance/composition relationships. If the code is not object-oriented, you may return an empty string for this diagram.
The output must be a valid JSON object matching the specified schema.

Architectural Summary:
---
{{ARCHITECTURAL_SUMMARY}}
---
Repository Files:
---
{{FILES_CONTENT}}
---
`;

export const generateVisualDocumentation = async (repoData: RepoAnalysisData, architecturalSummary: string): Promise<VisualDocumentationData> => {
    const allFiles = [...repoData.structuralFiles, ...repoData.codeFiles];
    const filesContent = allFiles.map(file => `--- File: ${file.path} ---\n${file.content}`).join('\n\n');
    let prompt = VISUAL_DOCS_PROMPT.replace('{{ARCHITECTURAL_SUMMARY}}', architecturalSummary);
    prompt = prompt.replace('{{FILES_CONTENT}}', filesContent);

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: VISUAL_DOCS_SCHEMA
        }
    });

    return JSON.parse(response.text);
};


const CHAT_SYSTEM_PROMPT = `
You are "DeepWiki", a conversational AI assistant for codebases.
You have been provided with comprehensive context about a GitHub repository, including:
1. An architectural summary.
2. The contents of key files.
3. A full code review report.
4. Mermaid.js diagrams illustrating the architecture, dependencies, and flows.

Your primary purpose is to answer user questions about the repository based on this context. Be helpful, accurate, and concise.
When a question refers to a diagram, reference it by name (e.g., "In the Architecture Diagram...").
Do not go outside the provided context. If a question cannot be answered with the given information, say so politely.

Full Repository Context:
---
Architectural Summary:
{{ARCHITECTURAL_SUMMARY}}

Visual Documentation (Mermaid Syntax):
{{VISUAL_DOCS}}

Repository Files:
{{FILES_CONTENT}}
---
`;

export const startOrContinueChat = async (
    history: ChatMessage[],
    repoData: RepoAnalysisData,
    architecturalSummary: string,
    visualDocs: VisualDocumentationData
): Promise<string> => {
    
    const allFiles = [...repoData.structuralFiles, ...repoData.codeFiles];
    const filesContent = allFiles.map(file => `--- File: ${file.path} ---\n${file.content}`).join('\n\n');
    const visualDocsString = JSON.stringify(visualDocs, null, 2);

    let systemInstruction = CHAT_SYSTEM_PROMPT.replace('{{ARCHITECTURAL_SUMMARY}}', architecturalSummary);
    systemInstruction = systemInstruction.replace('{{VISUAL_DOCS}}', visualDocsString);
    systemInstruction = systemInstruction.replace('{{FILES_CONTENT}}', filesContent);

    const chat: Chat = ai.chats.create({
        model: model,
        config: {
            systemInstruction: systemInstruction,
        },
        // The Gemini `history` format is slightly different, so we map our state to it.
        history: history.slice(0, -1).map(msg => ({
            role: msg.role,
            parts: msg.parts
        }))
    });

    const lastMessage = history[history.length - 1];
    
    const result: GenerateContentResponse = await chat.sendMessage({ message: lastMessage.parts });
    
    return result.text;
};