"""FR-08 · Enrollment lifecycle helpers.
Trigger in DB does the audit; this module exposes safe transitions."""
from __future__ import annotations
from ..db import q, exec_

VALID = ["counselled", "enrolled", "in_training", "certified", "placed", "dropped"]


def create_counselled(beneficiary_id: str, qualification_id: str,
                      centre_id: str | None, owner: str = "system") -> dict:
    return q(
        """
        insert into enrollments (beneficiary_id, qualification_id, centre_id, owner, state)
        values (%s::uuid, %s::uuid, %s::uuid, %s, 'counselled')
        returning *
        """,
        (beneficiary_id, qualification_id, centre_id, owner),
    )[0]


def transition(enrollment_id: str, to_state: str, actor: str, note: str = "") -> dict:
    if to_state not in VALID:
        raise ValueError(f"unknown state {to_state}")
    return q(
        "update enrollments set state=%s::enrollment_state, owner=%s where id=%s::uuid returning *",
        (to_state, actor, enrollment_id),
    )[0]


def stalled(district: str | None = None) -> list[dict]:
    if district:
        return q(
            """
            select se.*, b.home_district
              from stalled_enrollments se
              join beneficiaries b on b.id = se.beneficiary_id
             where b.home_district = %s and se.bucket <> 'watch'
             order by se.days_in_state desc
            """,
            (district,),
        )
    return q("select * from stalled_enrollments where bucket <> 'watch' order by days_in_state desc")
