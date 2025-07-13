
import { AnalysisStatus } from "../components/AnalysisProgress";

export interface CodeFile {
  path: string;
  content: string;
}

export interface RepoAnalysisData {
  structuralFiles: CodeFile[];
  codeFiles: CodeFile[];
}

// --- Helper Functions ---

const GITHUB_API_BASE = 'https://api.github.com';

const parseRepoUrl = (url: string): { owner: string; repo: string } => {
  try {
    const urlObject = new URL(url);
    if (urlObject.hostname !== 'github.com') {
      throw new Error(); // Let catch block handle it
    }
    const pathParts = urlObject.pathname.split('/').filter(p => p);
    if (pathParts.length < 2) {
      throw new Error();
    }
    return { owner: pathParts[0], repo: pathParts[1] };
  } catch {
    throw new Error("Invalid GitHub repository URL. Please provide a URL like 'https://github.com/owner/repo'.");
  }
};

const getRepoDefaultBranch = async (owner: string, repo: string): Promise<string> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`);
  if (!response.ok) {
    throw new Error(`Could not fetch repository data. Status: ${response.status}`);
  }
  const data = await response.json();
  return data.default_branch;
};

const getRepoFileTree = async (owner: string, repo: string, branch: string): Promise<{ path: string; type: string }[]> => {
    const branchResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${branch}`);
    if (!branchResponse.ok) throw new Error(`Could not fetch branch details.`);
    const branchData = await branchResponse.json();
    const treeSha = branchData.commit.sha;
    
    const treeResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
    if (!treeResponse.ok) throw new Error(`Could not fetch repository file tree.`);
    const treeData = await treeResponse.json();

    if (treeData.truncated) {
        console.warn("Repository file tree is truncated. Analysis may be incomplete.");
    }

    return treeData.tree.filter((node: any) => node.type === 'blob').map((node: any) => ({ path: node.path, type: node.type }));
};


// --- File Selection Logic ---

const STRUCTURAL_FILE_PATTERNS = [
  'package.json', 'tsconfig.json', 'vite.config.ts', 'webpack.config.js',
  'pom.xml', 'build.gradle', 'pyproject.toml', 'requirements.txt',
  'composer.json', 'Gemfile', 'go.mod', 'Cargo.toml', '.eslintrc.json'
];

const CODE_FILE_PRIORITY = [
    'src/main.ts', 'src/main.js', 'src/index.ts', 'src/index.js',
    'src/App.tsx', 'src/App.jsx', 'src/app.py', 'src/main.py',
    'src/server.js', 'src/server.ts', 'lib/main.dart'
];

const isCodeFile = (path: string): boolean => {
    // A simple heuristic to identify source code vs. config, docs, assets, etc.
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.rb', '.php', '.html', '.css'];
    const nonCodeDirs = ['node_modules', 'dist', 'build', 'docs', 'test', 'tests', 'assets', 'public', '.github', '.vscode'];

    if (nonCodeDirs.some(dir => path.includes(`/${dir}/`)) || nonCodeDirs.some(dir => path.startsWith(`${dir}/`))) {
        return false;
    }
    return codeExtensions.some(ext => path.endsWith(ext));
};


const selectFilesForAnalysis = (fileList: { path: string }[]): { structural: string[], code: string[] } => {
    const structural = fileList
        .filter(f => STRUCTURAL_FILE_PATTERNS.includes(f.path))
        .map(f => f.path);
    
    let code = fileList
        .filter(f => isCodeFile(f.path))
        .map(f => f.path);

    // Prioritize common entry files
    code.sort((a, b) => {
        const aPrio = CODE_FILE_PRIORITY.indexOf(a);
        const bPrio = CODE_FILE_PRIORITY.indexOf(b);
        if (aPrio === -1 && bPrio === -1) return a.localeCompare(b); // Alphabetical for non-priority
        if (aPrio === -1) return 1;
        if (bPrio === -1) return -1;
        return aPrio - bPrio;
    });

    // Limit to 5 code files to keep API usage reasonable
    return { structural, code: code.slice(0, 5) };
}


// --- Main Orchestrator Function ---

export const startRepositoryAnalysis = async (
    repoUrl: string,
    updateProgress: (status: AnalysisStatus) => void
): Promise<RepoAnalysisData> => {

    updateProgress({ stage: 'INITIALIZING', message: 'Parsing repository URL...', progress: {current: 0, total: 0} });
    const { owner, repo } = parseRepoUrl(repoUrl);

    updateProgress({ stage: 'FETCHING', message: 'Getting default branch...', progress: {current: 0, total: 0} });
    const branch = await getRepoDefaultBranch(owner, repo);
    
    updateProgress({ stage: 'FETCHING', message: 'Fetching file list...', progress: {current: 0, total: 0} });
    const fileTree = await getRepoFileTree(owner, repo, branch);
    
    const { structural, code } = selectFilesForAnalysis(fileTree);
    const filesToFetch = [...structural, ...code];
    
    if (filesToFetch.length === 0) {
        throw new Error("Could not find any relevant files to analyze in this repository.");
    }
    
    const fetchPromises = filesToFetch.map(async (path) => {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        return { path, content: await response.text() };
    });

    updateProgress({ stage: 'FETCHING', message: `Fetching ${filesToFetch.length} files...`, progress: {current: 0, total: 0} });
    const allFiles = await Promise.all(fetchPromises);
    
    return {
        structuralFiles: allFiles.filter(f => structural.includes(f.path)),
        codeFiles: allFiles.filter(f => code.includes(f.path))
    };
};
