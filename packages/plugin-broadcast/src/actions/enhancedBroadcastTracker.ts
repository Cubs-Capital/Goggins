import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import PostgresProvider, { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres';

interface TokenData {
    name: string;
    symbol: string;
    price: string;
    supply: string;
    chain: string;
    liquidity: string;
    verified: boolean;
    jupVerified: boolean;
    freezable: boolean;
    twitter?: string;
    telegram?: string;
    website?: string;
    discord?: string;
    volume24h: string;
    volume6h: string;
    volume1h: string;
    volume5min: string;
    buyVolume24h: string;
    sellVolume24h: string;
    buyVolume6h: string;
    sellVolume6h: string;
    buyVolume1h: string;
    sellVolume1h: string;
    buyVolume5min: string;
    sellVolume5min: string;
    buyCount24h: number;
    sellCount24h: number;
    buyCount6h: number;
    sellCount6h: number;
    buyCount1h: number;
    sellCount1h: number;
    buyCount5min: number;
    sellCount5min: number;
    top10HolderPercent: string;
    top10HolderPercentV2: string;
}

interface UserProfile {
    twitterUsername?: string;
    visibility?: string;
    isVerified?: boolean;
    followerCount?: number;
    followeeCount?: number;
    mutualFollowersV2?: {
        totalCount: number;
    };
    weeklyLeaderboardStanding?: {
        rank: number;
        value: number;
    };
    bestEverStanding?: {
        rank: number;
        value: number;
    };
    topThreePnlWin?: number[];
    topThreePnlLoss?: number[];
    topThreeVolume?: number[];
    profileLeaderboardValues?: {
        daily: {
            pnl: number;
            volume: number;
        };
        weekly: {
            pnl: number;
            volume: number;
        };
    };
    subscriberCountV2?: number;
    subscribedByProfileV2?: boolean;
    followedByProfile?: boolean;
}

const OUTPUT_FILE = 'enriched_broadcasts.csv';
const GRAPHQL_ENDPOINT = "https://mainnet-api.vector.fun/graphql";
let seenBroadcastIds = new Set<string>();
let broadcastDataDict: { [key: string]: any } = {};

function initializeCsv() {
    const columns = [
        "broadcast_id", "created_at",
        "user_id", "user_username",
        "buy_token_id", "buy_token_amount", "buy_token_price_bcast", "buy_token_mcap_bcast",
        "sell_token_id", "sell_token_amount", "sell_token_price_bcast", "sell_token_mcap_bcast",
        "broadcast_has_buy_token", "broadcast_has_sell_token",
        "user_twitter_username", "user_is_verified", "user_is_verified_binary",
        "user_follower_count", "user_followee_count", "user_mutual_follower_count",
        "user_mutual_followers_binary",
        "user_visibility", "user_visible_public",
        "user_weekly_rank", "user_weekly_value",
        "user_weekly_rank_is_top100",
        "user_best_rank", "user_best_rank_value",
        "user_best_rank_is_top100",
        "user_top_three_pnl_win_total",
        "user_top_three_pnl_loss_total",
        "user_top_three_volume_total",
        "user_daily_pnl", "user_daily_volume",
        "user_weekly_pnl", "user_weekly_volume",
        "user_subscriber_count", "user_has_subscribers",
        "user_followed_by_you", "user_followed_by_you_binary",
        "user_subscribed_by_you", "user_subscribed_by_you_binary",
        "user_has_twitter",
        "buy_token_name", "buy_token_symbol", "buy_token_price", "buy_token_supply",
        "buy_token_chain", "buy_token_liquidity", "buy_token_has_liquidity",
        "buy_token_volume24h", "buy_token_volume6h", "buy_token_volume1h", "buy_token_volume5min",
        "buy_token_buyVolume24h", "buy_token_sellVolume24h",
        "buy_token_buyVolume6h", "buy_token_sellVolume6h",
        "buy_token_buyVolume1h", "buy_token_sellVolume1h",
        "buy_token_buyVolume5min", "buy_token_sellVolume5min",
        "buy_token_buyCount24h", "buy_token_sellCount24h",
        "buy_token_buyCount6h", "buy_token_sellCount6h",
        "buy_token_buyCount1h", "buy_token_sellCount1h",
        "buy_token_buyCount5min", "buy_token_sellCount5min",
        "buy_token_verified", "buy_token_is_verified",
        "buy_token_jupVerified", "buy_token_is_jupVerified",
        "buy_token_freezable", "buy_token_is_freezable",
        "buy_token_twitter", "buy_token_has_twitter",
        "buy_token_telegram", "buy_token_has_telegram",
        "buy_token_website", "buy_token_has_website",
        "buy_token_discord", "buy_token_has_discord",
        "buy_token_top10HolderPercent", "buy_token_top10HolderPercentV2",
        "price_30s_variance", "price_1m_variance", "price_5m_variance",
        "won_30s", "won_1m", "won_5m"
    ];

    if (!fs.existsSync(OUTPUT_FILE)) {
        const csvWriter = createObjectCsvWriter({
            path: OUTPUT_FILE,
            header: columns.map(id => ({ id, title: id }))
        });
        csvWriter.writeRecords([]);
    } else {
        const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        const rows = content.split('\n').slice(1);
        rows.forEach(row => {
            if (!row) return;
            try {
                const fields = row.split(',');
                const broadcastId = fields[0];
                if (broadcastId) {
                    seenBroadcastIds.add(broadcastId);
                    broadcastDataDict[broadcastId] = JSON.parse(row);
                }
            } catch (error) {
                console.error(`Error parsing row: ${row}`, error);
            }
        });
    }
}

async function rewriteCsv() {
    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_FILE,
        header: Object.keys(Object.values(broadcastDataDict)[0] || {}).map(id => ({ id, title: id }))
    });
    await csvWriter.writeRecords(Object.values(broadcastDataDict));
}

