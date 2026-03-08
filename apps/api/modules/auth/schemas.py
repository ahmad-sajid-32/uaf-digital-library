# apps/api/modules/auth/schemas.py
"""
Pydantic schemas for the Auth Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define request validation models for admin-driven user creation.
- Define normalized 200 response envelope models.
- Ensure strict field validation.
- Provide Swagger-friendly examples.

Architectural Rules:
- No business logic.
- No database logic.
- No Supabase logic.
- Validation and documentation only.
"""

from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, StringConstraints


class UserCreationData(BaseModel):
    """
    User creation payload returned inside the success envelope.
    """

    user_id: UUID = Field(
        ...,
        example="550e8400-e29b-41d4-a716-446655440000",
    )
    email: EmailStr = Field(
        ...,
        example="student@uaf.edu.pk",
    )
    role: str = Field(
        ...,
        example="STUDENT",
    )
    password_setup_required: bool = Field(
        ...,
        example=True,
    )


class UserCreationResponse(BaseModel):
    """
    Standard normalized 200 response for user creation endpoints.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Student account created successfully")
    data: UserCreationData
    timestamp_ms: int = Field(..., example=1741348800000)


class EmptyData(BaseModel):
    """
    Empty object payload for successful admin profile mutations.
    """

    pass


class SimpleMessageResponse(BaseModel):
    """
    Standard normalized 200 response for admin profile mutations.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="User profile updated successfully")
    data: EmptyData = Field(default_factory=EmptyData)
    timestamp_ms: int = Field(..., example=1741348800000)


class CreateStudentRequest(BaseModel):
    """
    Request model for creating a student account.
    """

    email: EmailStr = Field(..., example="2022ag9159@uaf.edu.pk")
    full_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(..., example="Ahmad Sajid")
    roll_number: Annotated[
        str,
        StringConstraints(pattern=r"^\d{4}-[a-z]{2}-\d{4}$"),
    ] = Field(..., example="2022-ag-9159")
    department: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(..., example="Agriculture")
    semester: int = Field(..., gt=0, example=5)


class CreateLibrarianRequest(BaseModel):
    """
    Request model for creating a librarian account.
    """

    email: EmailStr = Field(..., example="librarian@uaf.edu.pk")
    full_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(..., example="Muhammad Ali")
    employee_code: Annotated[
        str,
        StringConstraints(min_length=3, max_length=50),
    ] = Field(..., example="LIB-1023")
    department: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(..., example="Central Library")


class CreateAdminRequest(BaseModel):
    """
    Request model for creating an admin account.
    """

    email: EmailStr = Field(..., example="admin@uaf.edu.pk")
    full_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(..., example="Dr. Khalid Mehmood")
    designation: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(..., example="Chief Librarian")


class AdminUpdateUserProfileRequest(BaseModel):
    """
    Request model for updating a target user's full name.
    """

    full_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(..., example="Muhammad Ahmad")


CREATE_STUDENT_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Student account created successfully",
    "data": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "student@uaf.edu.pk",
        "role": "STUDENT",
        "password_setup_required": True,
    },
    "timestamp_ms": 1741348800000,
}

CREATE_LIBRARIAN_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Librarian account created successfully",
    "data": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "librarian@uaf.edu.pk",
        "role": "LIBRARIAN",
        "password_setup_required": True,
    },
    "timestamp_ms": 1741348800000,
}

CREATE_ADMIN_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Admin account created successfully",
    "data": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "admin@uaf.edu.pk",
        "role": "ADMIN",
        "password_setup_required": True,
    },
    "timestamp_ms": 1741348800000,
}

ADMIN_UPDATE_PROFILE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "User profile updated successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}

ADMIN_DELETE_USER_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "User account deleted successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}
