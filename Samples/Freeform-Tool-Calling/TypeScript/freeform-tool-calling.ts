import "dotenv/config";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { Console } from "console";
import { Writable } from "stream";
import { createContext, runInContext } from "vm";

// Types -----------------------------------------------------------------------

type MessageItem = { role: "system" | "user" | "assistant"; content: string };
type ToolOutputItem = { type: "function_call_output"; call_id: string; output: string };
type ConversationItem = MessageItem | ToolOutputItem;

type IrisRecord = {
  sepal_length: number;
  sepal_width: number;
  petal_length: number;
  petal_width: number;
  species: string;
};

type JavaScriptInputs = {
  csvString?: string;
};

// Environment -----------------------------------------------------------------

const {
  AZURE_OPENAI_ENDPOINT: endpoint,
  AZURE_OPENAI_API_KEY: apiKey,
  AZURE_OPENAI_DEPLOYMENT: model,
} = process.env;

if (!endpoint || !apiKey || !model) {
  throw new Error(
    "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT environment variables must be set",
  );
}

const deploymentName = model.trim();

const client = new OpenAI({
  apiKey,
  baseURL: `${endpoint}/openai/v1/` // Azure OpenAI v1 is required for latest features
});

// Logging helpers ------------------------------------------------------------

function preview(text: string, max = 200): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

// Data helpers ----------------------------------------------------------------

class InMemoryCSVTool {
  private readonly data: IrisRecord[];

  constructor(csvPath: string) {
    this.data = this.loadCSV(csvPath);
  }

  private loadCSV(csvPath: string): IrisRecord[] {
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.trim().split("\n");
    const headers = lines[0].split(",").map((header) => header.trim());

    const records: IrisRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((value) => value.trim());
      const row: Record<string, string | number> = {};

      headers.forEach((header, index) => {
        const rawValue = values[index];
        const numericValue = Number(rawValue);
        row[header] = Number.isNaN(numericValue) ? rawValue : numericValue;
      });

      records.push(row as IrisRecord);
    }

    return records;
  }

  execSQL(sql: string): string {
    const cleanedQuery = sql.trim();
    const lowerQuery = cleanedQuery.toLowerCase();

    if (!lowerQuery.startsWith("select")) {
      return "Error: Only SELECT statements are supported.";
    }

    if (lowerQuery.includes("avg") && lowerQuery.includes("group by") && lowerQuery.includes("species")) {
      return this.computeMeansCSV();
    }

    // Simple fallback to return full dataset as CSV if another SELECT query is executed.
    const headers = Object.keys(this.data[0]);
    const rows = this.data
      .map((row) => headers.map((header) => row[header as keyof IrisRecord]).join(","))
      .join("\n");

    return `${headers.join(",")}\n${rows}`;
  }

  private computeMeansCSV(): string {
    const numericColumns: Array<keyof Omit<IrisRecord, "species">> = [
      "sepal_length",
      "sepal_width",
      "petal_length",
      "petal_width",
    ];

    const aggregates = new Map<string, { count: number; sums: Record<string, number> }>();

    for (const record of this.data) {
      const key = record.species;

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          count: 0,
          sums: Object.fromEntries(numericColumns.map((column) => [column, 0])) as Record<string, number>,
        });
      }

      const entry = aggregates.get(key)!;
      entry.count += 1;

      for (const column of numericColumns) {
        entry.sums[column] += record[column];
      }
    }

    const lines: string[] = [
      [
        "species",
        "sepal_length_mean",
        "sepal_width_mean",
        "petal_length_mean",
        "petal_width_mean",
      ].join(","),
    ];

    for (const [species, { count, sums }] of aggregates.entries()) {
      const formattedMeans = numericColumns.map((column) => (sums[column] / count).toFixed(2));
      lines.push([species, ...formattedMeans].join(","));
    }

    return lines.join("\n");
  }
}