async function makeGraphQLRequest(query: string, variables: any) {
    try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables })
        });
        const data = await response.json();
        return data?.data;
    } catch (error) {
        console.error('GraphQL request failed:', error);
        return null;
    }
}

async function fetchBroadcasts(cursor?: string) {
    const query = `
        query FeedListsQuery($mode: FeedMode!, $sortOrder: FeedSortOrder!, $filters: FeedFilters, $after: String, $first: Int) {
            feedV3(mode: $mode, sortOrder: $sortOrder, filters: $filters, after: $after, first: $first) {
                edges {
                    cursor
                    node {
                        broadcast {
                            id
                            buyTokenId
                            buyTokenAmount
                            buyTokenPrice: buyTokenPriceV2
                            buyTokenMCap: buyTokenMCapV2
                            sellTokenId
                            sellTokenAmount
                            sellTokenPrice: sellTokenPriceV2
                            sellTokenMCap: sellTokenMCapV2
                            createdAt
                            profile {
                                id
                                username
                            }
                        }
                    }
                }
                pageInfo {
                    endCursor
                    hasNextPage
                }
            }
        }
    `;

    const variables = {
        mode: "ForYou",
        sortOrder: "Newest",
        after: cursor,
        filters: {
            bcastMCap: null,
            direction: "Buy",
            lookbackMs: null,
            tradeSize: null,
        },
        first: 10
    };

    const data = await makeGraphQLRequest(query, variables);
    return data?.feedV3?.edges || [];
}

async function fetchTokenData(tokenId: string): Promise<TokenData | null> {
    if (!tokenId) return null;

    const query = `
        query tokenScreenQuery($id: ID!) {
            token(id: $id) {
                name
                symbol
                price
                supply
                chain
                liquidity
                verified
                jupVerified
                freezable
                twitter
                telegram
                website
                discord
                volume24h
                volume6h
                volume1h
                volume5min
                buyVolume24h
                sellVolume24h
                buyVolume6h
                sellVolume6h
                buyVolume1h
                sellVolume1h
                buyVolume5min
                sellVolume5min
                buyCount24h
                sellCount24h
                buyCount6h
                sellCount6h
                buyCount1h
                sellCount1h
                buyCount5min
                sellCount5min
                top10HolderPercent
                top10HolderPercentV2
            }
        }
    `;

    const data = await makeGraphQLRequest(query, { id: tokenId });
    return data?.token || null;
}

