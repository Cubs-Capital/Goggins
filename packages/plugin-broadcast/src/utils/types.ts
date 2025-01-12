export interface FeedResponse {
    feedV3: {
        edges: Array<{
            cursor: string;
            node: {
                broadcast: {
                    id: string;
                    buyTokenId: string;
                    buyTokenAmount: string;
                    buyTokenPrice: string;
                    buyTokenMCap: string;
                    sellTokenId: string;
                    sellTokenAmount: string;
                    sellTokenPrice: string;
                    sellTokenMCap: string;
                    createdAt: number;
                    profile: {
                        id: string;
                        username: string;
                    };
                };
            };
        }>;
        pageInfo: {
            endCursor: string;
            hasNextPage: boolean;
        };
    };
}

export interface ProfileResponse {
    profile: {
        twitterUsername: string | null;
        visibility: string;
        isVerified: boolean;
        followerCount: number;
        followeeCount: number;
        mutualFollowersV2: {
            totalCount: number;
        };
        weeklyLeaderboardStanding: {
            rank: number;
            value: number;
        } | null;
        subscriberCountV2: number;
    };
}

export interface TokenResponse {
    data?: {
        price: string;
        token?: {
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
        };
    };
}