import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import app


@pytest.fixture
async def client():
    """Async HTTP client wired to the FastAPI backend app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