async function fetchUserProfile(username: string, yourProfileId: string): Promise<UserProfile | null> {
    if (!username) return null;

    const query = `
        query UsernameProfileQuery($username: String!, $yourProfileId: String!) {
            profile(username: $username) {
                twitterUsername
                visibility
                isVerified
                followerCount
                followeeCount
                mutualFollowersV2 {
                    totalCount
                }
                weeklyLeaderboardStanding(leaderboardType: PNL_WIN) {
                    rank
                    value
                }
                bestEverStanding(leaderboardType: PNL_WIN) {
                    rank
                    value
                }
                topThreePnlWin: topThreeFinishes(leaderboardType: PNL_WIN)
                topThreePnlLoss: topThreeFinishes(leaderboardType: PNL_LOSS)
                topThreeVolume: topThreeFinishes(leaderboardType: VOLUME)
                profileLeaderboardValues {
                    daily {
                        pnl
                        volume
                    }
                    weekly {
                        pnl
                        volume
                    }
                }
                subscriberCountV2
                subscribedByProfileV2(profileId: $yourProfileId)
                followedByProfile(profileId: $yourProfileId)
            }
        }
    `;

    const data = await makeGraphQLRequest(query, { username, yourProfileId });
    return data?.profile || null;
}

async function computeVariance(buyTokenId: string, buyPriceBcast: number): Promise<number> {
    const tokenDataNow = await fetchTokenData(buyTokenId);
    if (!tokenDataNow) return 0;

    const currentPrice = parseFloat(tokenDataNow.price);
    if (buyPriceBcast !== 0 && currentPrice) {
        return ((currentPrice - buyPriceBcast) / buyPriceBcast) * 100;
    }
    return 0;
}

async function setVarianceAndWon(broadcastId: string, fieldNameVar: string, fieldNameWon: string, variance: number) {
    if (broadcastId in broadcastDataDict) {
        broadcastDataDict[broadcastId][fieldNameVar] = variance;
        broadcastDataDict[broadcastId][fieldNameWon] = variance > 25;
        await rewriteCsv();
    }
}

async function scheduleVarianceUpdate(
    runtime: IAgentRuntime,
    broadcastId: string,
    buyTokenId: string,
    buyPriceBcast: number,
    waitTime: number,
    fieldNameVar: string,
    fieldNameWon: string
) {
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    const variance = await computeVariance(buyTokenId, buyPriceBcast);
    await setVarianceAndWon(broadcastId, fieldNameVar, fieldNameWon, variance);

    // Send Discord update
    const message = {
        id: randomUUID(),
        content: {
            text: `${fieldNameVar.replace('price_', '').replace('_variance', '')} Update for ${broadcastId}:
Price variance: ${variance.toFixed(2)}%
Won: ${variance > 25 ? 'Yes! 🚀' : 'Not yet'}`,
            channelName: 'broadcast-alerts'
        },
        roomId: randomUUID(),
        userId: randomUUID(),
        agentId: runtime.agentId || randomUUID(),
        createdAt: Date.now()
    };

    await runtime.messageManager.createMemory(message);
}

async function scheduleUpdates(
    runtime: IAgentRuntime,
    broadcastId: string,
    buyTokenId: string,
    buyPriceBcast: number
) {
    // Schedule 30s, 1m, and 5m updates
    scheduleVarianceUpdate(runtime, broadcastId, buyTokenId, buyPriceBcast, 30, "price_30s_variance", "won_30s");
    scheduleVarianceUpdate(runtime, broadcastId, buyTokenId, buyPriceBcast, 60, "price_1m_variance", "won_1m");
    scheduleVarianceUpdate(runtime, broadcastId, buyTokenId, buyPriceBcast, 300, "price_5m_variance", "won_5m");
}

