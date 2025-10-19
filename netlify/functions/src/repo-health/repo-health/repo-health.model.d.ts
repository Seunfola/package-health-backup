import { Document } from 'mongoose';
export declare class OverallHealth {
    score: number;
    label: string;
}
export declare const OverallHealthSchema: import("mongoose").Schema<OverallHealth, import("mongoose").Model<OverallHealth, any, any, any, Document<unknown, any, OverallHealth, any, {}> & OverallHealth & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, OverallHealth, Document<unknown, {}, import("mongoose").FlatRecord<OverallHealth>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<OverallHealth> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
export declare class RepoHealth extends Document {
    repo_id: string;
    owner: string;
    repo: string;
    name: string;
    stars: number;
    forks: number;
    open_issues: number;
    last_pushed: Date;
    overall_health: OverallHealth;
    commit_activity: number[];
    security_alerts: number;
    dependency_health: number;
    risky_dependencies: string[];
    createdAt: Date;
}
export declare const RepoHealthSchema: import("mongoose").Schema<RepoHealth, import("mongoose").Model<RepoHealth, any, any, any, Document<unknown, any, RepoHealth, any, {}> & RepoHealth & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RepoHealth, Document<unknown, {}, import("mongoose").FlatRecord<RepoHealth>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<RepoHealth> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export type RepoHealthDocument = RepoHealth & Document;
