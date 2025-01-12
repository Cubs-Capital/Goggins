import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { randomUUID } from 'crypto';

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://mainnet-api.vector.fun/graphql';
const HEADERS = {
  "Content-Type": "application/json",
  //"Authorization": `Bearer ${process.env.AUTH_TOKEN}`
};

async function makeGraphQLRequest(query: string, variables: any = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data;
  } catch (error) {
    console.error('GraphQL request failed:', error);
    throw error;
  }
}

export const graphCallAction: Action = {
  name: "GRAPHQL_CALL",
  similes: ["QUERY_GRAPHQL", "FETCH_GRAPHQL"],
  description: "Makes GraphQL queries to the specified endpoint",
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Query the GraphQL API for user data" }
      },
      {
        user: "{{user2}}",
        content: { text: "Executing GraphQL query...", action: "GRAPHQL_CALL" }
      }
    ]
  ],

  validate: async (_runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
    const content = _message.content as { text: string };
    return /\b(graphql|query|fetch)\b/i.test(content.text);
  },

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<{ text: string; content?: any }> => {
    try {
      const content = _message.content as {
        text: string;
        query?: string;
        variables?: any
      };

      if (!content.query) {
        return {
          text: "No GraphQL query provided",
          content: { error: "Missing query" }
        };
      }

      const data = await makeGraphQLRequest(content.query, content.variables);

      // Format the response for Discord
      const formattedResponse = `**GraphQL Query Results:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;

      return {
        text: formattedResponse,
        content: { data }
      };
    } catch (error) {
      const errorMessage = `**Error executing GraphQL query:**\n\`\`\`\n${error.message}\n\`\`\``;
      return {
        text: errorMessage,
        content: { error: error.message }
      };
    }
  }
};
