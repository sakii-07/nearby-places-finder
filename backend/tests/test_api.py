import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import places as places_routes
from app.api.routes.auth import get_current_user
from app.core import security
from app.db.database import get_db
from app.main import app
from app.models.favorite import Favorite
from app.models.place import Place
from app.models.user import User
from app.schemas.place import PlaceCreate

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_auth_endpoint_requires_credentials() -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required or access token is invalid."


def test_admin_can_create_user_and_admin_accounts_with_hashed_passwords(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        security.settings,
        "secret_key",
        "test-secret-key-with-at-least-32-characters",
    )
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.__table__.create(engine)
    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    with test_session() as db:
        db.add_all(
            [
                User(
                    id=1,
                    name="Existing User",
                    email="user@example.com",
                    hashed_password=security.hash_password("existing-password"),
                    role="user",
                ),
                User(
                    id=4,
                    name="Existing Admin",
                    email="admin@example.com",
                    hashed_password=security.hash_password("existing-password"),
                    role="admin",
                ),
            ]
        )
        db.commit()

    def override_get_db():
        with test_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    admin_headers = {
        "Authorization": f"Bearer {security.create_access_token('4')}"
    }
    user_headers = {
        "Authorization": f"Bearer {security.create_access_token('1')}"
    }
    try:
        assert client.post("/api/auth/admin/users", json={}).status_code == 401
        assert (
            client.post(
                "/api/auth/admin/users",
                headers=user_headers,
                json={
                    "name": "Blocked",
                    "email": "blocked@example.com",
                    "password": "secure-password",
                },
            ).status_code
            == 403
        )

        user_response = client.post(
            "/api/auth/admin/users",
            headers=admin_headers,
            json={
                "name": "New User",
                "email": "new-user@example.com",
                "password": "user-password-123",
            },
        )
        assert user_response.status_code == 201
        assert user_response.json()["role"] == "user"
        assert "hashed_password" not in user_response.json()

        admin_response = client.post(
            "/api/auth/admin/users",
            headers=admin_headers,
            json={
                "name": "New Admin",
                "email": "new-admin@example.com",
                "password": "admin-password-123",
                "role": "admin",
            },
        )
        assert admin_response.status_code == 201
        assert admin_response.json()["role"] == "admin"
        assert "hashed_password" not in admin_response.json()

        duplicate_response = client.post(
            "/api/auth/admin/users",
            headers=admin_headers,
            json={
                "name": "Duplicate",
                "email": "NEW-USER@example.com",
                "password": "another-password",
            },
        )
        assert duplicate_response.status_code == 409

        invalid_email_response = client.post(
            "/api/auth/admin/users",
            headers=admin_headers,
            json={
                "name": "Invalid Email",
                "email": "not-an-email",
                "password": "another-password",
            },
        )
        assert invalid_email_response.status_code == 422

        invalid_role_response = client.post(
            "/api/auth/admin/users",
            headers=admin_headers,
            json={
                "name": "Invalid Role",
                "email": "invalid-role@example.com",
                "password": "another-password",
                "role": "owner",
            },
        )
        assert invalid_role_response.status_code == 422

        missing_fields_response = client.post(
            "/api/auth/admin/users",
            headers=admin_headers,
            json={"name": "Incomplete"},
        )
        assert missing_fields_response.status_code == 422

        with test_session() as db:
            created_user = db.scalar(
                select(User).where(User.email == "new-user@example.com")
            )
            created_admin = db.scalar(
                select(User).where(User.email == "new-admin@example.com")
            )
            assert created_user is not None
            assert created_admin is not None
            assert created_user.hashed_password != "user-password-123"
            assert security.verify_password(
                "user-password-123", created_user.hashed_password
            )
            assert created_admin.hashed_password != "admin-password-123"
            assert security.verify_password(
                "admin-password-123", created_admin.hashed_password
            )
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_admin_can_update_and_safely_delete_accounts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        security.settings,
        "secret_key",
        "test-secret-key-with-at-least-32-characters",
    )
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.__table__.create(engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE places ("
                "id INTEGER PRIMARY KEY, "
                "owner_id INTEGER REFERENCES users(id))"
            )
        )
    Favorite.__table__.create(engine)
    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    with test_session() as db:
        db.add_all(
            [
                User(
                    id=1,
                    name="Existing User",
                    email="user@example.com",
                    hashed_password=security.hash_password("existing-password"),
                    role="user",
                ),
                User(
                    id=4,
                    name="Existing Admin",
                    email="admin@example.com",
                    hashed_password=security.hash_password("existing-password"),
                    role="admin",
                ),
                User(
                    id=6,
                    name="Second Admin",
                    email="second-admin@example.com",
                    hashed_password=security.hash_password("existing-password"),
                    role="admin",
                ),
            ]
        )
        db.commit()
        db.execute(text("INSERT INTO places (id, owner_id) VALUES (10, 1)"))
        db.execute(
            text(
                "INSERT INTO favorites (id, user_id, place_id) "
                "VALUES (20, 1, 10)"
            )
        )
        db.commit()

    def override_get_db():
        with test_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    admin_headers = {
        "Authorization": f"Bearer {security.create_access_token('4')}"
    }
    user_headers = {
        "Authorization": f"Bearer {security.create_access_token('1')}"
    }
    try:
        update_payload = {
            "name": "Updated User",
            "email": "UPDATED@example.com",
            "role": "user",
        }
        assert (
            client.patch("/api/auth/admin/users/1", json=update_payload).status_code
            == 401
        )
        assert (
            client.patch(
                "/api/auth/admin/users/1",
                headers=user_headers,
                json=update_payload,
            ).status_code
            == 403
        )
        update_response = client.patch(
            "/api/auth/admin/users/1",
            headers=admin_headers,
            json=update_payload,
        )
        assert update_response.status_code == 200
        assert update_response.json()["name"] == "Updated User"
        assert update_response.json()["email"] == "updated@example.com"
        assert update_response.json()["role"] == "user"
        with test_session() as db:
            updated_user = db.get(User, 1)
            assert updated_user is not None
            assert security.verify_password(
                "existing-password", updated_user.hashed_password
            )

        assert (
            client.patch(
                "/api/auth/admin/users/1",
                headers=admin_headers,
                json={
                    "name": "Duplicate",
                    "email": "ADMIN@example.com",
                    "role": "user",
                },
            ).status_code
            == 409
        )
        assert (
            client.patch(
                "/api/auth/admin/users/1",
                headers=admin_headers,
                json={"name": "Invalid", "email": "bad-email", "role": "user"},
            ).status_code
            == 422
        )
        assert client.delete("/api/auth/admin/users/6").status_code == 401
        assert (
            client.delete(
                "/api/auth/admin/users/6", headers=user_headers
            ).status_code
            == 403
        )
        assert (
            client.delete(
                "/api/auth/admin/users/4", headers=admin_headers
            ).status_code
            == 409
        )
        assert (
            client.delete(
                "/api/auth/admin/users/1", headers=admin_headers
            ).status_code
            == 409
        )
        with test_session() as db:
            assert db.scalar(text("SELECT COUNT(*) FROM favorites")) == 1

        delete_second_admin = client.delete(
            "/api/auth/admin/users/6",
            headers=admin_headers,
        )
        assert delete_second_admin.status_code == 204
        last_admin_demotion = client.patch(
            "/api/auth/admin/users/4",
            headers=admin_headers,
            json={
                "name": "Only Admin",
                "email": "admin@example.com",
                "role": "user",
            },
        )
        assert last_admin_demotion.status_code == 409
        last_admin_delete = client.delete(
            "/api/auth/admin/users/4",
            headers=admin_headers,
        )
        assert last_admin_delete.status_code == 409
        assert last_admin_delete.json()["detail"] == "You cannot delete your own account."

        with test_session() as db:
            db.execute(text("DELETE FROM places WHERE owner_id = 1"))
            db.commit()
        delete_user = client.delete(
            "/api/auth/admin/users/1",
            headers=admin_headers,
        )
        assert delete_user.status_code == 204
        with test_session() as db:
            assert db.get(User, 1) is None
            assert db.scalar(text("SELECT COUNT(*) FROM favorites")) == 0
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_place_create_requires_authentication() -> None:
    response = client.post(
        "/api/places",
        json={
            "name": "Nowhere",
            "category": "Test",
            "latitude": 91,
            "longitude": 0,
        },
    )
    assert response.status_code == 401


