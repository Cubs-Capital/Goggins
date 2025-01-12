import {
    Action,
    IAgentRuntime,
    Memory,
    HandlerCallback,
    State,
    elizaLogger,
} from "@elizaos/core";

export const fetchProfilesAction: Action = {
    name: "fetchProfilesAction",
    similes: ["FETCH_PROFILES", "GET_PROFILES", "LIST_PROFILES"],
    description: "Fetch Vector profiles data and store in memory",
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
            elizaLogger.info('Starting profile data fetch from Vector API');

            const query = `query FetchAllProfiles($query: String!, $profileSortBy: String, $first: Int, $after: String, $yourProfileId: String!) {
                searchProfiles(query: $query, sortBy: $profileSortBy, first: $first, after: $after) {
                    edges {
                        node {
                            id
                            username
                            twitterUsername
                            followerCount
                            pnl24h
                            pnl1w
                            pnl1m
                            weeklyLeaderboardStandingPrev1 {
                                rank
                                value
                            }
                            bestEverStanding {
                                rank
                                value
                                leaderboardDate
                            }
                            profileLeaderboardValues {
                                daily {
                                    pnl
                                    volume
                                    maxTradeSize
                                }
                                weekly {
                                    pnl
                                    volume
                                    maxTradeSize
                                }
                            }
                            subscriberCountV2
                            broadcastCount
                        }
                        cursor
                    }
                    pageInfo {
                        endCursor
                        hasNextPage
                    }
                }
            }`;

            const allProfiles = [];
            let hasNextPage = true;
            let afterCursor = null;

            while (hasNextPage) {
                const response = await fetch('https://mainnet-api.vector.fun/graphql', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query,
                        variables: {
                            query: "*",
                            profileSortBy: "followerCount:desc,followeeCount:asc",
                            first: 250,
                            after: afterCursor,
                            yourProfileId: "f40e4966-d55a-4113-ba51-c995f61c2d55"
                        }
                    })
                });

                const data = await response.json();
                const profiles = data.data?.searchProfiles?.edges || [];

                // Transform and add profiles to array
                allProfiles.push(...profiles.map(({ node }: any) => ({
                    id: node.id,
                    username: node.username,
                    twitterUsername: node.twitterUsername,
                    followerCount: node.followerCount,
                    pnl24h: node.pnl24h,
                    pnl1w: node.pnl1w,
                    pnl1m: node.pnl1m,
                    weeklyPnlRank: node.weeklyLeaderboardStandingPrev1?.rank,
                    weeklyPnlValue: node.weeklyLeaderboardStandingPrev1?.value,
                    bestEverRank: node.bestEverStanding?.rank,
                    bestEverValue: node.bestEverStanding?.value,
                    dailyMetrics: node.profileLeaderboardValues.daily,
                    weeklyMetrics: node.profileLeaderboardValues.weekly,
                    subscriberCount: node.subscriberCountV2,
                    broadcastCount: node.broadcastCount
                })));

                const pageInfo = data.data?.searchProfiles?.pageInfo;
                hasNextPage = pageInfo?.hasNextPage || false;
                afterCursor = pageInfo?.endCursor;
            }

            // Ensure connection exists
            await runtime.ensureConnection(
                message.userId,
                message.roomId,
                "API User",
                "API User",
                "api"
            );

            // Store in memory
            const memory: Memory = {
                id: crypto.randomUUID(),
                content: {
                    text: `Fetched ${allProfiles.length} profiles`,
                    raw: allProfiles
                },
                roomId: message.roomId,
                userId: message.userId,
                agentId: runtime.agentId,
                createdAt: Date.now()
            };

            await runtime.messageManager.createMemory(memory);

            // Send a simple success message without raw data
            callback?.({
                text: `Successfully fetched ${allProfiles.length} profiles from Vector. The data has been stored for processing.`
            });

            return true;
        } catch (error) {
            elizaLogger.error('Error in profile data processing:', error);
            callback?.({ text: `Error processing profile data: ${error.message}` });
            return false;
        }
    }
};