async function processBroadcast(runtime: IAgentRuntime, broadcast: any, buyTokenData: TokenData | null) {
    const broadcastId = broadcast.id;
    if (seenBroadcastIds.has(broadcastId)) return;

    seenBroadcastIds.add(broadcastId);
    const userData = await fetchUserProfile(broadcast.profile.username, process.env.YOUR_PROFILE_ID || '');

    const rowData = {
        broadcast_id: broadcastId,
        created_at: broadcast.createdAt,
        user_id: broadcast.profile.id,
        user_username: broadcast.profile.username,
        buy_token_id: broadcast.buyTokenId,
        buy_token_amount: parseFloat(broadcast.buyTokenAmount),
        buy_token_price_bcast: parseFloat(broadcast.buyTokenPrice),
        buy_token_mcap_bcast: parseFloat(broadcast.buyTokenMCap),
        sell_token_id: broadcast.sellTokenId,
        sell_token_amount: parseFloat(broadcast.sellTokenAmount),
        sell_token_price_bcast: parseFloat(broadcast.sellTokenPrice),
        sell_token_mcap_bcast: parseFloat(broadcast.sellTokenMCap),
        broadcast_has_buy_token: broadcast.buyTokenId ? 1 : 0,
        broadcast_has_sell_token: broadcast.sellTokenId ? 1 : 0,
        user_twitter_username: userData?.twitterUsername,
        user_is_verified: userData?.isVerified || false,
        user_is_verified_binary: userData?.isVerified ? 1 : 0,
        user_follower_count: userData?.followerCount || 0,
        user_followee_count: userData?.followeeCount || 0,
        user_mutual_follower_count: userData?.mutualFollowersV2?.totalCount || 0,
        user_mutual_followers_binary: userData?.mutualFollowersV2?.totalCount > 0 ? 1 : 0,
        user_visibility: userData?.visibility || 'PUBLIC',
        user_visible_public: userData?.visibility === 'PUBLIC' ? 1 : 0,
        user_weekly_rank: userData?.weeklyLeaderboardStanding?.rank,
        user_weekly_value: userData?.weeklyLeaderboardStanding?.value || 0,
        user_weekly_rank_is_top100: userData?.weeklyLeaderboardStanding?.rank <= 100 ? 1 : 0,
        user_best_rank: userData?.bestEverStanding?.rank,
        user_best_rank_value: userData?.bestEverStanding?.value || 0,
        user_best_rank_is_top100: userData?.bestEverStanding?.rank <= 100 ? 1 : 0,
        user_top_three_pnl_win_total: userData?.topThreePnlWin?.reduce((a, b) => a + b, 0) || 0,
        user_top_three_pnl_loss_total: userData?.topThreePnlLoss?.reduce((a, b) => a + b, 0) || 0,
        user_top_three_volume_total: userData?.topThreeVolume?.reduce((a, b) => a + b, 0) || 0,
        user_daily_pnl: userData?.profileLeaderboardValues?.daily?.pnl || 0,
        user_daily_volume: userData?.profileLeaderboardValues?.daily?.volume || 0,
        user_weekly_pnl: userData?.profileLeaderboardValues?.weekly?.pnl || 0,
        user_weekly_volume: userData?.profileLeaderboardValues?.weekly?.volume || 0,
        user_subscriber_count: userData?.subscriberCountV2 || 0,
        user_has_subscribers: userData?.subscriberCountV2 > 0 ? 1 : 0,
        user_followed_by_you: userData?.followedByProfile || false,
        user_followed_by_you_binary: userData?.followedByProfile ? 1 : 0,
        user_subscribed_by_you: userData?.subscribedByProfileV2 || false,
        user_subscribed_by_you_binary: userData?.subscribedByProfileV2 ? 1 : 0,
        user_has_twitter: userData?.twitterUsername ? 1 : 0,
        buy_token_name: buyTokenData?.name || '',
        buy_token_symbol: buyTokenData?.symbol || '',
        buy_token_price: buyTokenData?.price || '0',
        buy_token_supply: buyTokenData?.supply || '0',
        buy_token_chain: buyTokenData?.chain || '',
        buy_token_liquidity: buyTokenData?.liquidity || '0',
        buy_token_has_liquidity: buyTokenData?.liquidity && parseFloat(buyTokenData.liquidity) > 0 ? 1 : 0,
        buy_token_volume24h: buyTokenData?.volume24h || '0',
        buy_token_volume6h: buyTokenData?.volume6h || '0',
        buy_token_volume1h: buyTokenData?.volume1h || '0',
        buy_token_volume5min: buyTokenData?.volume5min || '0',
        buy_token_buyVolume24h: buyTokenData?.buyVolume24h || '0',
        buy_token_sellVolume24h: buyTokenData?.sellVolume24h || '0',
        buy_token_buyVolume6h: buyTokenData?.buyVolume6h || '0',
        buy_token_sellVolume6h: buyTokenData?.sellVolume6h || '0',
        buy_token_buyVolume1h: buyTokenData?.buyVolume1h || '0',
        buy_token_sellVolume1h: buyTokenData?.sellVolume1h || '0',
        buy_token_buyVolume5min: buyTokenData?.buyVolume5min || '0',
        buy_token_sellVolume5min: buyTokenData?.sellVolume5min || '0',
        buy_token_buyCount24h: buyTokenData?.buyCount24h || 0,
        buy_token_sellCount24h: buyTokenData?.sellCount24h || 0,
        buy_token_buyCount6h: buyTokenData?.buyCount6h || 0,
        buy_token_sellCount6h: buyTokenData?.sellCount6h || 0,
        buy_token_buyCount1h: buyTokenData?.buyCount1h || 0,
        buy_token_sellCount1h: buyTokenData?.sellCount1h || 0,
        buy_token_buyCount5min: buyTokenData?.buyCount5min || 0,
        buy_token_sellCount5min: buyTokenData?.sellCount5min || 0,
        buy_token_verified: buyTokenData?.verified || false,
        buy_token_is_verified: buyTokenData?.verified ? 1 : 0,
        buy_token_jupVerified: buyTokenData?.jupVerified || false,
        buy_token_is_jupVerified: buyTokenData?.jupVerified ? 1 : 0,
        buy_token_freezable: buyTokenData?.freezable || false,
        buy_token_is_freezable: buyTokenData?.freezable ? 1 : 0,
        buy_token_twitter: buyTokenData?.twitter || '',
        buy_token_has_twitter: buyTokenData?.twitter ? 1 : 0,
        buy_token_telegram: buyTokenData?.telegram || '',
        buy_token_has_telegram: buyTokenData?.telegram ? 1 : 0,
        buy_token_website: buyTokenData?.website || '',
        buy_token_has_website: buyTokenData?.website ? 1 : 0,
        buy_token_discord: buyTokenData?.discord || '',
        buy_token_has_discord: buyTokenData?.discord ? 1 : 0,
        buy_token_top10HolderPercent: buyTokenData?.top10HolderPercent || '0',
        buy_token_top10HolderPercentV2: buyTokenData?.top10HolderPercentV2 || '0',
        price_30s_variance: null,
        price_1m_variance: null,
        price_5m_variance: null,
        won_30s: null,
        won_1m: null,
        won_5m: null
    };

    // Store in CSV
    broadcastDataDict[broadcastId] = rowData;
    await rewriteCsv();

    // Store in Postgres
    try {
        const postgresProvider = runtime.providers.find(p => p instanceof PostgresProvider);
        if (postgresProvider) {
            const db = postgresProvider as PostgresDatabaseAdapter;

            await db.query(`
                INSERT INTO broadcasts (
                    id,
                    broadcast_id,
                    user_id,
                    user_username,
                    buy_token_id,
                    buy_token_amount,
                    buy_token_price,
                    buy_token_mcap,
                    sell_token_id,
                    sell_token_amount,
                    sell_token_price,
                    sell_token_mcap,
                    buy_token_name,
                    buy_token_symbol,
                    buy_token_chain,
                    buy_token_liquidity,
                    buy_token_volume24h,
                    buy_token_verified,
                    user_is_verified,
                    user_follower_count,
                    raw_data
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
                )
                ON CONFLICT (id) DO UPDATE SET
                    buy_token_price = EXCLUDED.buy_token_price,
                    buy_token_mcap = EXCLUDED.buy_token_mcap,
                    buy_token_volume24h = EXCLUDED.buy_token_volume24h,
                    raw_data = EXCLUDED.raw_data
            `, [
                randomUUID(),
                broadcastId,
                broadcast.profile.id,
                broadcast.profile.username,
                broadcast.buyTokenId,
                parseFloat(broadcast.buyTokenAmount),
                parseFloat(broadcast.buyTokenPrice),
                parseFloat(broadcast.buyTokenMCap),
                broadcast.sellTokenId,
                parseFloat(broadcast.sellTokenAmount),
                parseFloat(broadcast.sellTokenPrice),
                parseFloat(broadcast.sellTokenMCap),
                buyTokenData?.name || '',
                buyTokenData?.symbol || '',
                buyTokenData?.chain || '',
                buyTokenData?.liquidity ? parseFloat(buyTokenData.liquidity) : null,
                buyTokenData?.volume24h ? parseFloat(buyTokenData.volume24h) : null,
                buyTokenData?.verified || false,
                userData?.isVerified || false,
                userData?.followerCount || 0,
                JSON.stringify({
                    broadcast,
                    buyTokenData,
                    userData
                })
            ]);
        }
    } catch (error) {
        console.error('Error storing broadcast in database:', error);
    }

    // Send Discord alert
    const message = {
        id: randomUUID(),
        content: {
            text: `🎯 New Broadcast Detected
Token: ${buyTokenData?.symbol || broadcast.buyTokenId}
Price: ${broadcast.buyTokenPrice}
MCap: ${broadcast.buyTokenMCap}
Amount: ${broadcast.buyTokenAmount}
Liquidity: ${buyTokenData?.liquidity || 'N/A'}
Volume 24h: ${buyTokenData?.volume24h || 'N/A'}
User: ${broadcast.profile.username}
Verified: ${userData?.isVerified ? '✅' : '❌'}
Followers: ${userData?.followerCount || 0}`,
            channelName: 'broadcast-alerts'
        },
        roomId: randomUUID(),
        userId: randomUUID(),
        agentId: runtime.agentId || randomUUID(),
        createdAt: Date.now()
    };

    await runtime.messageManager.createMemory(message);

    // Schedule price variance updates
    await scheduleUpdates(
        runtime,
        broadcastId,
        broadcast.buyTokenId,
        parseFloat(broadcast.buyTokenPrice)
    );
}

