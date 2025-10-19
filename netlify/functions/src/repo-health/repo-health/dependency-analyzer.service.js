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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyAnalyzerService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let DependencyAnalyzerService = class DependencyAnalyzerService {
    async analyzeDependencies(deps, options) {
        const { useDocker = false } = options ?? {};
        for (const name of Object.keys(deps)) {
            if (!/^[a-zA-Z0-9._@/-]+$/.test(name)) {
                throw new common_1.HttpException(`Invalid dependency name: ${name}`, common_1.HttpStatus.BAD_REQUEST);
            }
        }
        const tempDir = path.join(os.tmpdir(), `audit-${Date.now()}`);
        let cleanupSuccessful = false;
        try {
            await fs.promises.mkdir(tempDir, { recursive: true });
            const pkgJson = {
                name: 'audit-temp',
                version: '1.0.0',
                private: true,
                dependencies: deps,
            };
            await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
            await this.safeExec('npm install --ignore-scripts --silent --no-audit --no-fund', tempDir, 120_000, useDocker);
            const outdated = await this.safeJsonExec('npm outdated --json', tempDir, 60_000, useDocker);
            const auditResult = await this.safeJsonExec('npm audit --json', tempDir, 60_000, useDocker);
            const vulnerabilities = this.extractVulnerabilities(auditResult);
            const risky = Object.keys(vulnerabilities);
            const outdatedList = this.extractOutdated(outdated);
            const { score, health } = this.calculateHealthScore(vulnerabilities, outdatedList);
            const unstable = this.detectUnstableDeps(deps);
            cleanupSuccessful = true;
            return {
                score,
                health,
                totalVulns: Object.keys(vulnerabilities).length,
                totalOutdated: outdatedList.length,
                risky,
                vulnerabilities,
                outdated: outdatedList,
                unstable,
            };
        }
        catch (error) {
            const message = typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof error.message === 'string'
                ? error.message
                : String(error);
            throw new common_1.HttpException(`Dependency analysis failed: ${message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        finally {
            if (!cleanupSuccessful) {
                await this.cleanupDirectory(tempDir);
            }
            else {
                setTimeout(() => {
                    this.cleanupDirectory(tempDir).catch(() => {
                        console.warn(`Failed to cleanup directory: ${tempDir}`);
                    });
                }, 5000);
            }
        }
    }
    async safeExec(command, cwd, timeout = 120_000, useDocker = false) {
        const wrapped = useDocker
            ? `docker run --rm -v ${cwd}:/app -w /app node:20-alpine sh -c "${command}"`
            : command;
        return execAsync(wrapped, {
            cwd,
            timeout,
            killSignal: 'SIGKILL',
        });
    }
    async safeJsonExec(command, cwd, timeout = 60_000, useDocker = false) {
        try {
            const { stdout } = await this.safeExec(command, cwd, timeout, useDocker);
            const parsed = JSON.parse(stdout || '{}');
            if (typeof parsed === 'object' &&
                parsed !== null &&
                !Array.isArray(parsed)) {
                return parsed;
            }
            return {};
        }
        catch {
            return {};
        }
    }
    extractVulnerabilities(auditJson) {
        const result = {};
        let vulns = {};
        if (auditJson && typeof auditJson === 'object') {
            if ('vulnerabilities' in auditJson &&
                typeof auditJson.vulnerabilities === 'object') {
                vulns = auditJson
                    .vulnerabilities;
            }
            else if ('advisories' in auditJson &&
                typeof auditJson.advisories === 'object') {
                vulns = auditJson
                    .advisories;
            }
        }
        for (const [pkg, data] of Object.entries(vulns)) {
            if (!data || typeof data !== 'object')
                continue;
            const via = Array.isArray(data.via)
                ? data.via
                    .map((v) => typeof v === 'string'
                    ? v
                    : typeof v === 'object' &&
                        v !== null &&
                        'title' in v &&
                        typeof v.title === 'string'
                        ? v.title
                        : '')
                    .filter((str) => Boolean(str))
                : [];
            const severity = typeof data.severity === 'string'
                ? data.severity
                : 'info';
            result[pkg] = { severity, via };
        }
        return result;
    }
    extractOutdated(outdatedJson) {
        const list = [];
        for (const [pkg, info] of Object.entries(outdatedJson)) {
            if (typeof info === 'object' && info !== null) {
                const current = typeof info.current === 'string'
                    ? info.current
                    : 'unknown';
                const latest = typeof info.latest === 'string'
                    ? info.latest
                    : 'unknown';
                list.push({ name: pkg, current, latest });
            }
        }
        return list;
    }
    calculateHealthScore(vulnerabilities, outdated) {
        const totalVulns = Object.keys(vulnerabilities).length;
        const totalOutdated = outdated.length;
        const score = Math.max(0, 100 - totalVulns * 5 - totalOutdated * 1.5);
        let health = 'Excellent';
        if (score < 80)
            health = 'Good';
        if (score < 60)
            health = 'Moderate';
        if (score < 40)
            health = 'Poor';
        return { score, health, totalVulns, totalOutdated };
    }
    detectUnstableDeps(deps) {
        return Object.entries(deps)
            .filter(([, version]) => /alpha|beta|rc|snapshot|next/i.test(version))
            .map(([pkg]) => pkg);
    }
    async cleanupDirectory(dir) {
        if (!fs.existsSync(dir))
            return;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await fs.promises.rm(dir, { recursive: true, force: true });
                console.log(`✅ Successfully cleaned up directory: ${dir}`);
                return;
            }
            catch (err) {
                const code = typeof err === 'object' && err !== null && 'code' in err
                    ? err.code
                    : undefined;
                const message = typeof err === 'object' && err !== null && 'message' in err
                    ? err.message
                    : String(err);
                if (code === 'EBUSY' || code === 'ENOTEMPTY') {
                    console.warn(`⚠️ Cleanup attempt ${attempt + 1} failed for ${dir}: ${message}`);
                    if (attempt < 2)
                        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
                }
                else if (typeof err === 'object' &&
                    err !== null &&
                    'code' in err &&
                    err.code === 'ENOENT') {
                    console.log(`Directory already deleted: ${dir}`);
                    return;
                }
                else {
                    const message = typeof err === 'object' && err !== null && 'message' in err
                        ? err.message
                        : String(err);
                    console.error(`Unexpected cleanup error for ${dir}:`, message);
                    break;
                }
            }
        }
        console.error(`Failed to cleanup directory after 3 attempts: ${dir}`);
    }
};
exports.DependencyAnalyzerService = DependencyAnalyzerService;
exports.DependencyAnalyzerService = DependencyAnalyzerService = __decorate([
    (0, common_1.Injectable)()
], DependencyAnalyzerService);
//# sourceMappingURL=dependency-analyzer.service.js.map