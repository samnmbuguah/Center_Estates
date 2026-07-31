import hashlib

UNIT_SEPARATOR = "\x1f"


def canonical_submission(*, milestone_id, project_id, percent_complete, submitted_at, evidence_hashes, observation_bodies):
    return "\n".join([
        f"milestone_id={milestone_id}", f"project_id={project_id}",
        f"percent_complete={percent_complete}", f"submitted_at={submitted_at}",
        "evidence_hashes=" + ",".join(sorted(evidence_hashes)),
        "observation_bodies=" + UNIT_SEPARATOR.join(sorted(observation_bodies)),
    ])


def compute_integrity_hash(**values):
    return hashlib.sha256(canonical_submission(**values).encode("utf-8")).hexdigest()
