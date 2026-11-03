#!/usr/bin/env python3
"""Prepare a nonproduction Jekyll preview from the allowlisted repository source.

This deliberately does not call the protected develop/main deployment verifier.
No credential-bearing content or local build outputs may enter the staging tree.
"""
import hashlib, json, os, pathlib, re, shutil, subprocess, sys

ROOT=pathlib.Path(__file__).resolve().parents[2]
branch=os.environ.get("WORKERS_CI_BRANCH") or os.environ.get("JEKYLL_DEPLOY_BRANCH") or ""
if not branch or branch in ("main","develop"):
    sys.exit("PR preview requires an explicit nonproduction branch")
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,180}",branch) or ".." in branch or branch.endswith("/"):
    sys.exit("Invalid preview branch")
if os.environ.get("WORKERS_CI_BRANCH") and os.environ.get("JEKYLL_DEPLOY_BRANCH") and os.environ["WORKERS_CI_BRANCH"]!=os.environ["JEKYLL_DEPLOY_BRANCH"]:
    sys.exit("Conflicting Cloudflare and local branch identity")
sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
assert re.fullmatch(r"[a-f0-9]{40}",sha)
reported=os.environ.get("WORKERS_CI_COMMIT_SHA")
if reported and reported!=sha: sys.exit("Cloudflare SHA differs from checked-out SHA")
entries=json.loads((ROOT/"nightjar/source-files.json").read_text())
assert len(entries)==len(set(entries)) and entries
out=ROOT/".cloudflare-source"
site=ROOT/".cloudflare-site"
if out.exists() or site.exists(): sys.exit("Refusing to reuse an old preview build")
for name in entries:
    p=pathlib.PurePosixPath(name)
    if p.is_absolute() or ".." in p.parts or str(p)!=name: sys.exit("Unsafe source path")
    src=ROOT
    for component in p.parts:
        src=src/component
        if src.is_symlink(): sys.exit("Symlink in source allowlist")
    if not src.is_file(): sys.exit("Missing source allowlist entry")
    dst=out/name
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(src,dst)
(ROOT/".cloudflare-render.yml").write_text("source_archive: false\n")
slug=re.sub(r"[^a-z0-9-]+","-",branch.lower()).strip("-")[:24].strip("-")
tag=hashlib.sha256(branch.encode()).hexdigest()[:10]
name="pr-"+slug+"-"+tag
assert re.fullmatch(r"pr-[a-z0-9-]{1,40}",name)
(ROOT/".cloudflare-pr-name").write_text(name+"\n")
(ROOT/".cloudflare-pr-source.json").write_text(json.dumps({"sourceCommit":sha,"branch":branch,"previewName":name},sort_keys=True)+"\n")
print("PR_PREVIEW_BUILD branch="+branch+" commit="+sha+" preview="+name)
