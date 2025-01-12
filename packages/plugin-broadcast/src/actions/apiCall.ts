import {
    Action,
    IAgentRuntime,
    Memory,
    HandlerCallback,
    State,
    elizaLogger,
} from "@elizaos/core";

export const apiCallAction: Action = {
    name: "apiCallAction",
    similes: ["FETCH_BROADCASTS", "GET_BROADCASTS", "SUMMARIZE_BROADCASTS, GET_LATEST_BROADCASTS"],
    description: "Fetch raw broadcast data from Vector API",
    examples: [],
    validate: async (runtime: IAgentRuntime, message: Memory) => true,
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            // Validate user context first
            if (!message?.userId || !message?.roomId) {
                elizaLogger.error('Missing required message properties: userId or roomId');
                callback?.({ text: "Error: Missing user or room information. Please ensure proper authentication." });
                return false;
            }

            try {
                // Try to ensure connection - this will fail if user doesn't exist
                await runtime.ensureConnection(
                    message.userId,
                    message.roomId,
                    "API User",
                    "API User",
                    "api"
                );
            } catch (error) {
                elizaLogger.error(`Failed to validate user ${message.userId}:`, error);
                callback?.({ text: "Error: Failed to validate user. Please ensure proper account setup." });
                return false;
            }

            elizaLogger.info('Starting broadcast data fetch from Vector API');

            const apiResponse = await fetch('https://mainnet-api.vector.fun/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `query FeedListsQuery($mode: FeedMode!, $sortOrder: FeedSortOrder!, $filters: FeedFilters, $after: String, $first: Int) { feedV3(mode: $mode, sortOrder: $sortOrder, filters: $filters, after: $after, first: $first) { edges { cursor node { broadcast { id buyTokenId buyTokenAmount buyTokenPrice: buyTokenPriceV2 buyTokenMCap: buyTokenMCapV2 createdAt profile { id username } } buyToken { id name symbol price volume24h } } } pageInfo { endCursor hasNextPage } } }`,
                    variables: {
                        mode: "ForYou",
                        sortOrder: "Newest",
                        filters: {
                            direction: "Buy"
                        },
                        after: null,
                        first: 10
                    }
                })
            });

            elizaLogger.debug('Received response from Vector API');
            const data = await apiResponse.json();

            // Store in memory for immediate use
            const memory: Memory = {
                id: crypto.randomUUID(),
                content: {
                    text: JSON.stringify(data),
                    raw: data,
                    metadata: {
                        type: 'broadcast_data',
                        timestamp: Date.now(),
                        users: data.data.feedV3.edges.map(edge => edge.node.broadcast.profile.username),
                        trades: data.data.feedV3.edges.map(edge => ({
                            username: edge.node.broadcast.profile.username,
                            timestamp: edge.node.broadcast.createdAt,
                            buyTokenId: edge.node.broadcast.buyTokenId,
                            buyTokenAmount: edge.node.broadcast.buyTokenAmount,
                            buyTokenPrice: edge.node.broadcast.buyTokenPrice,
                            buyTokenMCap: edge.node.broadcast.buyTokenMCap
                        }))
                    }
                },
                roomId: message.roomId,
                userId: message.userId,
                agentId: runtime.agentId,
                createdAt: Date.now()
            };

            await runtime.messageManager.createMemory(memory);

            // Process and format the broadcast data
            const broadcasts = data.data.feedV3.edges;
            if (!broadcasts || broadcasts.length === 0) {
                callback?.({ text: "No recent broadcasts found." });
                return true;
            }

            // Format the response in the energetic style
            let formattedResponse = "ATTENTION WARRIORS! Here's your REAL-TIME MARKET INTEL from the FRONT LINES!\n\n";
            formattedResponse += "LATEST MARKET OPERATIONS:\n";

            broadcasts.slice(0, 5).forEach(edge => {
                const broadcast = edge.node.broadcast;
                const token = edge.node.buyToken;
                const timestamp = new Date(broadcast.createdAt).toISOString().split('T')[1].slice(0, 8);

                formattedResponse += `- ${timestamp} UTC: ${broadcast.profile.username} deployed ${Number(broadcast.buyTokenAmount).toLocaleString()} ${token.symbol} tokens\n`;
                formattedResponse += `  Price: $${Number(broadcast.buyTokenPrice).toExponential(2)} | MCap: $${Number(broadcast.buyTokenMCap).toLocaleString()}\n`;
            });

            formattedResponse += "\nVOLUME LEADERS SHOWING STRENGTH:\n";
            const volumeLeaders = broadcasts
                .filter(edge => edge.node.buyToken.volume24h)
                .sort((a, b) => b.node.buyToken.volume24h - a.node.buyToken.volume24h)
                .slice(0, 3);

            volumeLeaders.forEach(edge => {
                const token = edge.node.buyToken;
                formattedResponse += `- ${token.symbol}: $${Number(token.volume24h).toLocaleString()}\n`;
            });

            formattedResponse += "\nSTAY HARD! NO EXCUSES! WHO'S GONNA CARRY THE CHARTS?!";

            callback?.({ text: formattedResponse });
            return true;
        } catch (error) {
            elizaLogger.error('Error in broadcast data processing:', error);
            elizaLogger.debug('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });

            callback?.({ text: `Error processing broadcast data: ${error.message}` });
            return false;
        }
    }
}
