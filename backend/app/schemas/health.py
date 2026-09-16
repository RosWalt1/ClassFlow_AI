from pydantic import BaseModel
from typing import Optional


class DatabaseHealth(BaseModel):
    status: str
    database: Optional[str] = None
    version: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    project: str
    version: str
    environment: str
    database: DatabaseHealth
