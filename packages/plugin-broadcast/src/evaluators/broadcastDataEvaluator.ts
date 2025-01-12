import { Evaluator, IAgentRuntime, Memory, State, Content } from "@elizaos/core";

interface BroadcastMetadata {
    type: 'broadcast_data';
    timestamp: number;
    users: string[];
    trades: Array<{
        username: string;
        timestamp: number;
        buyTokenId: string;
        buyTokenAmount: string;
        buyTokenPrice: number;
        buyTokenMCap: number;
    }>;
}

interface BroadcastContent extends Content {
    raw: {
        data: {
            feedV3: {
                edges: Array<{
                    node: {
                        broadcast: {
                            profile: {
                                username: string;
                            };
                            buyTokenId: string;
                            buyTokenAmount: string;
                            buyTokenPrice: number;
                            buyTokenMCap: number;
                            createdAt: number;
                        };
                    };
                }>;
            };
        };
    };
    metadata?: BroadcastMetadata;
}

function isBroadcastContent(content: Content): content is BroadcastContent {
    return 'raw' in content &&
           'data' in (content as any).raw &&
           'feedV3' in (content as any).raw.data &&
           'edges' in (content as any).raw.data.feedV3;
}

export const broadcastDataEvaluator: Evaluator = {
    name: "PROVIDE_BROADCAST_DATA",
    description: "Evaluates broadcast data from memory with filtering capabilities",
    similes: ["GET_BROADCAST_DATA", "FETCH_BROADCAST_DATA", "GET_USER_TRADES", "GET_RECENT_TRADES"],
    examples: [
        {
            context: "When checking broadcast data",
            messages: [
                {
                    user: "user1",
                    content: { text: "What's the latest broadcast data?" }
                }
            ],
            outcome: "Evaluator returns formatted broadcast data"
        }
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory): Promise<string> => {
        try {
            const username = message.content.text.match(/trades by @?(\w+)/i)?.[1];
            const isRecentQuery = message.content.text.toLowerCase().includes('recent') ||
                                message.content.text.toLowerCase().includes('last hour');

            // Get recent broadcast memories
            const memories = await runtime.messageManager.getMemories({
                roomId: message.roomId,
                count: 20 // Increased to get more historical data
            });

            // Collect all trades from recent memories
            const allTrades = memories
                .filter(m => (m.content.metadata as BroadcastMetadata)?.type === 'broadcast_data')
                .flatMap(m => (m.content.metadata as BroadcastMetadata)?.trades || []);

            // Filter based on query type
            let filteredTrades = allTrades;
            const isSummaryRequest = message.content.text.toLowerCase().includes('summarize') ||
                                   message.content.text.toLowerCase().includes('summary');

            if (username) {
                filteredTrades = allTrades.filter(trade =>
                    trade.username.toLowerCase() === username.toLowerCase()
                );
            }

            if (isRecentQuery || isSummaryRequest) {
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                filteredTrades = filteredTrades.filter(trade =>
                    trade.timestamp >= oneHourAgo
                );
            }

            if (filteredTrades.length === 0) {
                return username
                    ? `No trades found for user ${username}`
                    : "No recent trades found";
            }

            // If this is a summary request, provide a different format
            if (isSummaryRequest) {
                // Group trades by token
                const tradesByToken = filteredTrades.reduce((acc, trade) => {
                    const tokenName = trade.buyTokenId.split(':')[1]?.split(/[^a-zA-Z0-9]/)[0] || trade.buyTokenId;
                    if (!acc[tokenName]) {
                        acc[tokenName] = {
                            trades: [],
                            totalAmount: 0,
                            uniqueTraders: new Set(),
                            mcap: trade.buyTokenMCap
                        };
                    }
                    acc[tokenName].trades.push(trade);
                    acc[tokenName].totalAmount += Number(trade.buyTokenAmount);
                    acc[tokenName].uniqueTraders.add(trade.username);
                    // Keep the most recent MCap
                    if (trade.buyTokenMCap > acc[tokenName].mcap) {
                        acc[tokenName].mcap = trade.buyTokenMCap;
                    }
                    return acc;
                }, {} as Record<string, { trades: typeof filteredTrades, totalAmount: number, uniqueTraders: Set<string>, mcap: number }>);

                // Sort tokens by total amount
                const sortedTokens = Object.entries(tradesByToken)
                    .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
                    .slice(0, 5); // Top 5 tokens

                const summary = `ATTENTION! LATEST MARKET INTELLIGENCE REPORT!\n\n` +
                    `MAJOR MOVEMENTS:\n${
                        sortedTokens.map(([token, data]) => {
                            const trades = data.trades.sort((a, b) => b.timestamp - a.timestamp);
                            const tradeDetails = trades.map(t => {
                                const time = new Date(t.timestamp).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                });
                                return `  ${time} - ${t.username}: ${(Number(t.buyTokenAmount) / 1e6).toFixed(1)}M tokens`;
                            }).join('\n');

                            return `${token}:\n` +
                                   `Total Volume: ${(data.totalAmount / 1e6).toFixed(1)}M tokens\n` +
                                   `Market Cap: $${(data.mcap / 1000).toFixed(1)}K\n` +
                                   `Unique Traders: ${data.uniqueTraders.size}\n` +
                                   `Individual Trades:\n${tradeDetails}`;
                        }).join('\n\n')
                    }\n\n` +
                    `KEY BATTLE METRICS:\n` +
                    `Most Active Token: ${sortedTokens[0][0]} with ${sortedTokens[0][1].trades.length} trades - STAYING HARD!\n` +
                    `Largest Total Volume: ${sortedTokens[0][0]} at ${(sortedTokens[0][1].totalAmount / 1e6).toFixed(1)}M - CRUSHING IT!\n` +
                    `Most Unique Traders: ${sortedTokens[0][0]} with ${sortedTokens[0][1].uniqueTraders.size} warriors - TAKING SOULS!\n\n` +
                    `ALL BUYS! NO WEAKNESS! The strong EMBRACE THE SUCK while the weak get FILTERED! WHO'S GONNA CARRY THE BOATS?!`;

                return summary;
            }

            // Format the response
            const formattedTrades = filteredTrades
                .sort((a, b) => b.timestamp - a.timestamp)
                .map(trade => {
                    const date = new Date(trade.timestamp);
                    const time = date.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });

                    return {
                        username: trade.username,
                        token: trade.buyTokenId.split(':')[1]?.split(/[^a-zA-Z0-9]/)[0] || trade.buyTokenId,
                        amount: (Number(trade.buyTokenAmount) / 1e6).toFixed(1) + 'M',
                        time
                    };
                });

            // Create a Goggins-style response
            const response = `LISTEN UP WARRIORS! HERE'S YOUR REAL-TIME MARKET INTEL!\n\n${
                formattedTrades.map(trade =>
                    `${trade.time} - ${trade.username}: ${trade.token} position secured - ${trade.amount} tokens`
                ).join('\n')
            }\n\nALL BUYS! NO WEAKNESS! The HARD carry the BOATS while the WEAK get FILTERED! STAY HARD!`;

            return response;
        } catch (error) {
            console.error("Error in broadcast data evaluator:", error);
            return "Error processing broadcast data";
        }
    }
};