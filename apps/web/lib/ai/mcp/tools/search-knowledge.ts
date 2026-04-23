/**
 * Search Knowledge tools - searchKnowledgeBase, getFullDocumentContent
 */

import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { Session } from "next-auth";
import {
  searchSimilarChunks,
  formatSearchResultsForLLM,
  getDocumentFullContent,
  getDocument,
} from "@/lib/ai/rag/langchain-service";

/**
 * Create the search knowledge tools
 */
export function createSearchKnowledgeTools(
  session: Session,
  embeddingsAuthToken?: string,
) {
  return [
    // searchKnowledgeBase tool
    tool(
      "searchKnowledgeBase",
      [
        "Search the user's strategy memory for relevant information.",
        "This includes uploaded documents AND the user's focus settings (people of interest, topics of interest, etc.).",
        "",
        "**MUST USE** when:",
        "1) User asks about their documents, files, or uploaded content",
        "2) User asks questions related to their focus people, topics, or strategy",
        "",
        "**⭐ SEARCH STRATEGY - IMPORTANT:**",
        "- When searching, use MULTIPLE SEPARATE keywords instead of a single long phrase",
        "- Try different keyword combinations if first search doesn't find results",
        "- Examples:",
        "  ❌ BAD: query='Alloomi PR feature new' (too specific, won't match)",
        "  ✅ GOOD: Try query='PR', then query='Alloomi', then query='feature', then query='new' (multiple searches)",
        "",
        "Examples:",
        "- 'What's in this document?'",
        "- 'What do I care about?'",
        "- 'What are my priorities?'",
        "- 'What do you know about X?' → Try query='X', then query='related topic'",
        "- 'Find information about Y' → Try query='Y', then query='broader term'",
        "- 'Alloomi PR feature progress' → Try query='PR', then query='Alloomi', then query='feature' (multiple searches)",
        "",
        "Use this tool BEFORE answering questions about user's content or preferences.",
      ].join("\n"),
      {
        query: z
          .string()
          .describe(
            "The search query to find relevant information in the user's strategy memory",
          ),
        limit: z.coerce
          .number()
          .min(1)
          .max(20)
          .default(5)
          .describe(
            "Maximum number of relevant chunks to retrieve (default: 5, max: 20)",
          ),
        documentIds: z
          .array(z.string())
          .optional()
          .describe(
            "Optional: specific document IDs to search within. If not provided, searches all documents.",
          ),
      },
      async (args) => {
        try {
          const { query, limit = 5, documentIds } = args;

          // Validate user session
          if (!session?.user?.id) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Unauthorized: invalid user session",
                },
              ],
              isError: true,
            };
          }

          const userId = session.user.id;

          // Search for similar chunks in the user's knowledge base
          const results = await searchSimilarChunks(
            userId,
            query,
            {
              limit,
              threshold: 0.5, // Lower threshold for better recall (50% similarity)
              documentIds, // Pass document IDs to filter the search
            },
            embeddingsAuthToken,
          ); // Pass auth token for embeddings API

          if (results.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text:
                    documentIds && documentIds.length > 0
                      ? "No relevant information found in the specified documents."
                      : "No relevant information found in your strategy memory. Try uploading documents or rephrase your question.",
                },
              ],
              data: {
                results: [],
                count: 0,
              },
            };
          }

          // Format results for LLM
          const formattedContent = formatSearchResultsForLLM(results);

          return {
            content: [
              {
                type: "text" as const,
                text: formattedContent,
              },
            ],
            data: {
              results: results.map((r) => ({
                documentName: r.documentName,
                content: r.content,
                similarity: r.similarity,
                chunkIndex: r.chunkIndex,
              })),
              count: results.length,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No results found in knowledge base.",
              },
            ],
            data: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
            isError: true,
          };
        }
      },
    ),

    // getFullDocumentContent tool
    tool(
      "getFullDocumentContent",
      [
        "Get the COMPLETE full text content of a document.",
        "",
        "Use this when the user asks to:",
        "- Summarize a document",
        "- Explain 'what's in this document'",
        "- Analyze the entire document content",
        "",
        "This provides ALL chunks concatenated together, not just relevant excerpts.",
        "Best for small documents or summarization tasks.",
      ].join("\n"),
      {
        documentId: z
          .string()
          .describe("The ID of the document to retrieve full content for"),
      },
      async (args) => {
        try {
          const { documentId } = args;

          // Validate user session
          if (!session?.user?.id) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Unauthorized: invalid user session",
                },
              ],
              isError: true,
            };
          }

          const userId = session.user.id;

          // First verify the document belongs to this user
          const document = await getDocument(documentId);

          if (!document) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Document not found.",
                },
              ],
              isError: true,
            };
          }

          if (document.userId !== userId) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Unauthorized: you don't have access to this document.",
                },
              ],
              isError: true,
            };
          }

          // Get full content
          const result = await getDocumentFullContent(documentId);

          return {
            content: [
              {
                type: "text" as const,
                text: result.content,
              },
            ],
            data: {
              documentId: result.documentId,
              documentName: document.fileName,
              totalChunks: result.totalChunks,
              contentLength: result.content.length,
              message: `Successfully retrieved full content of "${document.fileName}" (${result.totalChunks} chunks, ${result.content.length} characters).`,
            },
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Failed to retrieve document content.",
              },
            ],
            data: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
            isError: true,
          };
        }
      },
    ),
  ];
}
