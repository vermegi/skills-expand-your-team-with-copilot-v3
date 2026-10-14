import pytest


def test_root_redirect(client):
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/static/index.html"


@pytest.mark.parametrize(
    ("filename", "content_type", "marker"),
    [
        ("index.html", "text/html", "Mergington"),
        ("app.js", "javascript", "DOMContentLoaded"),
        ("styles.css", "text/css", "body"),
    ],
)
def test_static_assets(client, filename, content_type, marker):
    response = client.get(f"/static/{filename}")
    assert response.status_code == 200
    assert content_type in response.headers["content-type"]
    assert marker in response.text


def test_missing_static_asset(client):
    assert client.get("/static/missing.txt").status_code == 404


@pytest.mark.parametrize("path", ["/activities", "/activities/"])
def test_activity_routes(client, activity, path):
    response = client.get(path, params={"day": "Monday", "start_time": "15:00"})
    assert response.status_code == 200
    assert response.json() == {
        "Test Club": {key: value for key, value in activity.items() if key != "_id"}
    }


def test_days_route(client, activity):
    response = client.get("/activities/days")
    assert response.status_code == 200
    assert response.json() == ["Monday", "Wednesday"]


def test_participant_routes_round_trip(client, database, activity, teacher):
    params = {"email": "new@example.edu", "teacher_username": teacher["username"]}
    signup = client.post("/activities/Test%20Club/signup", params=params)
    assert signup.status_code == 200
    assert signup.json() == {"message": "Signed up new@example.edu for Test Club"}
    assert "new@example.edu" in database.activities_collection.find_one(
        {"_id": "Test Club"}
    )["participants"]
    unregister = client.post("/activities/Test%20Club/unregister", params=params)
    assert unregister.status_code == 200
    assert unregister.json() == {"message": "Unregistered new@example.edu from Test Club"}
    assert database.activities_collection.find_one({"_id": "Test Club"}) == activity


def test_auth_routes(client, teacher):
    public = {key: teacher[key] for key in ("username", "display_name", "role")}
    login = client.post(
        "/auth/login", params={"username": teacher["username"], "password": "test-password"}
    )
    assert login.status_code == 200
    assert login.json() == public
    session = client.get("/auth/check-session", params={"username": teacher["username"]})
    assert session.status_code == 200
    assert session.json() == public


@pytest.mark.parametrize(
    ("method", "path", "params", "status", "detail"),
    [
        ("post", "/activities/Test%20Club/signup", {"email": "x@example.edu"}, 401,
         "Authentication required for this action"),
        ("post", "/activities/Test%20Club/unregister", {"email": "x@example.edu"}, 401,
         "Authentication required for this action"),
        ("post", "/auth/login", {"username": "unknown", "password": "wrong"}, 401,
         "Invalid username or password"),
        ("get", "/auth/check-session", {"username": "unknown"}, 404, "Teacher not found"),
    ],
)
def test_http_errors(client, method, path, params, status, detail):
    response = getattr(client, method)(path, params=params)
    assert response.status_code == status
    assert response.json() == {"detail": detail}


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/activities/Test%20Club/signup"),
        ("post", "/activities/Test%20Club/unregister"),
        ("post", "/auth/login"),
        ("get", "/auth/check-session"),
    ],
)
def test_missing_required_query_parameters(client, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 422
    assert all(error["loc"][0] == "query" for error in response.json()["detail"])
