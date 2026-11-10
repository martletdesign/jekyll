const {readFileSync} = require('node:fs');

// Accepted main is the publication boundary; immutable tags are never moved.
module.exports = async function release({github, context, core, version = readFileSync('VERSION', 'utf8').trim()}) {
  const run = context.payload.workflow_run;
  const {owner, repo} = context.repo;
  if (run?.conclusion !== 'success' || run.event !== 'push' || run.head_branch !== 'main' ||
      run.head_repository?.full_name !== `${owner}/${repo}` || !/^[a-f0-9]{40}$/.test(run.head_sha)) {
    throw new Error('Expected successful verification of this repository main');
  }
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version)) {
    throw new Error('Automatic stable release requires a canonical VERSION');
  }
  const identity = {owner, repo};
  const main = await github.rest.git.getRef({...identity, ref: 'heads/main'});
  if (main.data.object.sha !== run.head_sha) { core.info('Superseded main; skipping.'); return; }
  const tag = `v${version}`;
  let existing;
  try { existing = await github.rest.git.getRef({...identity, ref: `tags/${tag}`}); }
  catch (error) { if (error.status !== 404) throw error; }
  if (existing) {
    try {
      const published = await github.rest.repos.getReleaseByTag({...identity, tag});
      if (!published.data.draft) { core.info(`${tag} already released; skipping.`); return; }
      throw new Error('Existing draft release requires reconciliation');
    } catch (error) { if (error.status !== 404) throw error; }
  } else {
    await github.rest.git.createRef({...identity, ref: `refs/tags/${tag}`, sha: run.head_sha});
  }
  // Explicit dispatch runs even when the tag was created with GITHUB_TOKEN.
  // The existing release workflow rechecks protected tag identity and main ancestry.
  await github.rest.actions.createWorkflowDispatch({...identity, workflow_id: 'tag-release.yml', ref: tag});
  core.info(`Dispatched verified source release for ${tag}`);
};
