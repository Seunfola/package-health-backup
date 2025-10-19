export interface GithubProfile {
    id: string;
    username: string;
    accessToken: string;
}
export declare class AuthService {
    validateUser(githubProfile: GithubProfile): {
        githubId: string;
        username: string;
        token: string;
    };
}
