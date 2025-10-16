import { RepoHealthService } from './repo-health/repo-health/repo-health.service';

export function startBackgroundRunner(service: RepoHealthService) {
  const trackedRepos = ['user/repo1', 'user/repo2']; // default or user-configured

  trackedRepos.forEach((fullRepo) => {
    const [owner, repo] = fullRepo.split('/');
    setInterval(
      () => {
        service
          .analyzeRepo(owner, repo)
          .then(() => {
            console.log(`✅ Auto-analysis completed: ${fullRepo}`);
          })
          .catch((err) => {
            console.warn(`⚠️ Auto-analysis failed: ${fullRepo}`, err);
          });
      },
      5 * 60 * 1000,
    ); // every 5 minutes
  });
}
