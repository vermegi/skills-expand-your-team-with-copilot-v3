import hashlib

from fastapi import HTTPException
import pytest


@pytest.mark.parametrize("password", ["", "test-password", "p\u00e4ssword"])
def test_login_hash_matches_sha256(modules, password):
    assert modules.auth.hash_password(password) == hashlib.sha256(
        password.encode()
    ).hexdigest()


@pytest.mark.parametrize("action", ["login", "check_session"])
@pytest.mark.parametrize("role", ["teacher", "admin"])
def test_auth_returns_only_public_fields(modules, database, teacher, action, role):
    database.teachers_collection.update_one(
        {"_id": teacher["_id"]}, {"$set": {"role": role}}
    )
    args = [teacher["username"]]
    if action == "login":
        args.append("test-password")
    assert getattr(modules.auth, action)(*args) == {
        "username": teacher["username"],
        "display_name": teacher["display_name"],
        "role": role,
    }


@pytest.mark.parametrize(
    ("username", "password"),
    [
        ("unknown", "test-password"),
        ("test-teacher", "wrong-password"),
        ("test-teacher", ""),
    ],
)
def test_invalid_login(modules, teacher, username, password):
    with pytest.raises(HTTPException) as error:
        modules.auth.login(username, password)
    assert error.value.status_code == 401
    assert error.value.detail == "Invalid username or password"


def test_missing_session(modules, database):
    with pytest.raises(HTTPException) as error:
        modules.auth.check_session("unknown")
    assert error.value.status_code == 404
    assert error.value.detail == "Teacher not found"


@pytest.mark.xfail(
    strict=True,
    raises=AssertionError,
    reason="Existing v3 defect: seeding hashes with Argon2 but login compares SHA-256.",
)
def test_seeded_teacher_can_login(client, database):
    database.init_database()
    response = client.post(
        "/auth/login", params={"username": "mchen", "password": "chess456"}
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "username": "mchen",
        "display_name": "Mr. Chen",
        "role": "teacher",
    }