function executeJavaScript(code: string, inputs: JavaScriptInputs): string {
  try {
    let output = "";
    const captureTable = (rows: unknown): void => {
      const buffers: string[] = [];
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          buffers.push(chunk.toString());
          callback();
        },
      });
      const captureConsole = new Console({ stdout: writable, stderr: writable });
      captureConsole.table(rows as any);
      output += buffers.join("");
    };

    const toChartRows = (data: Array<Record<string, unknown>>) =>
      data.map((item, index) => {
        const label = String(item.label ?? item.species ?? `Row ${index + 1}`);
        const rawValue = item.value ?? item.petal_length ?? item.y ?? 0;
        const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
        return { label, value: Number.isFinite(numericValue) ? numericValue : 0 };
      });

    const writeSimpleBarChart = (rows: Array<{ label: string; value: number }>, title: string, filename = "iris_plot.svg") => {
      if (rows.length === 0) {
        throw new Error("Chart data is empty.");
      }

      const width = 480;
      const height = 320;
      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;
      const maxValue = Math.max(...rows.map((row) => row.value), 1);
      const barWidth = chartWidth / rows.length;

      const svgParts = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
        `<rect width="${width}" height="${height}" fill="white" stroke="#ddd"/>`,
        `<text x="${width / 2}" y="24" text-anchor="middle" font-family="Arial" font-size="16">${title}</text>`,
        `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#333"/>`,
        `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#333"/>`,
      ];

      rows.forEach((row, index) => {
        const x = padding + index * barWidth + barWidth * 0.1;
        const usableWidth = barWidth * 0.8;
        const scaledHeight = (row.value / maxValue) * chartHeight;
        const y = height - padding - scaledHeight;
        svgParts.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${usableWidth.toFixed(2)}" height="${scaledHeight.toFixed(2)}" fill="#4E79A7"/>`,
        );
        svgParts.push(
          `<text x="${(x + usableWidth / 2).toFixed(2)}" y="${(y - 5).toFixed(2)}" text-anchor="middle" font-family="Arial" font-size="10">${row.value.toFixed(
            2,
          )}</text>`,
        );
        svgParts.push(
          `<text x="${(x + usableWidth / 2).toFixed(2)}" y="${height - padding / 2}" text-anchor="middle" font-family="Arial" font-size="12">${row.label}</text>`,
        );
      });

      svgParts.push(`</svg>`);

      const chartPath = path.resolve(process.cwd(), filename);
      fs.writeFileSync(chartPath, svgParts.join("\n"), "utf-8");
      output += `[Saved figure to ${chartPath}]\n`;
    };

    const sandbox = createContext({
      inputs,
      csvString: inputs.csvString ?? "",
      console: {
        log: (...args: unknown[]) => {
          output += `${args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg, null, 2))).join(" ")}\n`;
        },
        table: (data: unknown) => {
          captureTable(data);
        },
      },
      JSON,
      Math,
      fs,
      parseCSV: (csv: string) => {
        const trimmed = csv.trim();
        if (!trimmed) return [];

        const [headerLine, ...rowLines] = trimmed.split("\n");
        const headers = headerLine.split(",");
        return rowLines.map((rowLine) => {
          const values = rowLine.split(",");
          return headers.reduce<Record<string, string | number>>((acc, header, index) => {
            const value = values[index];
            const numeric = Number(value);
            acc[header] = Number.isNaN(numeric) ? value : numeric;
            return acc;
          }, {});
        });
      },
      createChart: (data: Array<Record<string, unknown>>, title = "Chart", filename = "iris_plot.svg") => {
        const rows = Array.isArray(data) ? toChartRows(data) : [];
        writeSimpleBarChart(rows, title, filename);
        return rows;
      },
      saveChart: (data: Array<Record<string, unknown>>, title = "Chart", filename = "iris_plot.svg") => {
        const rows = Array.isArray(data) ? toChartRows(data) : [];
        writeSimpleBarChart(rows, title, filename);
        return rows;
      },
    });

    runInContext(code, sandbox);

    return output.trim();
  } catch (error) {
    return `Error: ${error}`;
  }
}

// Tool configuration ----------------------------------------------------------

const TOOLS: Array<Record<string, unknown>> = [
  {
    type: "custom",
    name: "sql_exec_csv",
    description:
      "Executes read-only SQL SELECT queries against the iris dataset and returns tidy CSV results. Use to aggregate data before visualization.",
  },
  {
    type: "custom",
    name: "code_exec_javascript",
    description:
      "Executes Node.js-compatible JavaScript. Use parseCSV(csvString) to read previous SQL output, console.table for inspection, and createChart(data, title) to save an SVG bar chart.",
  },
];

// Conversation setup ---------------------------------------------------------

const IRIS_CSV_PATH = path.resolve(process.cwd(), "iris.csv");

if (!fs.existsSync(IRIS_CSV_PATH)) {
  throw new Error(`${IRIS_CSV_PATH} file not found. Please ensure the iris.csv file exists in the current directory.`);
}

const csvTool = new InMemoryCSVTool(IRIS_CSV_PATH);

