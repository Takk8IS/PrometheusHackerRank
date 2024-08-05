import express from "express";
import bodyParser from "body-parser";
import { Groq } from "groq-sdk";
import cors from "cors";
import NodeCache from "node-cache";
import prettier from "prettier";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Create an Express application
const app = express();
const port = process.env.PORT || 8005;
const groqApiKey = "YOUR_GROQ_API_KEY" || process.env.GROQ_API_KEY;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Initialise GROQ with API key, fallback to default key if not set in environment
const groq = new Groq({
  apiKey: groqApiKey,
});

// Cache setup (1 hour TTL)
const cache = new NodeCache({ stdTTL: 3600 });

// Utility function for sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility function for retry with exponential backoff
async function retryWithExponentialBackoff(func, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await func();
    } catch (error) {
      if (error.status !== 429 || i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      console.log(
        `\nThe flames of wisdom are throttled. Rekindling in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }
}

// Function to format content
async function formatContent(content) {
  let formattedContent = content;

  // Improve formatting of titles
  formattedContent = formattedContent.replace(
    /^(#+)\s*(.+)$/gm,
    (match, hashes, title) => {
      return `${hashes} **${title.trim()}**`;
    },
  );

  // Ensure bold numbers remain bold
  formattedContent = formattedContent.replace(/\*\*(\d+)\*\*/g, "**$1**");

  // Convert fractions and equalities to the desired LaTeX format
  formattedContent = formattedContent.replace(
    /(\d+)\/(\d+)\s*=\s*(0\.\d+)/g,
    "$\\frac{$1}{$2} = $3$",
  );

  // Format code blocks while preserving their content
  formattedContent = formattedContent.replace(
    /```([\s\S]*?)```/g,
    (match, codeContent) => {
      // Trim whitespace from the start and end of the code block
      return `\`\`\`\n${codeContent.trim()}\n\`\`\``;
    },
  );

  // Ensure LaTeX formulas are properly formatted while preserving content
  formattedContent = formattedContent.replace(
    /\$(.*?)\$/g,
    (match, formula) => {
      // Trim whitespace but keep the original content
      return `$${formula.trim()}$`;
    },
  );

  // Preserve "n = 5" format in LaTeX
  formattedContent = formattedContent.replace(/\$(\d+)\$/g, (match, number) => {
    return `$n = ${number}$`;
  });

  // Format using prettier
  try {
    formattedContent = await prettier.format(formattedContent, {
      parser: "markdown",
    });
  } catch (error) {
    console.error("Error formatting with Prettier:", error);
  }

  return formattedContent;
}

// Endpoint to handle content formatting requests
app.post("/prometheusHackerRank", async (req, res) => {
  const { content } = req.body;
  const cacheKey = `formatted:${content}`;

  try {
    console.log("\nReceived content for formatting:", content);

    // Check cache first
    const cachedContent = cache.get(cacheKey);
    if (cachedContent) {
      console.log("\nReturning cached formatted content");
      return res.json({ formattedContent: cachedContent });
    }

    const prompt = `
Your Axiom: You are an expert in formatting content into Markdown. You have the knowledge to convert various content structures into clean, readable Markdown.
Your Task: Format the following content into Markdown. Preserve all mathematical notations and ensure they are properly formatted for LaTeX rendering. Use the format $\\frac{a}{b} = c$ for fractions and their decimal equivalents. Ensure code blocks are properly formatted and maintain their syntax highlighting. Pay special attention to the formatting of arrays, constraints, and input/output examples. Preserve all original information, including STDIN and Function details in code blocks.
Content:
${content}
Your formatted Markdown content:
`;

    console.log("\nSending prompt to GROQ API");
    const response = await retryWithExponentialBackoff(async () => {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama3-70b-8192",
        temperature: 0.2,
        max_tokens: 2048,
        top_p: 0.7,
        stream: false,
        stop: null,
      });
      return chatCompletion.choices[0].message.content.trim();
    });

    console.log("\nReceived response from GROQ API:", response);
    const formattedContent = await formatContent(response);
    console.log("Formatted content in Markdown:\n", formattedContent);

    // Cache the result
    cache.set(cacheKey, formattedContent);

    res.json({ formattedContent });
  } catch (error) {
    console.error("\nError during content formatting:", error);
    if (error.status === 401) {
      res.status(401).json({
        error: "Invalid API Key. Please check your GROQ API Key and try again.",
      });
    } else {
      res.status(500).json({
        error: "An error occurred during content formatting",
        details: error.message,
      });
    }
  }
});

// Route to solve the problem
app.post("/solveProblem", async (req, res) => {
  const { problemStatement, userSolution } = req.body;

  try {
    console.log("\nReceived request to solve problem");

    const prompt = `
You are an expert programmer tasked with solving a HackerRank problem.
Given the problem statement and a partial solution, complete the solution to pass all test cases.
Problem Statement:
${problemStatement}
Partial Solution:
${userSolution}
Please provide a complete, working solution that will pass all test cases.
Include all necessary imports, function definitions, and ensure the main function
or solution logic is complete. Do not omit any part of the code.
Do not explain the code, just provide the code.
Do not add any text before or after the code.
Do not use triple backticks (\`\`\`) or any other formatting around the code.
Your response should contain only the complete code solution, nothing else.
Your complete solution:
`;

    console.log("\nSending prompt to GROQ API");
    const response = await retryWithExponentialBackoff(async () => {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama3-70b-8192",
        temperature: 0.1,
        max_tokens: 4096,
        top_p: 0.3,
        stream: false,
        stop: null,
      });
      return chatCompletion.choices[0].message.content.trim();
    });

    console.log("\nReceived response from GROQ API");
    res.json({ solution: response });
  } catch (error) {
    console.error("\nError during problem solving:", error);
    res.status(500).json({
      error: "An error occurred during problem solving",
      details: error.message,
    });
  }
});

// Start the server and print the banner
app.listen(port, () => {
  const banner = `
    ██████╗ ██████╗  ██████╗ ███╗   ███╗███████╗████████╗██╗  ██╗███████╗██╗   ██╗███████╗
    ██╔══██╗██╔══██╗██║   ██║████╗ ████║██╔════╝╚══██╔══╝██║  ██║██╔════╝██║   ██║██╔════╝
    ██████╔╝██████╔╝██║   ██║██╔████╔██║█████╗     ██║   ███████║█████╗  ██║   ██║███████╗
    ██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔══╝     ██║   ██╔══██║██╔══╝  ██║   ██║╚════██║
    ██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║███████╗   ██║   ██║  ██║███████╗╚██████╔╝███████║
    ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝
      ██╗  ██╗ █████╗  ██████╗██╗  ██╗███████╗██████╗ ██████╗  █████╗ ███╗   ██╗██╗  ██╗
      ██║  ██║██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝
      ███████║███████║██║     █████╔╝ █████╗  ██████╔╝██████╔╝███████║██╔██╗ ██║█████╔╝
      ██╔══██║██╔══██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗██╔══██╗██╔══██║██║╚██╗██║██╔═██╗
      ██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██║  ██║██║  ██║██║  ██║██║ ╚████║██║  ██╗
      ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
    `;

  console.log(banner);
  console.log(
    `Prometheus HackerRank is delivering the knowledge of HackerRank at http://localhost:${port}`,
  );
  console.log(
    "\nAwaiting the spark of enlightenment...\nPrometheus' torch of knowledge will ignite once extension activation is complete.",
  );
});
