"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const repo_health_service_1 = require("../repo-health/repo-health/repo-health.service");
jest.mock('../src/repo-health/repo-health/repo-health.service');
describe('CLI Integration', () => {
    const cliPath = path_1.default.join(__dirname, '../src/cli.ts');
    const mockAnalyzeRepo = jest.fn();
    beforeAll(() => {
        repo_health_service_1.RepoHealthService.mockImplementation(() => ({
            analyzeRepo: mockAnalyzeRepo,
        }));
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    const runCLI = (args) => new Promise((resolve) => {
        (0, child_process_1.exec)(`ts-node ${cliPath} ${args.join(' ')}`, (error, stdout, stderr) => {
            resolve({ stdout, stderr });
        });
    });
    test('should error when URL is missing', async () => {
        const { stderr } = await runCLI(['analyze']);
        expect(stderr).toContain('URL is required');
    });
    test('should error when invalid GitHub URL is provided', async () => {
        const { stderr } = await runCLI(['analyze', 'invalid-url']);
        expect(stderr).toContain('Invalid GitHub URL');
    });
    test('should call analyzeRepo with owner/repo and token', async () => {
        mockAnalyzeRepo.mockResolvedValue({ overall_health: { score: 95 } });
        const { stdout } = await runCLI([
            'analyze',
            'https://github.com/testuser/testrepo',
            '--token=testtoken',
        ]);
        expect(mockAnalyzeRepo).toHaveBeenCalledWith('testuser', 'testrepo', undefined, undefined, 'testtoken');
        expect(stdout).toContain('Starting analysis for testuser/testrepo');
        expect(stdout).toContain('"score": 95');
    });
});
//# sourceMappingURL=cli.test.js.map