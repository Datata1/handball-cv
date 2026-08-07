"""Integration tests for the backend API."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


async def test_health_endpoint(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_unknown_route_returns_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/nonexistent")
    assert response.status_code == 404
