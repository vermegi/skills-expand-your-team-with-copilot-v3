from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi import HTTPException
import pytest


@pytest.mark.parametrize(
    ("filters", "expected"),
    [
        ({}, {"Test Club", "Morning Club"}),
        ({"day": "Wednesday"}, {"Test Club"}),
        ({"day": "Sunday"}, set()),
        ({"start_time": "15:00"}, {"Test Club"}),
        ({"start_time": "15:01"}, set()),
        ({"end_time": "08:00"}, {"Morning Club"}),
        ({"end_time": "07:59"}, set()),
        ({"day": "Monday", "start_time": "15:00", "end_time": "17:00"}, {"Test Club"}),
        ({"day": "Monday", "start_time": "15:00", "end_time": "16:59"}, set()),
        ({"day": "", "start_time": "", "end_time": ""}, {"Test Club", "Morning Club"}),
    ],
)
def test_filters_use_inclusive_boundaries(modules, database, activity, filters, expected):
    morning = deepcopy(activity)
    morning.update(
        _id="Morning Club",
        schedule_details={
            "days": ["Monday", "Friday"],
            "start_time": "07:00",
            "end_time": "08:00",
        },
    )
    database.activities_collection.insert_one(morning)

    result = modules.activities.get_activities(**filters)

    assert set(result) == expected
    for name, details in result.items():
        original = database.activities_collection.find_one({"_id": name})
        assert details == {key: value for key, value in original.items() if key != "_id"}
    assert database.activities_collection.find_one({"_id": "Test Club"}) == activity


def test_empty_database_has_no_activities_or_days(modules, database):
    assert modules.activities.get_activities() == {}
    assert modules.activities.get_available_days() == []


def test_days_are_unique_and_alphabetically_sorted(modules, database, activity):
    database.activities_collection.insert_one(
        {"_id": "Second Club", "schedule_details": {"days": ["Monday", "Friday"]}}
    )
    assert modules.activities.get_available_days() == ["Friday", "Monday", "Wednesday"]


@pytest.mark.parametrize(
    ("action", "email", "operator", "message", "participants"),
    [
        (
            "signup_for_activity",
            "new@example.edu",
            "$push",
            "Signed up new@example.edu for Test Club",
            ["existing@example.edu", "new@example.edu"],
        ),
        (
            "unregister_from_activity",
            "existing@example.edu",
            "$pull",
            "Unregistered existing@example.edu from Test Club",
            [],
        ),
    ],
)
def test_participant_updates(
    modules, database, teacher, activity, monkeypatch,
    action, email, operator, message, participants,
):
    collection = database.activities_collection
    update = Mock(wraps=collection.update_one)
    monkeypatch.setattr(collection, "update_one", update)

    result = getattr(modules.activities, action)("Test Club", email, teacher["username"])

    assert result == {"message": message}
    update.assert_called_once_with(
        {"_id": "Test Club"}, {operator: {"participants": email}}
    )
    stored = collection.find_one({"_id": "Test Club"})
    assert stored == {**activity, "participants": participants}


@pytest.mark.parametrize("action", ["signup_for_activity", "unregister_from_activity"])
@pytest.mark.parametrize(
    ("username", "name", "email", "status", "detail"),
    [
        (None, "Test Club", "new@example.edu", 401, "Authentication required for this action"),
        ("", "Test Club", "new@example.edu", 401, "Authentication required for this action"),
        ("unknown", "Test Club", "new@example.edu", 401, "Invalid teacher credentials"),
        ("test-teacher", "Missing Club", "new@example.edu", 404, "Activity not found"),
    ],
)
def test_invalid_participant_requests_never_write(
    modules, database, teacher, activity, monkeypatch,
    action, username, name, email, status, detail,
):
    update = Mock()
    monkeypatch.setattr(database.activities_collection, "update_one", update)
    with pytest.raises(HTTPException) as error:
        getattr(modules.activities, action)(name, email, username)
    assert error.value.status_code == status
    assert error.value.detail == detail
    update.assert_not_called()
    assert database.activities_collection.find_one({"_id": "Test Club"}) == activity


@pytest.mark.parametrize(
    ("action", "email", "detail"),
    [
        ("signup_for_activity", "existing@example.edu", "Already signed up for this activity"),
        ("unregister_from_activity", "absent@example.edu", "Not registered for this activity"),
    ],
)
def test_invalid_membership_never_writes(
    modules, database, teacher, activity, monkeypatch, action, email, detail,
):
    update = Mock()
    monkeypatch.setattr(database.activities_collection, "update_one", update)
    with pytest.raises(HTTPException) as error:
        getattr(modules.activities, action)("Test Club", email, teacher["username"])
    assert error.value.status_code == 400
    assert error.value.detail == detail
    update.assert_not_called()


@pytest.mark.parametrize(
    ("action", "email"),
    [
        ("signup_for_activity", "new@example.edu"),
        ("unregister_from_activity", "existing@example.edu"),
    ],
)
def test_failed_database_update_is_reported(
    modules, database, teacher, activity, monkeypatch, action, email,
):
    update = Mock(return_value=SimpleNamespace(modified_count=0))
    monkeypatch.setattr(database.activities_collection, "update_one", update)
    with pytest.raises(HTTPException) as error:
        getattr(modules.activities, action)("Test Club", email, teacher["username"])
    assert error.value.status_code == 500
    assert error.value.detail == "Failed to update activity"
    update.assert_called_once()
