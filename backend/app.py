from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import tempfile
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Configure Google Gemini API (reads from .env file)
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Initialize the Gemini model with the correct name
model = genai.GenerativeModel('gemini-1.5-flash')
print(f"DEBUG: Initialized Gemini model with name: {model._model_name}")

# --- Pylint Integration Function ---
def run_pylint_analysis(code):
    hints = []
    with tempfile.NamedTemporaryFile(mode='w+', suffix='.py', delete=False, encoding='utf-8') as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name
    
    try:
        result = subprocess.run(
            ['pylint', '--output-format=json', temp_file_path],
            capture_output=True,
            text=True,
            check=False
        )

        pylint_output = result.stdout
        if pylint_output:
            try:
                messages = json.loads(pylint_output)
                for msg in messages:
                    hint_type = 'hint'
                    if msg['type'] in ['error', 'fatal']:
                        hint_type = 'error'
                    elif msg['type'] == 'warning':
                        hint_type = 'warning'
                    elif msg['type'] == 'refactor':
                        hint_type = 'refactor'
                    elif msg['type'] == 'convention':
                        hint_type = 'hint'

                    hints.append({
                        'type': hint_type,
                        'message': f"[{msg['symbol']}] {msg['message']}",
                        'line': msg['line']
                    })
            except json.JSONDecodeError as e:
                hints.append({
                    'type': 'error',
                    'message': f"Pylint output format error: {e}. Raw output: {pylint_output[:200]}...",
                    'line': None
                })
        
    except FileNotFoundError:
        hints.append({
            'type': 'error',
            'message': "Pylint not found. Make sure Pylint is installed in your virtual environment.",
            'line': None
        })
    except Exception as e:
        hints.append({
            'type': 'error',
            'message': f"An error occurred during Pylint analysis: {str(e)}",
            'line': None
        })
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
    return hints

@app.route('/run_code', methods=['POST'])
def run_code():
    data = request.get_json()
    code = data.get('code', '')

    output = ""
    error = ""
    
    with tempfile.NamedTemporaryFile(mode='w+', suffix='.py', delete=False, encoding='utf-8') as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name

    try:
        result = subprocess.run(
            ['python', temp_file_path],
            capture_output=True,
            text=True,
            timeout=5
        )
        output = result.stdout
        error = result.stderr
        
        if "ZeroDivisionError" in error:
            error_line = None
            import re
            match = re.search(r'File ".*", line (\d+)', error)
            if match:
                error_line = int(match.group(1))

            if not any(h['type'] == 'error' and h.get('line') == error_line for h in run_pylint_analysis(code)):
                error_hints = [{
                    'type': 'error',
                    'message': "You have a ZeroDivisionError! This usually means you're trying to divide by zero. Check your divisors.",
                    'line': error_line
                }]
            else:
                error_hints = []

    except subprocess.TimeoutExpired:
        error = "Error: Code execution timed out (5 seconds). This might indicate an infinite loop or a very long-running process."
        error_hints = [{
            'type': 'error',
            'message': "Code execution timed out. This often happens with infinite loops. Review your loop conditions.",
            'line': None
        }]
    except Exception as e:
        error = f"An unexpected error occurred during execution: {e}"
        error_hints = []
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    pylint_hints = run_pylint_analysis(code)
    all_hints = pylint_hints

    return jsonify({"output": output, "error": error, "hints": all_hints})