const initialMessages: MessageItem[] = [
  {
    role: "system",
    content: `You are a data analyst with access to tools. When you need to execute SQL queries or JavaScript code, format them as code blocks:

For SQL queries, use:
\`\`\`sql
YOUR_SQL_QUERY_HERE
\`\`\`

For JavaScript code, use:
\`\`\`javascript
YOUR_JAVASCRIPT_CODE_HERE
\`\`\`

Important: When writing JavaScript code:
- Write Node.js compatible code (no DOM, no browser APIs like document, canvas, etc.)
- To create charts, use the createChart(data, title) function
- Data should be an array of objects with 'label' and 'value' properties
- Example: createChart([{label: 'setosa', value: 1.46}, {label: 'versicolor', value: 4.26}], 'Petal Length by Species')
- This will automatically save the chart as iris_plot.svg
- The latest SQL tool result is provided as the csvString variable. Always read and parse that (e.g., parseCSV(csvString)) instead of hard-coding data values.


You have access to an iris table with columns: sepal_length, sepal_width, petal_length, petal_width, species (all stored as text, cast as needed).`,
  },
  {
    role: "user",
    content: `1) Write SQL to compute mean of sepal_length, sepal_width, petal_length, petal_width grouped by species.
   Return a tidy CSV with species and the four means (rounded to 2 decimals).
2) Then write JavaScript to read that CSV string (provided as tool output), pretty-print a table,
   and produce a bar chart of mean petal_length by species.`,
  },
];

let lastCSVOutput = "";

async function main(): Promise<void> {
  console.log("🚀 Starting GPT-5 freeform tool calling demo\n");
  console.log(`Using deployment '${deploymentName}' at ${endpoint}`);
  console.log(`Loaded iris dataset from ${IRIS_CSV_PATH}\n`);

  let pending: ConversationItem[] = [...initialMessages];
  let previousResponseId: string | undefined;
  const maxIterations = 5;

  for (let iteration = 1; iteration <= maxIterations && pending.length > 0; iteration += 1) {
    console.log("----------------------------------------");
    console.log(`Iteration ${iteration}: sending ${pending.length} message(s) to GPT-5.`);

    const requestPayload: Parameters<typeof client.responses.create>[0] = {
      model: deploymentName,
      input: pending,
      tools: TOOLS as any,
      text: { format: { type: "text" } },
    };

    if (previousResponseId) {
      requestPayload.previous_response_id = previousResponseId;
    }

    const response = (await client.responses.create(requestPayload)) as any;
    previousResponseId = response?.id ?? previousResponseId;

    pending = [];

    let assistantMessage = "";
    const toolCalls: Array<{ call_id: string; input: string; name: string }> = [];

    for (const item of (response?.output ?? []) as Array<any>) {
      if (item.type === "message") {
        const textFragment = item.content
          ?.map((contentItem: any) => (contentItem.type === "output_text" ? contentItem.text : ""))
          .join("")
          .trim();

        if (textFragment) {
          assistantMessage += `${textFragment}\n`;
        }
      }

      if (item.type === "custom_tool_call") {
        toolCalls.push({ call_id: item.call_id, input: item.input ?? "", name: item.name });
      }
    }

    if (assistantMessage.trim()) {
      const message = assistantMessage.trim();
      console.log(`\nAssistant:\n${message}\n`);
    } else {
      console.log("\nAssistant did not return a direct message this round.\n");
    }

    if (toolCalls.length === 0) {
      console.log("No tool calls requested. Conversation complete.\n");
      break;
    }

    console.log(`Model requested ${toolCalls.length} tool call(s).`);

    for (const toolCall of toolCalls) {
      console.log(`\n[Tool call] ${toolCall.name} (call_id=${toolCall.call_id})`);
      console.log(`Input preview:\n${preview(toolCall.input)}`);

      const result = executeTool(toolCall.name, toolCall.input);
      console.log(`Output:\n${result.trim()}`);

      if (toolCall.call_id.startsWith("auto-")) {
        const userMessage: MessageItem = {
          role: "user",
          content: `[System] Executed code block:\n${result}`,
        };
        pending.push(userMessage);
      } else {
        const toolOutput: ToolOutputItem = {
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: result,
        };
        pending.push(toolOutput);
      }
    }
  }

  if (pending.length > 0) {
    console.log("Reached iteration limit before conversation completed.\n");
  }

  console.log("Demo complete.");
}

function executeTool(name: string, input: string): string {
  switch (name) {
    case "sql_exec_csv": {
      const sql = input.trim();
      const output = csvTool.execSQL(sql);
      if (!output.startsWith("Error")) {
        lastCSVOutput = output;
      }
      return output;
    }
    case "code_exec_javascript": {
      if (!lastCSVOutput) {
        return "Error: No CSV data available. Call sql_exec_csv first.";
      }
      const code = input.trim();
      return executeJavaScript(code, { csvString: lastCSVOutput });
    }
    default:
      return `Error: Unknown tool '${name}'.`;
  }
}

main().catch((error) => {
  console.error("The sample encountered an error:", error);
  process.exit(1);
});
