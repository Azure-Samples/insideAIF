# Freeform Tool Calling - Python Implementation

![Freeform Tool Calling](../../../Images/thumbnail-freeform-tool-calling.png)

Freeform tool calling in GPT-5 enables the model to send raw text payloads like Python scripts, SQL queries, or configuration files directly to external tools without needing to wrap them in structured JSON—eliminating rigid JSON schemas and reducing integration overhead. This Python implementation shows you how the model executes model-generated SQL to compute results, routes the output to Python for formatting and visualization, and returns reproducible artifacts (CSVs, charts) all using natural language input.

Try it yourself in Azure AI Foundry and start parsing documents and images: [ai.azure.com](https://ai.azure.com)

Learn more about Freeform Tool Calling with GPT-5: [aka.ms/insideAIF/freeform-tool-calling](https://aka.ms/insideAIF/freeform-tool-calling)

## Prerequisites

- Python 3.8 or higher
- An [Azure AI Foundry](https://ai.azure.com) project with GPT-5 model deployment

## Run the Sample

1. Navigate to this folder: `cd Samples/Freeform-Tool-Calling/Python`
1. Install dependencies: `pip install -r requirements.txt`
1. Set up environment variables: `copy .env.example .env` (edit the `.env` file with your Azure credentials)
1. Run the script: `python freeform-tool-calling.py`

## What this sample demonstrates

- **Freeform tool calling**: Model generates raw SQL and Python code without JSON schemas
- **SQL execution**: Dynamic SQL queries executed against an in-memory Iris dataset
- **Data visualization**: Matplotlib charts generated from SQL results
- **Multi-step workflows**: SQL → Python → Visualization pipeline
