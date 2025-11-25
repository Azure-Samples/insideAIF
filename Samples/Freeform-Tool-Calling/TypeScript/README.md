# Freeform Tool Calling - TypeScript Implementation

![Freeform Tool Calling](../../../Images/thumbnail-freeform-tool-calling.png)

Freeform tool calling in GPT-5 enables the model to send raw text payloads like SQL queries, JavaScript code, or configuration files directly to external tools without needing to wrap them in structured JSON—eliminating rigid JSON schemas and reducing integration overhead. This TypeScript implementation shows you how the model executes model-generated SQL to compute results, routes the output to JavaScript for formatting and visualization, and returns reproducible artifacts (CSVs, charts) all using natural language input.

Try it yourself in Microsoft Foundry: [ai.azure.com](https://ai.azure.com)

Learn more about Freeform Tool Calling with GPT-5: [aka.ms/insideAIF/freeform-tool-calling](https://aka.ms/insideAIF/freeform-tool-calling)

## Prerequisites

- Node.js 18 or higher
- pnpm package manager
- A [Microsoft Foundry](https://ai.azure.com) project with GPT-5 model deployment

## Run the Sample

1. Navigate to this folder: `cd Samples/Freeform-Tool-Calling/TypeScript`
1. Install dependencies: `pnpm install`
1. Set up environment variables: `copy .env.example .env` (edit the `.env` file with your Azure credentials)
1. Run the script: `pnpm start`

## What this sample demonstrates

- **Freeform tool calling**: Model generates raw SQL and JavaScript code without JSON schemas
- **SQL execution**: Dynamic SQL queries executed against an Iris dataset
- **Multi-step workflows**: SQL → JavaScript → Visualization pipeline