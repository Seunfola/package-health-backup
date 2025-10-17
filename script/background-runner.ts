import { RepoHealthService } from '../src/repo-health/repo-health/repo-health.service';

export function startBackgroundRunner(service: RepoHealthService) {
  const trackedRepos = ['user/repo1', 'user/repo2'];

  trackedRepos.forEach((fullRepo) => {
    const [owner, repo] = fullRepo.split('/');
    setInterval(
      () => {
        service
          .analyzeRepo(owner, repo)
          .then(() => {
            console.log(`Auto-analysis completed: ${fullRepo}`);
          })
          .catch((err) => {
            console.warn(`Auto-analysis failed: ${fullRepo}`, err);
          });
      },
      5 * 60 * 1000,
    );
  });
}
