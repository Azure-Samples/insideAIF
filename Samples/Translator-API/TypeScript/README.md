# Azure AI Translator API (Public Preview)

![Azure AI Translator API](/Images/thumbnail-translator-API.png)

The Microsoft Foundry Translator API (Public Preview) enables you to translate text leveraging neural machine translation (NMT) or large language model translation (LLM). In this episode, April shows you how to translate a conversation between an English speaking customer support agent and a French speaking customer, accommodating for both tone and gender.

Try it yourself in Microsoft Foundry and start translating with LLMs: [ai.azure.com](https://ai.azure.com)

Learn more about the Azure AI Translator API: [aka.ms/insideAIF/translator-API](https://aka.ms/insideAIF/translator-API)
Configure your Microsoft Foundry resource: [aka.ms/insideAIF/configure-Azure-resources](https://aka.ms/insideAIF/configure-Azure-resources)

## Prerequisites

- A Microsoft Foundry resource created in the [Azure portal](https://portal.azure.com). Review the [Configure your Microsoft Foundry resource](https://aka.ms/insideAIF/configure-Azure-resources) document for guidance.
- A `GPT-4o` or `GPT-4o-mini` deployment

## Run the Samples

### Setup

1. Navigate to the folder: `cd Samples/Translator-API/TypeScript`
1. Install dependencies: `pnpm install`
1. Set up environment variables: `cp .env.example .env`

### Basic Neural Machine Translation

1. Run the script: `pnpm start:translation-nmt.`

### Basic Large Language Model Translation

1. In the main function, replace `your-gpt-model-deployment` with your model deployment name.
1. Run the script: `pnpm start:translation-llm`

### LLM Translation with Tone

1. In the main function, replace `your-gpt-model-deployment` with your model deployment name.
1. Run the script: `pnpm start:translation-tone.`

### LLM Translation with Gender

1. In the main function, replace `your-gpt-model-deployment` with your model deployment name.
1. Run the script: `pnpm start:translation-gender`

### NMT and LLM Translation with Multiple Languages

1. In the main function, replace `your-gpt-model-deployment` with your model deployment name.
1. Run the script: `pnpm start:translation-multiple`