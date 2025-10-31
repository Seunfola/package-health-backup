// @ts-ignore: Cannot find module 
import { RepoHealthService } from "../src/repo-health.service";

export function startBackgroundRunner(service: RepoHealthService) {
  const trackedRepos = [
    'vercel/next.js',
    'facebook/react',
  ];

  trackedRepos.forEach((fullRepo) => {
    const [owner, repo] = fullRepo.split('/');
    setInterval(
      async () => {
        try {
          await service.analyzeRepo(owner, repo);
          console.log(`Auto-analysis completed: ${fullRepo}`);
        } catch (err) {
          console.warn(`Auto-analysis failed: ${fullRepo}`, err);
        }
      },
      5 * 60 * 1000,
    );
  });
}