def test_place_create_assigns_authenticated_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    created = {}

    def create_with_owner(_db, _payload, *, owner):
        created["owner_id"] = owner.id
        return {}

    monkeypatch.setattr(places_routes, "create_place", create_with_owner)
    owner = User(
        id=11,
        name="Owner",
        email="owner@example.com",
        hashed_password="test-hash",
        role="user",
    )
    places_routes.create_place_record(
        PlaceCreate(
            name="New place",
            category="Coffee",
            latitude=18.5,
            longitude=73.8,
        ),
        db=object(),
        current_user=owner,
    )
    assert created["owner_id"] == 11


def test_invalid_polygon_search_returns_validation_error(monkeypatch) -> None:
    class UnusedDB:
        pass

    def reject_polygon(*args, **kwargs):
        raise ValueError("Polygon is invalid or self-intersecting.")

    monkeypatch.setattr(places_routes, "polygon_places", reject_polygon)
    app.dependency_overrides[get_db] = lambda: UnusedDB()
    app.dependency_overrides[get_current_user] = lambda: User(
        id=1,
        name="Test User",
        email="user@example.com",
        hashed_password="test-hash",
        role="user",
    )
    try:
        response = client.post(
            "/api/places/within",
            json={
                "type": "Polygon",
                "coordinates": [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]],
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["detail"] == "Polygon is invalid or self-intersecting."


def test_polygon_search_rejects_repeated_points_before_postgis() -> None:
    class UnusedDB:
        pass

    app.dependency_overrides[get_db] = lambda: UnusedDB()
    app.dependency_overrides[get_current_user] = lambda: User(
        id=1,
        name="Test User",
        email="user@example.com",
        hashed_password="test-hash",
        role="user",
    )
    try:
        response = client.post(
            "/api/places/within",
            json={
                "type": "Polygon",
                "coordinates": [
                    [
                        [73.8567, 18.5204],
                        [73.8567, 18.5204],
                        [73.8567, 18.5204],
                        [73.8567, 18.5204],
                    ]
                ],
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert any(
        "at least three distinct positions" in error["msg"]
        for error in response.json()["detail"]
    )


def test_csv_export_returns_downloadable_csv(monkeypatch) -> None:
    app.dependency_overrides[get_db] = lambda: object()
    app.dependency_overrides[get_current_user] = lambda: User(
        id=1,
        name="Test User",
        email="user@example.com",
        hashed_password="test-hash",
        role="user",
    )
    monkeypatch.setattr(
        places_routes,
        "export_csv",
        lambda _db, *, owner_id: "id,name\n1,Cafe\n" if owner_id == 1 else "id,name\n",
    )
    try:
        response = client.get(
            "/api/places/export/csv",
            headers={"Origin": "http://127.0.0.1:4173"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"] == 'attachment; filename="places.csv"'
    assert response.text == "id,name\n1,Cafe\n"
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:4173"
    assert response.headers["access-control-expose-headers"] == "Content-Disposition"


def test_place_endpoints_use_authenticated_role_for_access_and_import_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class UnusedDB:
        pass

    calls: dict[str, object] = {}
    record = PlaceCreate(
        name="Owned place",
        category="Coffee",
        latitude=18.5,
        longitude=73.8,
    )
    monkeypatch.setattr(
        places_routes,
        "query_places",
        lambda _db, **kwargs: (calls.update(list=kwargs) or [], 0),
    )
    monkeypatch.setattr(
        places_routes,
        "nearby_places",
        lambda _db, **kwargs: calls.update(nearby=kwargs) or [],
    )
    monkeypatch.setattr(
        places_routes,
        "polygon_places",
        lambda _db, _polygon, _limit, **kwargs: calls.update(polygon=kwargs) or [],
    )
    monkeypatch.setattr(
        places_routes,
        "all_place_features",
        lambda _db, **kwargs: calls.update(geojson=kwargs)
        or {"type": "FeatureCollection", "features": []},
    )
    monkeypatch.setattr(
        places_routes,
        "parse_csv_import",
        lambda _content: ([record], []),
    )
    monkeypatch.setattr(
        places_routes,
        "parse_geojson_import",
        lambda _content: ([record], []),
    )
    monkeypatch.setattr(
        places_routes,
        "import_places",
        lambda _db, records, errors, *, owner: calls.update(
            imported_owner=owner.id,
            imported_count=len(records),
        )
        or {"successful_count": len(records), "failed_count": len(errors), "errors": errors},
    )
    monkeypatch.setattr(
        places_routes,
        "export_csv",
        lambda _db, *, owner_id: calls.update(csv_owner=owner_id) or "id,name\n",
    )
    app.dependency_overrides[get_db] = lambda: UnusedDB()
    try:
        for user_id, role, expected_owner in [(1, "user", 1), (4, "admin", None)]:
            app.dependency_overrides[get_current_user] = lambda user_id=user_id, role=role: User(
                id=user_id,
                name=f"Test {role}",
                email=f"{role}@example.com",
                hashed_password="test-hash",
                role=role,
            )

            assert client.get("/api/places?search=coffee").status_code == 200
            assert calls["list"]["owner_id"] == expected_owner
            assert client.get(
                "/api/places/nearby?latitude=18.5&longitude=73.8"
            ).status_code == 200
            assert calls["nearby"]["owner_id"] == expected_owner
            assert client.post(
                "/api/places/within",
                json={
                    "type": "Polygon",
                    "coordinates": [[[73, 18], [74, 18], [74, 19], [73, 18]]],
                },
            ).status_code == 200
            assert calls["polygon"]["owner_id"] == expected_owner
            assert client.get("/api/places/geojson").status_code == 200
            assert calls["geojson"]["owner_id"] == expected_owner
            assert client.post(
                "/api/places/import/csv",
                files={"file": ("places.csv", b"ignored", "text/csv")},
            ).status_code == 200
            assert calls["imported_owner"] == user_id
            assert client.post(
                "/api/places/import/geojson",
                files={"file": ("places.json", b"ignored", "application/json")},
            ).status_code == 200
            assert calls["imported_owner"] == user_id
            assert client.get("/api/places/export/csv").status_code == 200
            assert calls["csv_owner"] == expected_owner
    finally:
        app.dependency_overrides.clear()


def test_user_cannot_access_another_users_place_by_changing_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class ForeignPlaceDB:
        def get(self, _model, _place_id):
            return Place(id=2, owner_id=4)

    app.dependency_overrides[get_db] = lambda: ForeignPlaceDB()
    app.dependency_overrides[get_current_user] = lambda: User(
        id=1,
        name="User",
        email="user@example.com",
        hashed_password="test-hash",
        role="user",
    )
    try:
        assert client.get("/api/places/2").status_code == 403
        assert client.get("/api/places/2/geojson").status_code == 403
        assert client.patch(
            "/api/places/2",
            json={"name": "Changed"},
        ).status_code == 403
        assert client.delete("/api/places/2").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_user_cannot_favorite_another_users_place() -> None:
    class ForeignPlaceDB:
        def get(self, _model, _place_id):
            return Place(id=2, owner_id=4)

    app.dependency_overrides[get_db] = lambda: ForeignPlaceDB()
    app.dependency_overrides[get_current_user] = lambda: User(
        id=1,
        name="User",
        email="user@example.com",
        hashed_password="test-hash",
        role="user",
    )
    try:
        response = client.post("/api/favorites/2")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
