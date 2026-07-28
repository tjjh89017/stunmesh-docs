---
id: contributing
title: Contribute
sidebar_position: 99
---

# Contribute

Contributions to stunmesh projects are welcome. Every pull request must pass two independent checks: the **DCO sign-off** on each commit, and the **CLA** signed once per contributor.

## DCO sign-off

Every commit needs a `Signed-off-by` line, added with the `-s` flag:

```bash
git commit -s -m "feat: add my change"
```

This certifies you have the right to submit the change under the project's license ([Developer Certificate of Origin](https://developercertificate.org/)).

## Contributor License Agreement (CLA)

All stunmesh repositories share a single CLA, maintained in [tjjh89017/stunmesh-cla](https://github.com/tjjh89017/stunmesh-cla). Read the agreement text at [CLA.md](https://github.com/tjjh89017/stunmesh-cla/blob/main/CLA.md).

Key points:

- You keep the copyright to your contributions — the CLA is a license, not a transfer of ownership.
- The maintainer may only relicense contributions under **OSI-approved open source licenses** (plus license exceptions such as app store distribution). Distributing your contributions solely under a proprietary license is not permitted.
- AI-assisted contributions are acceptable if you have reviewed the output and take responsibility for it as your own work. Contributions generated entirely without human review are not.

### How to sign

When you open your first pull request in any stunmesh repository, the CLA bot comments with instructions. Reply with the exact sign statement it shows, and the check turns green. **Signing once covers all stunmesh repositories**, past and future contributions included.

If the check does not update after signing, comment `recheck` on the pull request.

## Commit messages

Use the conventional commit format: `type: description` with types `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Keep the first line under 72 characters.
