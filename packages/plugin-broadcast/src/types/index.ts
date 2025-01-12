 // Basic interfaces
export interface PageInfo {
    endCursor: string;
    hasNextPage: boolean;
}

export interface Profile {
    id: string;
    username: string;
}

// Broadcast related interfaces
export interface Broadcast {
    id: string;
    buyTokenId: string;
    buyTokenAmount: string;
    buyTokenPrice: string;
    buyTokenMCap: string;
    sellTokenId: string;
    sellTokenAmount: string;
    sellTokenPrice: string;
    sellTokenMCap: string;
    createdAt: string;
    profile: Profile;
}

export interface Token {
    id: string;
    name: string;
    symbol: string;
    price: string;
    supply: string;
    chain: string;
    decimals: number;
}
// TokenResponse needs to contain price as a string

export interface TokenResponse {
    token: Token;
    price: string;
    data: {
        token: Token;
    };
}

export interface BroadcastNode {
    broadcast: Broadcast;
    buyToken: Token;
    sellToken: Token;
}

export interface FeedEdge {
    cursor: string;
    node: BroadcastNode;
}

export interface FeedResponse {
    feedV3: {
        edges: FeedEdge[];
        pageInfo: PageInfo;
    };
}

// Leaderboard related interfaces
export interface LeaderboardStanding {
    rank: number;
    value: number;
    leaderboardDate?: string;
}

export interface LeaderboardValues {
    pnl: number;
    volume: number;
    maxTradeSize: number;
}

export interface ProfileLeaderboardValues {
    daily: LeaderboardValues;
    weekly: LeaderboardValues;
}

// User related interfaces
export interface UserProfile {
    id: string;
    username: string;
    twitterUsername: string;
    visibility: string;
    profileImageUrl: string;
    isVerified: boolean;
    followerCount: number;
    followeeCount: number;
    mutualFollowersV2: {
        totalCount: number;
    };
    weeklyLeaderboardStanding: LeaderboardStanding;
    bestEverStanding: LeaderboardStanding;
    topThreePnlWin: number;
    topThreePnlLoss: number;
    topThreeVolume: number;
    profileLeaderboardValues: ProfileLeaderboardValues;
    subscribedByProfileV2: boolean;
    subscriberCountV2: number;
    followedByProfile: boolean;
}

// Token related interfaces
export interface TokenData {
    image: string;
    chain: string;
    id: string;
    address: string;
    decimals: number;
    name: string;
    symbol: string;
    price: string;
    supply: string;
    verified: boolean;
    jupVerified: boolean;
    mintAuthority: string;
    freezable: boolean;
    liquidity: string;
    exchPumpFun: boolean;
    exchMoonshot: boolean;
    exchRaydium: boolean;
    exchMeteora: boolean;
    volume24h: string;
    volume6h: string;
    volume1h: string;
    volume5min: string;
    volumeLastUpdated: string;
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
    twitter: string;
    telegram: string;
    website: string;
    discord: string;
    top10HolderPercent: number;
    top10HolderPercentV2: number;
}

// Broadcast data interface
export interface BroadcastData {
    broadcast_id: string;
    created_at: string;
    buy_token_id: string;
    buy_token_amount: string;
    buy_token_price: string;
    buy_token_mcap: string;
    sell_token_id: string;
    sell_token_amount: string;
    sell_token_price: string;
    sell_token_mcap: string;
    profile_id: string;
    profile_username: string;



    // ... rest of the BroadcastData interface
}