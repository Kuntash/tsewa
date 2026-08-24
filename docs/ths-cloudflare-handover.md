# THS Cloudflare ownership handover

`ths.kunga.dev` is currently a dedicated installation operated in Kunga's Cloudflare account. The
target state is a THS-owned Cloudflare account and a THS-owned application hostname running the
same upstream Tsewa release.

## Ownership boundary

THS should hold the account-owner access, domain zone, billing method, Worker, D1 database, R2
bucket, email sender, authentication secret, backup destination, and recovery codes. Kunga may be
added as a limited technical administrator for setup and upgrades without remaining the owner.

## Cutover runbook

1. Create the THS Cloudflare account, enable MFA, store recovery codes, and add a second THS owner.
2. Add a THS-owned domain to that account and verify the transactional sender.
3. Deploy the same Tsewa commit using the one-click template and THS configuration.
4. Put the old installation into a short maintenance window so no writes occur during transfer.
5. Export the source D1 database and import it into the new THS D1 database.
6. Sync all R2 objects, then reconcile object count, total bytes, and hashes against the source.
7. Set `BETTER_AUTH_SECRET`. Reusing the existing value preserves session cryptography when it is
   available securely; otherwise set a new value and require everyone to sign in again.
8. Deploy, test login, invitations, recovery, people profiles, documents, school lists, and reports.
9. Point the THS-owned hostname to the new Worker and monitor errors and email delivery.
10. Keep the old deployment read-only during an agreed rollback window, then remove its sensitive
    data only after THS signs off and an independent backup has been verified.

The `kunga.dev` zone itself should not be moved to THS. The final installation should use a domain
or delegated zone controlled by THS; `ths.kunga.dev` can then redirect during a transition period.
