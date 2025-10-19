declare const GitHubStrategy_base: new (...args: any) => any;
export declare class GitHubStrategy extends GitHubStrategy_base {
    constructor();
    validate(accessToken: string, refreshToken: string, profile: Record<string, unknown>): {
        githubId: string;
        username: string;
        accessToken: string;
    };
}
export {};
