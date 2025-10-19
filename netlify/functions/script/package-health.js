"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockModel = void 0;
const yargs_1 = __importDefault(require("yargs"));
const fs = __importStar(require("fs"));
const helpers_1 = require("yargs/helpers");
const axios_1 = require("@nestjs/axios");
const repo_health_service_1 = require("../src/repo-health/repo-health/repo-health.service");
const axios_2 = __importDefault(require("axios"));
const dependency_analyzer_service_1 = require("../src/repo-health/repo-health/dependency-analyzer.service");
const createMockModel = () => {
    const mockDoc = {
        _id: 'mock-id',
        repo_id: 'mock/repo',
        owner: 'mock',
        repo: 'repo',
        name: 'mock-repo',
        stars: 0,
        forks: 0,
        open_issues: 0,
        last_pushed: new Date(),
        commit_activity: [],
        security_alerts: 0,
        dependency_health: 100,
        risky_dependencies: [],
        overall_health: { score: 100, label: 'Excellent' },
        toObject() {
            const { toObject, ...rest } = this;
            return { ...rest };
        },
    };
    const baseMock = {
        findOne: () => ({
            exec() {
                return Promise.resolve(null);
            },
            lean() {
                return this;
            },
        }),
        findOneAndUpdate: () => ({
            exec() {
                return Promise.resolve({ ...mockDoc });
            },
            lean() {
                return this;
            },
        }),
        find: () => ({
            exec() {
                return Promise.resolve([]);
            },
            lean() {
                return this;
            },
        }),
        create() {
            return Promise.resolve({ ...mockDoc });
        },
        updateOne() {
            return Promise.resolve({
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
            });
        },
        deleteOne() {
            return Promise.resolve({
                acknowledged: true,
                deletedCount: 0,
            });
        },
        countDocuments() {
            return Promise.resolve(0);
        },
    };
    return baseMock;
};
exports.createMockModel = createMockModel;
async function main() {
    try {
        const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
            .command('analyze <url>', 'Analyze a GitHub repository for health metrics', (y) => y.positional('url', {
            type: 'string',
            demandOption: true,
            describe: 'GitHub repository URL (e.g. https://github.com/user/repo)',
        }))
            .option('token', {
            type: 'string',
            describe: 'GitHub personal access token (for private repos)',
        })
            .strict()
            .help()
            .parseAsync();
        const { url, token } = argv;
        if (!url) {
            console.error('❌ Error: URL is required.');
            process.exit(1);
        }
        if (typeof url !== 'string') {
            console.error('❌ Error: URL must be a string.');
            process.exit(1);
        }
        const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!githubMatch) {
            console.error('❌ Error: Invalid GitHub URL format.');
            process.exit(1);
        }
        const [, owner, repo] = githubMatch;
        const mockModel = (0, exports.createMockModel)();
        const httpService = new axios_1.HttpService(axios_2.default);
        const dependencyAnalyzer = new dependency_analyzer_service_1.DependencyAnalyzerService();
        const repoHealthService = new repo_health_service_1.RepoHealthService(mockModel, httpService, dependencyAnalyzer);
        console.log(`🚀 Starting analysis for ${owner}/${repo} ...`);
        const result = await repoHealthService.analyzeRepo(owner, repo, undefined, undefined, token);
        fs.writeFileSync('health-report.json', JSON.stringify(result, null, 2));
        console.log('\n Analysis Result:\n');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    }
    catch (error) {
        console.error('\n Error:', error instanceof Error ? error.message : 'Unknown error occurred.');
        process.exit(1);
    }
}
void main();
//# sourceMappingURL=package-health.js.map