@app.route('/get_ai_hint', methods=['POST'])
def get_ai_hint():
    data = request.get_json()
    code = data.get('code', '')
    error_message = data.get('error', '')

    prompt_parts = [
        "You are an intelligent Python programming tutor. "
        "Your goal is to help students understand their code, find issues, and suggest improvements. "
        "When providing code, use markdown code blocks (```python) and be concise.\n\n"
        "Here is the student's Python code:\n```python\n",
        code,
        "\n```\n"
    ]

    if error_message:
        prompt_parts.append(
            f"\nThey encountered this runtime error:\n```\n{error_message}\n```\n"
            "**Task:** Explain the runtime error in simple terms. Suggest how to debug or fix it. "
            "If possible, show the **'Original Code'** snippet (only the relevant part if large), "
            "followed by a **'Suggested Change'** snippet. "
            "Explain *why* the change is better. Use markdown code blocks (```python) for both snippets. "
            "If it's a simple fix, you can directly provide the corrected code.\n"
        )
    else:
        prompt_parts.append(
            "\n**Task:** Analyze this code. Focus on readability, efficiency, or Pythonic style. "
            "Identify one specific code snippet from the user's code that can be improved. "
            "Then, show the **'Original Code'** snippet, followed by a **'Suggested Change'** snippet. "
            "Explain *why* the suggested change is better. Use markdown code blocks (```python) for both snippets. "
            "If no obvious improvement, explain a core concept or a common best practice related to the code. "
            "Keep the explanation concise, guiding the student without just giving the solution directly if possible."
        )

    try:
        response = model.generate_content(
            prompt_parts,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=500
            )
        )
        ai_hint = response.text
    except Exception as e:
        ai_hint = f"Failed to get AI hint: {str(e)}. Please check your API key and internet connection."
        print(f"Gemini API Error: {e}")

    return jsonify({"ai_hint": ai_hint})


@app.route('/get_ai_explanation', methods=['POST'])
def get_ai_explanation():
    data = request.get_json()
    code = data.get('code', '')

    prompt_parts = [
        "You are an expert Python programmer and educator. "
        "Your task is to provide a clear, comprehensive, and concise explanation of the given Python code. "
        "Break down the code's purpose, main components, how they interact, and any key concepts or algorithms used. "
        "Do NOT provide alternative code or refactoring suggestions unless it's critical for understanding a concept. "
        "Focus purely on explaining the provided code.\n\n"
        "**VERY IMPORTANT MARKDOWN GUIDELINES:**\n"
        "- For multi-line code examples or significant code blocks (like a full function or class), use **fenced code blocks** (e.g., ```python\\nprint('hi')\\n```).\n"
        "- For single variable names (e.g., `variable_name`), function names (e.g., `function_call()`), or short code snippets (e.g., `if True:`), *which are part of a sentence*, use **inline code** (single backticks).\n"
        "- **DO NOT** use fenced code blocks for single words or very short inline code snippets. For example, do not format ````python x ````; instead, use `x`.\n\n"
        "Here is the Python code to explain:\n```python\n",
        code,
        "\n```\n"
        "**Explanation:**\n"
    ]

    try:
        response = model.generate_content(
            prompt_parts,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=700
            )
        )
        ai_explanation = response.text
    except Exception as e:
        ai_explanation = f"Failed to get AI explanation: {str(e)}. Please check your API key and internet connection."
        print(f"Gemini API Error for explanation: {e}")

    return jsonify({"ai_explanation": ai_explanation})

# NEW ROUTE: To get AI fixed code
@app.route('/get_ai_fixed_code', methods=['POST'])
def get_ai_fixed_code():
    data = request.get_json()
    code = data.get('code', '')
    error_message = data.get('error', '') # Get any existing runtime error

    prompt_parts = [
        "You are an expert Python programming assistant. "
        "Your task is to fix the provided Python code. "
        "If there's an error message, prioritize fixing that. "
        "If the code is mostly correct, suggest a more Pythonic, efficient, or readable version. "
        "Provide **ONLY** the corrected Python code within a fenced code block (```python) and then, in a new paragraph, a **brief (1-2 sentences) explanation** of what was fixed or improved.\n\n"
        "Here is the original Python code:\n```python\n",
        code,
        "\n```\n"
    ]

    if error_message:
        prompt_parts.append(
            f"\nThere was a runtime error: {error_message}\n"
        )
    
    prompt_parts.append("\n**Fixed Code and Explanation:**\n")

    try:
        response = model.generate_content(
            prompt_parts,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4, # Slightly higher temperature for fixing, but not too creative
                max_output_tokens=700 # Enough tokens for code and explanation
            )
        )
        ai_fixed_code = response.text
    except Exception as e:
        ai_fixed_code = f"Failed to get AI fixed code: {str(e)}. Please check your API key and internet connection."
        print(f"Gemini API Error for fix code: {e}")

    return jsonify({"ai_fixed_code": ai_fixed_code})


if __name__ == '__main__':
    app.run(debug=True)