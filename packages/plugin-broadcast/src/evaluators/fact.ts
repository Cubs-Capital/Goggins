import { IAgentRuntime, Memory, Evaluator } from "@elizaos/core";

interface Broadcast {
  broadcast_id: string;
  created_at: number;
  user_id: string;
  user_username: string;
  user_is_verified: boolean;
  user_follower_count: number;
  buy_token_id: string;
  buy_token_amount: number;
  buy_token_price_bcast: number;
  buy_token_mcap_bcast: number;
  sell_token_id: string;
  sell_token_amount: number;
  sell_token_price_bcast: number;
  sell_token_mcap_bcast: number;
}

interface BroadcastData {
  recentBroadcasts: Broadcast[];
  metrics: {
    totalBroadcasts: number;
    uniqueTokens: number;
    uniqueUsers: number;
    totalVolume24h: number;
    verifiedUserPercentage: number;
    averageTokenPrice: number;
  };
}

const evaluateBroadcastsImpl = async (runtime: IAgentRuntime, message: Memory): Promise<string> => {
  const broadcastData = message.content.broadcastData as BroadcastData;
  if (!broadcastData || !broadcastData.recentBroadcasts) {
    return "No recent broadcast data available.";
  }

  const { recentBroadcasts, metrics } = broadcastData;

  const importantBroadcasts = recentBroadcasts.filter((broadcast: Broadcast) =>
    broadcast.user_is_verified && broadcast.user_follower_count > 1000
  );

  importantBroadcasts.sort((a: Broadcast, b: Broadcast) =>
    (b.buy_token_amount * b.buy_token_price_bcast) - (a.buy_token_amount * a.buy_token_price_bcast)
  );

  let feedbackMessage = `Broadcast Data Analysis:
Total Broadcasts: ${metrics.totalBroadcasts}
Unique Tokens: ${metrics.uniqueTokens}
Unique Users: ${metrics.uniqueUsers}
24h Volume: $${metrics.totalVolume24h.toLocaleString()}
Verified User %: ${(metrics.verifiedUserPercentage * 100).toFixed(2)}%
Avg Token Price: $${metrics.averageTokenPrice.toFixed(2)}

Top Broadcasts:
`;

  importantBroadcasts.slice(0, 5).forEach((broadcast: Broadcast, index: number) => {
    feedbackMessage += `
${index + 1}. ${broadcast.user_username} (${broadcast.user_follower_count} followers)
   Buy Token: ${broadcast.buy_token_id}
   Buy Amount: ${broadcast.buy_token_amount.toLocaleString()}
   Buy Price: $${broadcast.buy_token_price_bcast.toFixed(8)}
   Buy Volume: $${(broadcast.buy_token_amount * broadcast.buy_token_price_bcast).toLocaleString()}
`;
  });

  return feedbackMessage;
};

export const evaluateBroadcasts: Evaluator = {
  name: "evaluateBroadcasts",
  description: "Evaluates broadcast data and provides analysis",
  similes: ["ANALYZE_BROADCASTS", "EVALUATE_BROADCASTS", "CHECK_BROADCASTS"],
  examples: [
    {
      context: "User wants to analyze recent broadcasts",
      messages: [
        {
          user: "user",
          content: {
            text: "Analyze recent broadcasts",
            action: "ANALYZE_BROADCASTS"
          }
        }
      ],
      outcome: "Analyzing recent broadcast data with metrics and top broadcasts"
    },
    {
      context: "User wants to check broadcast metrics",
      messages: [
        {
          user: "user",
          content: {
            text: "Check broadcast metrics",
            action: "EVALUATE_BROADCASTS"
          }
        }
      ],
      outcome: "Checking broadcast metrics including volume, users, and prices"
    },
    {
      context: "User wants to evaluate broadcast data",
      messages: [
        {
          user: "user",
          content: {
            text: "Evaluate broadcast data",
            action: "CHECK_BROADCASTS"
          }
        }
      ],
      outcome: "Evaluating broadcast data for important trends and metrics"
    }
  ],
  validate: async () => true,
  handler: evaluateBroadcastsImpl
};

export const factEvaluator: Evaluator = {
  name: "factEvaluator",
  description: "Evaluates broadcast facts and provides analysis",
  similes: ["ANALYZE_FACTS", "EVALUATE_FACTS", "CHECK_FACTS"],
  examples: [
    {
      context: "User wants to analyze broadcast facts",
      messages: [
        {
          user: "user",
          content: {
            text: "Analyze broadcast facts",
            action: "ANALYZE_FACTS"
          }
        }
      ],
      outcome: "Analyzing broadcast facts and extracting key information"
    },
    {
      context: "User wants to check fact metrics",
      messages: [
        {
          user: "user",
          content: {
            text: "Check fact metrics",
            action: "EVALUATE_FACTS"
          }
        }
      ],
      outcome: "Checking fact metrics and statistical analysis"
    },
    {
      context: "User wants to evaluate fact data",
      messages: [
        {
          user: "user",
          content: {
            text: "Evaluate fact data",
            action: "CHECK_FACTS"
          }
        }
      ],
      outcome: "Evaluating fact data for patterns and insights"
    }
  ],
  validate: async () => true,
  handler: evaluateBroadcastsImpl
};

export const factsTemplate =
`TASK: Analyze the latest broadcast data and provide feedback on the most important broadcasts.

# INSTRUCTIONS

Use the evaluateBroadcasts function to analyze the broadcast data stored in message.content.broadcastData.
- Filter broadcasts by verified users with high follower count (>1000)
- Sort broadcasts by buy token volume (amount * price) in descending order
- Generate a feedback message with key metrics and details on the top 5 important broadcasts
- Return the feedback message
`;

export const formatFacts = (facts: Memory[]): string => {
  return facts.map(fact => fact.content.text).join('\n');
};