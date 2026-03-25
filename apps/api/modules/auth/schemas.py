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

from typing import Annotated, Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
)


def _normalize_email(value: Any) -> Any:
    """
    Normalize an email-like value before EmailStr validation.
    """

    if isinstance(value, str):
        return value.strip().lower()

    return value


def _normalize_bounded_text(value: Any) -> Any:
    """
    Trim and collapse internal whitespace for human-readable text fields.
    """

    if isinstance(value, str):
        return " ".join(value.strip().split())

    return value


def _normalize_roll_number(value: Any) -> Any:
    """
    Normalize roll numbers to trimmed lowercase tokens.
    """

    if isinstance(value, str):
        return value.strip().lower()

    return value


def _normalize_employee_code(value: Any) -> Any:
    """
    Normalize employee codes to trimmed uppercase tokens.
    """

    if isinstance(value, str):
        return value.strip().upper()

    return value


class StrictRequestModel(BaseModel):
    """
    Shared strict request base model for auth payloads.
    """

    model_config = ConfigDict(extra="forbid")


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


class AccountStatusRequest(StrictRequestModel):
    """
    Request model for checking whether an email belongs to an app account.
    """

    email: EmailStr = Field(..., example="user@uaf.edu.pk")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> Any:
        """
        Normalize guest auth email probes before validation.
        """

        return _normalize_email(value)


class AccountStatusData(BaseModel):
    """
    Public-safe account state payload for guest auth messaging.
    """

    has_account: bool = Field(..., example=True)
    is_deleted: bool = Field(..., example=True)


class AccountStatusResponse(BaseModel):
    """
    Standard normalized 200 response for account status lookup.
    """

    status: int = Field(..., example=200)
    message: str = Field(
        ...,
        example="Account status retrieved successfully",
    )
    data: AccountStatusData
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


class CreateStudentRequest(StrictRequestModel):
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

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> Any:
        """
        Normalize email input before EmailStr validation.
        """

        return _normalize_email(value)

    @field_validator("full_name", "department", mode="before")
    @classmethod
    def normalize_text_fields(cls, value: Any) -> Any:
        """
        Normalize human-readable bounded text fields.
        """

        return _normalize_bounded_text(value)

    @field_validator("roll_number", mode="before")
    @classmethod
    def normalize_roll_number(cls, value: Any) -> Any:
        """
        Normalize roll number casing and boundary whitespace.
        """

        return _normalize_roll_number(value)


class CreateLibrarianRequest(StrictRequestModel):
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

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> Any:
        """
        Normalize email input before EmailStr validation.
        """

        return _normalize_email(value)

    @field_validator("full_name", "department", mode="before")
    @classmethod
    def normalize_text_fields(cls, value: Any) -> Any:
        """
        Normalize human-readable bounded text fields.
        """

        return _normalize_bounded_text(value)

    @field_validator("employee_code", mode="before")
    @classmethod
    def normalize_employee_code(cls, value: Any) -> Any:
        """
        Normalize employee codes to a stable uppercase form.
        """

        return _normalize_employee_code(value)


class CreateAdminRequest(StrictRequestModel):
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

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> Any:
        """
        Normalize email input before EmailStr validation.
        """

        return _normalize_email(value)

    @field_validator("full_name", "designation", mode="before")
    @classmethod
    def normalize_text_fields(cls, value: Any) -> Any:
        """
        Normalize human-readable bounded text fields.
        """

        return _normalize_bounded_text(value)


class AdminUpdateUserProfileRequest(StrictRequestModel):
    """
    Request model for updating a target user's full name.
    """

    full_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(..., example="Muhammad Ahmad")

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_full_name(cls, value: Any) -> Any:
        """
        Normalize admin-managed full-name updates before validation.
        """

        return _normalize_bounded_text(value)


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

ACCOUNT_STATUS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Account status retrieved successfully",
    "data": {
        "has_account": True,
        "is_deleted": True,
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
