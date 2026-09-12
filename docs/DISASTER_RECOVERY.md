# Disaster Recovery Runbook — Smart Attendance System

Remediation Plan item #15. Covers backup verification and what to actually do
if data is lost, so that question isn't being answered for the first time
during an incident.

Scope: the backend's MongoDB database (`attendance_db` by default) and,
optionally, Azure Blob Storage (enrollment photo hosting only — losing it is
inconvenient, not catastrophic; see below).

---

## 1. Backups — what to verify, before you need them

**MongoDB Atlas:**

- Automated continuous/cloud backups are **on by default on paid (M10+)
  tiers**. They are **not guaranteed on the free M0 tier** — free-tier
  clusters may have no automated backup at all, or a much thinner snapshot
  policy depending on current Atlas offerings.
- Action: log into Atlas → the cluster → **Backup** tab, and confirm:
  - Backup is enabled.
  - The snapshot frequency and retention window (know your actual RPO —
    "how much data could we lose" — before an incident, not during one).
  - You know how to trigger an on-demand snapshot and how to restore one
    (Atlas supports point-in-time restore on eligible tiers — confirm this
    cluster is one of them).
- If you are on the free tier: either upgrade before this system holds data
  anyone cares about, or accept explicitly that backup is your own
  responsibility (see "Manual backup option" below) — don't assume backups
  exist without checking.

**Azure Blob Storage (optional, enrollment photos only):**

- Confirm whether the storage account has soft-delete / versioning enabled
  (Azure Portal → Storage Account → Data protection). This protects against
  accidental overwrite/delete of a person's enrollment photo, not against
  full account loss.
- Photos here are a convenience (shown in the UI), not the source of truth
  for recognition — the face embeddings that actually power identification
  live in MongoDB's `face_encodings` collection, not in Blob Storage. Losing
  Blob Storage does **not** break attendance marking; it just means
  enrollment photos no longer display in the UI until people are re-enrolled
  with new photos.

**Manual backup option (if not relying solely on Atlas):**

```bash
# Full logical dump of the database — run on a schedule (cron/GitHub Action)
# and store the output somewhere durable (S3/Blob/off-site), not just locally.
mongodump --uri="$MONGODB_URL" --db=attendance_db --out=./backup-$(date +%F)

# Restore from a dump:
mongorestore --uri="$MONGODB_URL" --db=attendance_db ./backup-2026-01-01/attendance_db
```

---

## 2. What happens if each collection is lost

| Collection        | What it holds                              | If lost, today's answer is:                                                                                     | Recoverable from Atlas backup? |
|-------------------|---------------------------------------------|--------------------------------------------------------------------------------------------------------------|---------------------------------|
| `persons`         | Enrolled people's name/email/department    | Attendance history in `attendance` becomes orphaned (references `person_id`s that no longer resolve to a name). Nobody can be identified until re-enrolled. | Yes, if backups are enabled     |
| `face_encodings`  | Face embeddings used for recognition        | **Everyone must re-enroll.** There is no way to regenerate embeddings without new photos + a re-run through InsightFace — this is not recoverable from the `persons` collection alone. | Yes, if backups are enabled     |
| `sessions`        | Attendance session records (label, times)  | Historical session labels are lost; attendance records referencing a missing `session_id` can no longer be displayed with a readable session name. | Yes, if backups are enabled     |
| `attendance`      | Who was marked present, when, at what confidence | Attendance history for the affected period is gone — this is the actual audit trail and cannot be reconstructed after the fact. | Yes, if backups are enabled     |

**The one that matters most operationally: `face_encodings`.** If this
collection is lost and there is no backup, there is no shortcut — every
enrolled person needs to physically re-enroll with new photos. This is
worth explicitly telling stakeholders *before* an incident, not during one:
"can we just restore people from the `persons` list?" — no, not without
their face data.

---

## 3. Recovery steps by scenario

### Scenario A: Whole cluster/database lost or corrupted, Atlas backup exists

1. In Atlas, restore the most recent snapshot to a **new** cluster (don't
   restore over a still-partially-working cluster in place — investigate
   first, restore to a clone, verify, then cut over).
2. Update `MONGODB_URL` in the backend's environment (Render/Azure secret
   config) to point at the restored cluster.
3. Redeploy the backend so it picks up the new connection string and
   re-runs `init_db()` (recreates indexes if the restore predates an index
   change — see `core/database.py::init_db`).
4. Spot-check: hit `GET /api/persons/debug-encodings` (admin key required)
   to confirm `persons_missing_encodings` is 0 and enrolled counts match
   expectations.
5. Communicate the restore point ("data current as of <snapshot time>") to
   whoever needs to know an attendance-taking gap may exist.

### Scenario B: `face_encodings` collection specifically lost/corrupted, no backup

1. Confirm the loss: `GET /api/persons/debug-encodings` will show all (or
   most) active persons under `persons_missing_encodings`.
2. There is no data-recovery path here (see above) — the path forward is
   re-enrollment:
   a. Do **not** delete the `persons` documents — keep names/departments so
      re-enrollment can reuse existing metadata rather than starting from
      zero.
   b. Communicate to all affected people that they need to re-submit
      enrollment photos.
   c. Re-run `POST /api/persons/enroll` per person (this generates a new
      `face_encodings` document and a new `azure_person_id` — the old
      `persons._id` and the new face-encoding ID are different UUIDs, so
      this is effectively a fresh enrollment even though the person's name
      record is preserved).
3. Going forward: treat this as the trigger to actually turn on Atlas
   backups (see Section 1) if they weren't already on.

### Scenario C: Backend service down, database is fine

This isn't a data-recovery scenario — it's a deploy/infra issue. Check
Render/Azure App Service logs first (the `X-Request-ID` correlation added in
Phase 1 makes it possible to trace a specific failing request through logs).
No data action needed; redeploy or roll back the backend service.

---

## 4. What this runbook does NOT cover

- Point-in-time recovery mechanics specific to whichever Atlas tier is
  actually in use — check current Atlas documentation for the account's
  tier, since backup/restore capabilities differ between free, dedicated,
  and serverless tiers and change over time.
- Multi-region failover — this is a single-region deployment; true
  high-availability failover is out of scope until traffic/uptime
  requirements justify the added complexity (see Remediation Plan item #13
  for the parallel "don't over-engineer before you see the need" reasoning
  applied to the embedding store).
