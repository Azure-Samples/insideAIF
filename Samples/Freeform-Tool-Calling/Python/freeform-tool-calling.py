"""
GPT-5 Freeform Tool Calling Demo with Iris Dataset

This script demonstrates GPT-5's new freeform tool calling capabilities using the classic Iris dataset.
Unlike traditional structured tool calling, GPT-5 can now understand natural language instructions
about tools and format its responses accordingly.

Key Features:
- Automatic Iris dataset setup from scikit-learn
- In-memory SQLite database for data analysis
- Python code execution with matplotlib plotting
- Iterative conversation flow with tool results

Requirements:
- Azure OpenAI GPT-5 deployment
- Environment variables: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT
- Python packages: openai, pandas, scikit-learn, matplotlib, python-dotenv
"""

import os, csv, io, sqlite3, textwrap, json
from dataclasses import dataclass
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Azure OpenAI client (GPT-5) ---
# You can use API key or Entra ID
# Env vars expected: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT
from openai import AzureOpenAI

# Initialize Azure OpenAI client with GPT-5
# Requires specific API version for freeform tool calling support
client = AzureOpenAI(
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version="2024-10-01-preview",  # Required API version for GPT-5 freeform tool calling
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
)

MODEL = os.environ["AZURE_OPENAI_DEPLOYMENT"]  # your GPT-5 deployment name

# --- Demo data: iris.csv (create if missing) ---
# Auto-generate the Iris dataset if it doesn't exist locally
# This creates a clean CSV with SQL-friendly column names
IRIS_CSV = "iris.csv"
if not os.path.exists(IRIS_CSV):
    # Write a tiny Iris CSV using sklearn if available; else fail gracefully.
    try:
        import pandas as pd
        from sklearn.datasets import load_iris
        
        # Load the classic Iris dataset from scikit-learn
        iris = load_iris(as_frame=True)
        
        # Rename columns to be SQL-friendly (remove spaces and special characters)
        df = iris.frame.rename(columns={
            "sepal length (cm)": "sepal_length",
            "sepal width (cm)": "sepal_width",
            "petal length (cm)": "petal_length",
            "petal width (cm)": "petal_width",
            "target": "species_id",
        })
        
        # Map numeric species IDs to human-readable names for clarity
        df["species"] = df["species_id"].map({0: "setosa", 1: "versicolor", 2: "virginica"})
        df.drop(columns=["species_id"], inplace=True)
        df.to_csv(IRIS_CSV, index=False)
        print(f"Created {IRIS_CSV} with {len(df)} rows")
    except Exception as e:
        raise SystemExit(
            "Could not auto-create iris.csv. Install scikit-learn & pandas or provide iris.csv.\n"
            f"Error: {e}"
        )

# --- Tool 1: sql_exec_sqlite (raw SQL in, CSV out) ---
# This tool creates an in-memory SQLite database from the CSV file
# and allows GPT-5 to execute SQL queries against it
class SQLiteCSVTool:
    """
    A tool that loads CSV data into an in-memory SQLite database
    and executes SQL queries, returning results as CSV format.
    """
    def __init__(self, csv_path: str):
        # Create in-memory SQLite database for fast querying
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row  # Enable column access by name
        self._load_csv(csv_path)

    def _load_csv(self, path: str):
        """Load CSV file into SQLite table named 'iris'"""
        with open(path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            cols = [c.strip() for c in reader.fieldnames]
            
            # Create table with all TEXT columns (SQLite will handle type conversion)
            colspec = ", ".join([f'"{c}" TEXT' for c in cols])  # store as TEXT, cast in SQL
            self.conn.execute(f'CREATE TABLE iris ({colspec});')
            
            # Insert all rows into the table
            rows = [tuple(r[c] for c in cols) for r in reader]
            placeholders = ", ".join(["?"] * len(cols))
            self.conn.executemany(f'INSERT INTO iris VALUES ({placeholders});', rows)
            self.conn.commit()

    def exec_sql(self, sql: str) -> str:
        """Execute SQL query and return results as CSV string"""
        cur = self.conn.cursor()
        cur.execute(sql)
        
        # If no rows (e.g., DDL), return empty CSV with a message
        if cur.description is None:
            return "column\n(no result)"
        
        # Convert results to CSV format
        out = io.StringIO()
        writer = csv.writer(out)
        # Write header row with column names
        writer.writerow([d[0] for d in cur.description])
        # Write data rows
        for row in cur.fetchall():
            writer.writerow([row[c[0]] for c in cur.description])
        return out.getvalue()

# Initialize the SQL tool with our Iris dataset
sql_tool = SQLiteCSVTool(IRIS_CSV)

# --- Tool 2: code_exec_python (raw Python in, stdout/PNG note out) ---
# This tool executes Python code and captures output, with matplotlib support
def code_exec_python(code: str, inputs: Optional[Dict[str, Any]] = None) -> str:
    """
    Execute Python code in a sandboxed environment and return stdout.
    Automatically saves matplotlib plots as iris_plot.png.
    
    Args:
        code: Python code string to execute
        inputs: Optional dictionary of inputs available as 'inputs' variable
    
    Returns:
        String containing stdout from code execution
    """
    import contextlib, sys
    import matplotlib
    matplotlib.use("Agg")  # Use non-interactive backend for headless plotting
    import matplotlib.pyplot as plt

    # Capture stdout from code execution
    buf = io.StringIO()
    globs = {"inputs": inputs or {}}  # Make inputs available to executed code
    
    with contextlib.redirect_stdout(buf):
        exec(code, globs, globs)  # Execute user code (demo only - be careful in production!)
        
        # If matplotlib created any figures, save them automatically
        if plt.get_fignums():
            plt.savefig("iris_plot.png", bbox_inches="tight", dpi=150)
            print("\n[Saved figure to iris_plot.png]")
            plt.close("all")
    return buf.getvalue().strip()

# --- GPT-5 Freeform Tool Calling Functions ---
# These functions implement the new freeform tool calling approach
# where GPT-5 uses natural language formatting instead of structured tool schemas

def call_model_with_tools(messages: List[Dict[str, str]]) -> str:
    """
    Call GPT-5 with freeform tool calling enabled.
    
    Unlike traditional tool calling, we don't define structured tool schemas.
    Instead, we rely on GPT-5's ability to understand natural language
    instructions about how to format tool calls using code blocks.
    """
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        # No 'tools' parameter needed - GPT-5 understands tool usage from context
    )
    return response.choices[0].message.content