export const enhancedBroadcastTrackerAction: Action = {
    name: "ENHANCED_TRACK_BROADCAST",
    similes: ["MONITOR_BROADCAST_ENHANCED", "ANALYZE_BROADCAST_ENHANCED"],
    description: "Enhanced tracking and analysis of token broadcasts with price variance monitoring and Discord integration",
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const content = message.content as { text: string };
        return /\b(broadcast|token|price|trade)\b/i.test(content.text);
    },
    examples: [
        [
            { user: "user1", content: { text: "Track new token broadcasts with enhanced monitoring" } },
            { user: "assistant", content: { text: "Starting enhanced broadcast tracking", action: "ENHANCED_TRACK_BROADCAST" } }
        ]
    ],
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            initializeCsv();

            // Create initial status message
            const statusMemory: Memory = {
                id: randomUUID(),
                content: {
                    text: "🚀 Enhanced Broadcast monitoring started! Tracking new broadcasts with price movements and detailed analytics...",
                    channelName: 'broadcast-alerts'
                },
                roomId: randomUUID(),
                userId: randomUUID(),
                agentId: runtime.agentId || randomUUID(),
                createdAt: Date.now()
            };

            await runtime.messageManager.createMemory(statusMemory);

            while (true) {
                const broadcasts = await fetchBroadcasts();

                for (const edge of broadcasts) {
                    const broadcast = edge?.node?.broadcast;
                    if (!broadcast) continue;

                    const buyTokenData = await fetchTokenData(broadcast.buyTokenId);
                    await processBroadcast(runtime, broadcast, buyTokenData);
                }

                // Wait for 1 second before next iteration
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return true;
        } catch (error) {
            console.error('Error in enhanced broadcast tracker:', error);
            return false;
        }
    }
};

export default enhancedBroadcastTrackerAction;