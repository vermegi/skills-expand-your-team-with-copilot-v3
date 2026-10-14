import importlib
import os
from pathlib import Path
import sys
from types import SimpleNamespace

from fastapi.testclient import TestClient
import mongomock
import pytest


@pytest.fixture(scope="session")
def modules():
    root = Path(os.environ.get("TARGET_SOURCE_ROOT", ".")).resolve()
    if not (root / "src" / "app.py").is_file():
        pytest.fail(
            f"No src/app.py under {root}. Set TARGET_SOURCE_ROOT to the app checkout."
        )
    sys.path.insert(0, str(root))
    # Replace the client before any app import, including import-time seeding.
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr("pymongo.MongoClient", mongomock.MongoClient)
        database = importlib.import_module("src.backend.database")
        activities = importlib.import_module("src.backend.routers.activities")
        auth = importlib.import_module("src.backend.routers.auth")
        app = importlib.import_module("src.app")
        yield SimpleNamespace(
            database=database, activities=activities, auth=auth, app=app
        )
        database.client.close()
    sys.path.remove(str(root))


@pytest.fixture
def database(modules):
    db = modules.database
    db.activities_collection.delete_many({})
    db.teachers_collection.delete_many({})
    yield db
    db.activities_collection.delete_many({})
    db.teachers_collection.delete_many({})


@pytest.fixture
def teacher(database, modules):
    document = {
        "_id": "test-teacher",
        "username": "test-teacher",
        "display_name": "Test Teacher",
        "password": modules.auth.hash_password("test-password"),
        "role": "teacher",
    }
    database.teachers_collection.insert_one(document)
    return document


@pytest.fixture
def activity(database):
    document = {
        "_id": "Test Club",
        "description": "Learn programming",
        "schedule": "Mondays, 3:00 PM - 5:00 PM",
        "schedule_details": {
            "days": ["Monday", "Wednesday"],
            "start_time": "15:00",
            "end_time": "17:00",
        },
        "max_participants": 2,
        "participants": ["existing@example.edu"],
    }
    database.activities_collection.insert_one(document)
    return document


@pytest.fixture
def client(modules, database):
    with TestClient(modules.app.app) as test_client:
        yield test_client