def parse_and_execute_tools(content: str) -> List[tuple]:
    """
    Parse freeform tool calls from GPT-5 response and execute them.
    
    This function looks for code blocks in GPT-5's response:
    - ```sql blocks for SQL queries
    - ```python blocks for Python code execution
    
    Returns a list of (tool_name, result) tuples.
    """
    results = []
    
    # Look for SQL tool calls in code blocks
    if "```sql" in content:
        # Extract SQL between ```sql and ``` using regex
        import re
        sql_matches = re.findall(r'```sql\n(.*?)\n```', content, re.DOTALL)
        for sql in sql_matches:
            try:
                result = sql_tool.exec_sql(sql.strip())
                results.append(("sql_exec_sqlite", result))
            except Exception as e:
                results.append(("sql_exec_sqlite", f"Error: {e}"))
    
    # Look for Python tool calls in code blocks
    if "```python" in content:
        # Extract Python between ```python and ``` using regex
        import re
        python_matches = re.findall(r'```python\n(.*?)\n```', content, re.DOTALL)
        for code in python_matches:
            try:
                result = code_exec_python(code.strip())
                results.append(("code_exec_python", result))
            except Exception as e:
                results.append(("code_exec_python", f"Error: {e}"))
    
    return results

def run_conversation():
    """
    Main conversation loop demonstrating GPT-5's freeform tool calling.
    
    This function:
    1. Sets up the conversation with system and user prompts
    2. Iteratively calls GPT-5 and executes any tools it requests
    3. Feeds tool results back to continue the conversation
    4. Stops when no more tools are called or max iterations reached
    """
    # System prompt: Explains the freeform tool calling approach to GPT-5
    # Notice how we use natural language to describe tool usage patterns
    system_prompt = """You are a data analyst with access to tools. When you need to execute SQL queries or Python code, format them as code blocks:

For SQL queries, use:
```sql
YOUR_SQL_QUERY_HERE
```

For Python code, use:
```python
YOUR_PYTHON_CODE_HERE
```

You have access to an iris table with columns: sepal_length, sepal_width, petal_length, petal_width, species (all stored as text, cast as needed).
"""

    # User prompt: The specific analysis task we want GPT-5 to complete
    user_prompt = """
1) Write SQL to compute mean of sepal_length, sepal_width, petal_length, petal_width grouped by species.
   Return a tidy CSV with species and the four means (rounded to 2 decimals).
2) Then write Python to read that CSV string (provided as tool output), pretty-print a table,
   and produce a bar chart of mean petal_length by species using Matplotlib.
"""

    # Initialize conversation with system and user messages
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    max_iterations = 5  # Prevent infinite loops
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        print(f"\n--- Iteration {iteration} ---")
        
        # Get response from GPT-5
        response_content = call_model_with_tools(messages)
        print(f"GPT-5 Response:\n{response_content}")
        
        # Parse and execute any tool calls found in the response
        tool_results = parse_and_execute_tools(response_content)
        
        if not tool_results:
            # No tools were called, we're done with the analysis
            print("\n--- Final Response ---")
            print(response_content)
            break
        
        # Add the assistant's response to the conversation history
        messages.append({"role": "assistant", "content": response_content})
        
        # Add tool results back to the conversation so GPT-5 can continue
        tool_results_text = ""
        for tool_name, output in tool_results:
            tool_results_text += f"\n--- {tool_name} output ---\n{output}\n"
            print(f"\n{tool_name} output:\n{output}")
        
        # Feed tool results back to GPT-5 for continued analysis
        messages.append({"role": "user", "content": f"Tool results:{tool_results_text}\nPlease continue with the analysis."})

if __name__ == "__main__":
    """
    Entry point for the demo.
    
    This script demonstrates:
    - Automatic Iris dataset creation
    - Freeform tool calling with GPT-5
    - SQL analysis of the data
    - Python visualization of results
    
    Make sure you have the required environment variables set:
    - AZURE_OPENAI_ENDPOINT
    - AZURE_OPENAI_API_KEY  
    - AZURE_OPENAI_DEPLOYMENT
    """
    run_conversation()
