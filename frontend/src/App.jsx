import React, { useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-python';
import ReactMarkdown from 'react-markdown';
import 'prismjs/themes/prism.css';
import ThemeToggleSwitch from './components/ThemeToggleSwitch';

import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyToClipboard } from 'react-copy-to-clipboard';

function App() {
  // Define the default initial code
  const defaultCode = `print("Hello, Intelligent Tutor!")\n# Try changing this code!`;

  // Initialize code from localStorage, or use the default
  const [code, setCode] = useState(() => {
    const savedCode = localStorage.getItem('pythonTutorCode');
    return savedCode !== null ? savedCode : defaultCode;
  });
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorHints, setErrorHints] = useState([]);
  const [aiHint, setAiHint] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // To display save/load feedback

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  // State for AI code explanation
  const [aiExplanation, setAiExplanation] = useState('');
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);

  // State for AI fixed code and its loading state
  const [aiFixedCode, setAiFixedCode] = useState('');
  const [isFixingCode, setIsFixingCode] = useState(false);


  // Function to toggle theme between 'light' and 'dark'
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Effect to apply the theme class to the body element and save to localStorage
  useEffect(() => {
    document.body.className = theme + '-theme';
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Effect to save code to localStorage whenever 'code' state changes
  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('pythonTutorCode', code);
      setSaveStatus('Code saved automatically!');
      setTimeout(() => setSaveStatus(''), 2000); // Clear status after 2 seconds
    }, 500); // Debounce saving to avoid saving on every keystroke immediately
    return () => clearTimeout(handler);
  }, [code]);

  // Manual save function
  const saveCodeManually = () => {
    localStorage.setItem('pythonTutorCode', code);
    setSaveStatus('Code saved manually!');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  // Manual load function
  const loadCodeManually = () => {
    const savedCode = localStorage.getItem('pythonTutorCode');
    if (savedCode !== null) {
      setCode(savedCode);
      setSaveStatus('Loaded saved code!');
    } else {
      setSaveStatus('No saved code found!');
    }
    setTimeout(() => setSaveStatus(''), 2000);
  };

  // Function: Reset code to default
  const resetCode = () => {
    setCode(defaultCode);
    setOutput('');
    setError('');
    setErrorHints([]);
    setAiHint('');
    setAiExplanation('');
    setAiFixedCode('');
    setSaveStatus('Code reset to default!');
    setTimeout(() => setSaveStatus(''), 2000);
  };


  // *** MODIFIED ***
  // Custom component to render code blocks in ReactMarkdown
  // This will add syntax highlighting and a copy button for *block* code.
  // Inline code will be handled by a separate component or default markdown rendering.
  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = String(children).replace(/\n$/, '');

    const language = match ? match[1] : 'python'; // Default to python if no language specified

    if (inline) {
        // Render inline code without the copy button and specialized highlighter
        return <code className={className} {...props}>{children}</code>;
    }

    return (
      <div className="code-block-container">
        <CopyToClipboard text={codeContent} onCopy={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}>
          <button className="copy-button">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </CopyToClipboard>
        <SyntaxHighlighter
          style={prism}
          language={language}
          PreTag="pre"
          {...props}
        >
          {codeContent}
        </SyntaxHighlighter>
      </div>
    );
  };

  // *** NEW COMPONENT ***
  // Custom component to render *inline* code specifically
  const InlineCode = ({children}) => {
    return <code className="inline-code">{children}</code>;
  };


  const runCode = async () => {
    setIsLoading(true);
    setOutput('');
    setError('');
    setErrorHints([]);
    setAiHint('');
    setAiExplanation('');
    setAiFixedCode('');

    try {
      const response = await fetch('http://127.0.0.1:5000/run_code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code }),
      });

      const data = await response.json();

      if (response.ok) {
        setOutput(data.output);
        setError(data.error);
        setErrorHints(data.hints || []);
      } else {
        setError(data.error || 'An unknown error occurred on the server.');
        setOutput(data.output || '');
        setErrorHints(data.hints || []);
      }

    } catch (err) {
      console.error('Network or CORS error:', err);
      setError(`Could not connect to the backend. Make sure your Flask server is running at http://127.00.1:5000/. Error: ${err.message}`);
      setErrorHints([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getAiHint = async () => {
    setIsAiLoading(true);
    setAiHint('');
    setAiExplanation('');
    setAiFixedCode('');

    try {
      const response = await fetch('http://127.00.1:5000/get_ai_hint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code, error: error }),
      });

      const data = await response.json();

      if (response.ok) {
        setAiHint(data.ai_hint);
      } else {
        const errorMessage = data.ai_hint || `Failed to get AI hint: ${response.status} ${response.statusText}`;
        setAiHint(errorMessage);
      }

    } catch (err) {
      console.error('Network or CORS error with AI endpoint:', err);
      setAiHint(`Could not connect to the AI backend. Error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const getAiExplanation = async () => {
    setIsExplanationLoading(true);
    setAiExplanation('');
    setAiHint('');
    setAiFixedCode('');

    try {
      const response = await fetch('http://127.00.1:5000/get_ai_explanation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code }),
      });

      const data = await response.json();

      if (response.ok) {
        setAiExplanation(data.ai_explanation);
      } else {
        const errorMessage = data.ai_explanation || `Failed to get AI explanation: ${response.status} ${response.statusText}`;
        setAiExplanation(errorMessage);
      }

    } catch (err) {
      console.error('Network or CORS error with AI explanation endpoint:', err);
      setAiExplanation(`Could not connect to the AI explanation backend. Error: ${err.message}`);
    } finally {
      setIsExplanationLoading(false);
    }
  };

  const getAiFixedCode = async () => {
    setIsFixingCode(true);
    setAiFixedCode('');
    setAiHint('');
    setAiExplanation('');

    try {
      const response = await fetch('http://127.00.1:5000/get_ai_fixed_code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code, error: error }),
      });

      const data = await response.json();

      if (response.ok) {
        setAiFixedCode(data.ai_fixed_code);
      } else {
        const errorMessage = data.ai_fixed_code || `Failed to get AI fix: ${response.status} ${response.statusText}`;
        setAiFixedCode(errorMessage);
      }

    } catch (err) {
      console.error('Network or CORS error with AI fix endpoint:', err);
      setAiFixedCode(`Could not connect to the AI fix backend. Error: ${err.message}`);
    } finally {
      setIsFixingCode(false);
    }
  };


  return (
    <div className="container">
      <header className="header">
        <h1>Intelligent Python Tutor</h1>
        <ThemeToggleSwitch theme={theme} toggleTheme={toggleTheme} />
      </header>

      <div className="content-area">
        <div className="editor-container">
          {/* NEW POSITION FOR RESET BUTTON */}
          <button
            onClick={resetCode}
            className="reset-icon-button"
            title="Reset Code"
          >
            &#x21BB; {/* Unicode reload symbol */}
          </button>

          <div className="editor-wrapper">
            <Editor
              value={code}
              onValueChange={setCode}
              highlight={code => highlight(code, languages.python, 'python')}
              padding={10}
              className="editor"
              textareaId="codeArea"
            />
          </div>
          <div className="button-container">
            <button onClick={runCode} disabled={isLoading} className="button">
              {isLoading ? 'Running...' : 'Run Code'}
            </button>
            <button onClick={getAiHint} disabled={isAiLoading || isLoading} className="button ai-button">
              {isAiLoading ? 'Getting AI Hint...' : 'Get AI Hint'}
            </button>
            <button onClick={getAiExplanation} disabled={isExplanationLoading || isLoading} className="button explain-button">
              {isExplanationLoading ? 'Explaining...' : 'Explain Code'}
            </button>
            <button onClick={getAiFixedCode} disabled={isFixingCode || isLoading} className="button fix-button">
              {isFixingCode ? 'Fixing...' : 'Fix Code'}
            </button>
            <button onClick={saveCodeManually} className="button save-button">
                Save Code
            </button>
            <button onClick={loadCodeManually} className="button load-button">
                Load Saved Code
            </button>
            {saveStatus && <span className="save-status">{saveStatus}</span>}
          </div>
        </div>

        <div className="output-container">
          <h2>Output:</h2>
          <pre className="output-box">{output}</pre>
          {error && (
            <>
              <h2>Errors (Python Traceback):</h2>
              <pre className="output-box error">{error}</pre>
            </>
          )}

          {errorHints.length > 0 && (
            <div className="hints-container">
              <h2>Intelligent Tutor Suggestions:</h2>
              {errorHints.map((hint, index) => (
                <div
                  key={index}
                  className={`hint-item ${hint.type}`}
                >
                  <strong>{hint.type.charAt(0).toUpperCase() + hint.type.slice(1)}:</strong> {hint.message}
                  {hint.line && <span> (Line: {hint.line})</span>}
                </div>
              ))}
            </div>
          )}

          {aiHint && (
            <div className="ai-hint-box">
              <h3>AI Tutor Insight:</h3>
              <ReactMarkdown
                components={{
                  code: CodeBlock, // This will now handle both inline and block based on 'inline' prop
                }}
              >
                {aiHint}
              </ReactMarkdown>
            </div>
          )}

          {aiExplanation && (
            <div className="ai-explanation-box">
              <h3>AI Code Explanation:</h3>
              <ReactMarkdown
                components={{
                  code: CodeBlock, // This will now handle both inline and block based on 'inline' prop
                }}
              >
                {aiExplanation}
              </ReactMarkdown>
            </div>
          )}

          {aiFixedCode && (
            <div className="ai-fixed-code-box">
              <h3>AI Suggested Fix:</h3>
              <ReactMarkdown
                components={{
                  code: CodeBlock, // This will now handle both inline and block based on 'inline' prop
                }}
              >
                {aiFixedCode}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;