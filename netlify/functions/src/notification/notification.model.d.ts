import { Schema } from 'mongoose';
export declare const NotificationSchema: Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    type: "SECURITY_VULNERABILITY" | "DEPENDENCY_UPDATE" | "NEW_ISSUE" | "PULL_REQUEST" | "SYSTEM_ALERT";
    title: string;
    read: boolean;
    repository: string;
    repositoryUrl: string;
    priority: "critical" | "high" | "low" | "medium";
    description?: string | null | undefined;
    detailsUrl?: string | null | undefined;
    metadata?: any;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    type: "SECURITY_VULNERABILITY" | "DEPENDENCY_UPDATE" | "NEW_ISSUE" | "PULL_REQUEST" | "SYSTEM_ALERT";
    title: string;
    read: boolean;
    repository: string;
    repositoryUrl: string;
    priority: "critical" | "high" | "low" | "medium";
    description?: string | null | undefined;
    detailsUrl?: string | null | undefined;
    metadata?: any;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").ResolveSchemaOptions<{
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    type: "SECURITY_VULNERABILITY" | "DEPENDENCY_UPDATE" | "NEW_ISSUE" | "PULL_REQUEST" | "SYSTEM_ALERT";
    title: string;
    read: boolean;
    repository: string;
    repositoryUrl: string;
    priority: "critical" | "high" | "low" | "medium";
    description?: string | null | undefined;
    detailsUrl?: string | null | undefined;
    metadata?: any;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
