from copy import deepcopy

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import pytest


def test_password_hash_is_salted_and_verifiable(modules):
    first = modules.database.hash_password("test-password")
    second = modules.database.hash_password("test-password")
    assert first != second
    assert PasswordHasher().verify(first, "test-password")
    assert PasswordHasher().verify(second, "test-password")
    with pytest.raises(VerifyMismatchError):
        PasswordHasher().verify(first, "wrong-password")


def test_initialization_seeds_exact_documents(database):
    original_activities = deepcopy(database.initial_activities)
    original_teachers = deepcopy(database.initial_teachers)

    database.init_database()

    assert {
        doc["_id"]: {key: value for key, value in doc.items() if key != "_id"}
        for doc in database.activities_collection.find()
    } == original_activities
    assert list(database.teachers_collection.find()) == [
        {"_id": teacher["username"], **teacher} for teacher in original_teachers
    ]
    assert database.initial_activities == original_activities
    assert database.initial_teachers == original_teachers
    for teacher, password in zip(original_teachers, ["art123", "chess456", "admin789"]):
        assert PasswordHasher().verify(teacher["password"], password)


def test_initialization_is_idempotent_and_preserves_changes(database):
    database.init_database()
    database.activities_collection.update_one(
        {"_id": "Chess Club"}, {"$push": {"participants": "new@example.edu"}}
    )
    database.teachers_collection.update_one(
        {"_id": "mchen"}, {"$set": {"display_name": "Updated Name"}}
    )
    before = (
        list(database.activities_collection.find()),
        list(database.teachers_collection.find()),
    )

    database.init_database()

    assert list(database.activities_collection.find()) == before[0]
    assert list(database.teachers_collection.find()) == before[1]


@pytest.mark.parametrize("populated", ["activities", "teachers"])
def test_each_collection_is_initialized_independently(database, populated):
    collection = getattr(database, f"{populated}_collection")
    collection.insert_one({"_id": "custom", "value": "keep"})

    database.init_database()

    assert list(collection.find()) == [{"_id": "custom", "value": "keep"}]
    other = "teachers" if populated == "activities" else "activities"
    expected = database.initial_teachers if other == "teachers" else database.initial_activities
    assert getattr(database, f"{other}_collection").count_documents({}) == len(expected)
