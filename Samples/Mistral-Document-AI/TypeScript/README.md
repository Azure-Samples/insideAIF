# Mistral Document AI

![Mistral Document AI](/Images/thumbnail-mistral-document-AI.png)

The future of document intelligence is here with Mistral Document AI in Microsoft Foundry. In this episode, April shows you how the model parses complex layouts from PDFs and handwritten notes. You’ll also see how the model’s structured JSON output makes it possible to integrate with databases, AI agents, and RAG workflows—turning unstructured documents into actionable data.

Try it yourself in Microsoft Foundry and start parsing documents and images: [ai.azure.com](https://ai.azure.com)

Learn more about Mistral Document AI: [aka.ms/insideAIF/mistral-document-AI](https://aka.ms/insideAIF/mistral-document-AI)

## Prerequisites

- An [Microsoft Foundry](https://ai.azure.com) project

## Run the Sample

### Document AI with base64 PDF

1. Navigate to the folder: `cd Samples/Mistral-Document-AI/TypeScript`
1. Install dependencies: `pnpm install`
1. Set up environment variables: `cp .env.example .env`
1. Put your PDF file in the same directory and replace `"your_document.pdf"` with the file name.
1. Run the script: `pnpm start`
1. Confirm that the `docAI-pdf.ts` run is successful and that a new `document_ai_result.json` file is created.
1. To parse the recipe content and extract structured components, run the script: `pnpm run start:shopping-list-pdf`.

### Document AI with base64 image

1. Navigate to the folder: `cd Samples/Mistral-Document-AI/TypeScript`
1. Install dependencies: `pnpm install`
1. Set up environment variables: `cp .env.example .env`
1. Put your image file in the same directory and replace `"your_image.jpg"` with the file name.
1. Run the script: `pnpm run start:from-image`
1. Confirm that the `docAI-image.ts` run is successful and that a new `document_ai_result.json` file is created.
1. To parse the recipe content and extract structured components, run the script: `pnpm run start:shopping-list-image`.
