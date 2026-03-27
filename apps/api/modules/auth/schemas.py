# apps/api/modules/auth/schemas.py
"""
Pydantic schemas for the Auth Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define request validation models for admin-driven user creation.
- Define request validation models for admin user list filtering.
- Define request validation models for admin user status changes.
- Define stable admin-managed user read response envelopes.
- Define normalized 200 response envelope models.
- Ensure strict field validation.
- Provide Swagger-friendly examples.

Architectural Rules:
- No business logic.
- No database logic.
- No Supabase logic.
- Validation and documentation only.
"""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
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


class AdminManagedUserItem(BaseModel):
    """
    Stable admin-managed user read model shared by list and detail responses.
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
    is_active: bool = Field(
        ...,
        example=True,
    )
    full_name: str = Field(
        ...,
        example="Ahmad Sajid",
    )
    roll_number: str | None = Field(
        None,
        example="2022-ag-9159",
    )
    department: str | None = Field(
        None,
        example="Computer Science",
    )
    semester: int | None = Field(
        None,
        example=8,
    )
    employee_code: str | None = Field(
        None,
        example="LIB-1023",
    )
    designation: str | None = Field(
        None,
        example="Chief Librarian",
    )
    created_at: datetime = Field(
        ...,
        example="2026-03-26T10:00:00Z",
    )


class AdminUsersListData(BaseModel):
    """
    Admin-managed user list payload returned inside the success envelope.
    """

    items: list[AdminManagedUserItem]
    total: int = Field(..., example=1)
    limit: int = Field(..., example=50)
    offset: int = Field(..., example=0)


class AdminUsersListResponse(BaseModel):
    """
    Standard normalized 200 response for admin user listing.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Users retrieved successfully")
    data: AdminUsersListData
    timestamp_ms: int = Field(..., example=1741348800000)


class AdminManagedUserDetailBase(BaseModel):
    """
    Shared top-level fields returned by the admin user-detail endpoint.
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
    is_active: bool = Field(
        ...,
        example=True,
    )
    full_name: str = Field(
        ...,
        example="Ahmad Sajid",
    )
    created_at: datetime = Field(
        ...,
        example="2026-03-26T10:00:00Z",
    )


class AdminManagedStudentProfile(BaseModel):
    """
    Student-only detail payload for admin user detail responses.
    """

    roll_number: str = Field(
        ...,
        example="2022-ag-9159",
    )
    department: str = Field(
        ...,
        example="Computer Science",
    )
    semester: int = Field(
        ...,
        example=8,
    )


class AdminManagedLibrarianProfile(BaseModel):
    """
    Librarian-only detail payload for admin user detail responses.
    """

    employee_code: str = Field(
        ...,
        example="LIB-1023",
    )
    department: str = Field(
        ...,
        example="Central Library",
    )


class AdminManagedAdminProfile(BaseModel):
    """
    Admin-only detail payload for admin user detail responses.
    """

    designation: str = Field(
        ...,
        example="Chief Librarian",
    )


class AdminManagedStudentDetailUser(AdminManagedUserDetailBase):
    """
    Role-explicit admin detail object for student accounts.
    """

    role: Literal["STUDENT"] = Field(
        ...,
        example="STUDENT",
    )
    student_profile: AdminManagedStudentProfile


class AdminManagedLibrarianDetailUser(AdminManagedUserDetailBase):
    """
    Role-explicit admin detail object for librarian accounts.
    """

    role: Literal["LIBRARIAN"] = Field(
        ...,
        example="LIBRARIAN",
    )
    librarian_profile: AdminManagedLibrarianProfile


class AdminManagedAdminDetailUser(AdminManagedUserDetailBase):
    """
    Role-explicit admin detail object for admin accounts.
    """

    role: Literal["ADMIN"] = Field(
        ...,
        example="ADMIN",
    )
    admin_profile: AdminManagedAdminProfile


class AdminUserDetailData(BaseModel):
    """
    Single admin-managed user payload returned inside the success envelope.
    """

    user: Annotated[
        AdminManagedStudentDetailUser
        | AdminManagedLibrarianDetailUser
        | AdminManagedAdminDetailUser,
        Field(discriminator="role"),
    ]


class AdminUserDetailResponse(BaseModel):
    """
    Standard normalized 200 response for admin user detail retrieval.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="User retrieved successfully")
    data: AdminUserDetailData
    timestamp_ms: int = Field(..., example=1741348800000)


class AdminUsersListQueryParams(StrictRequestModel):
    """
    Query parameters for admin-managed user listing.
    """

    role: str | None = Field(
        default=None,
        description="Optional exact role filter: student | librarian | admin.",
        example="student",
    )
    is_active: bool | None = Field(
        default=None,
        description="Optional activity-state filter.",
        example=True,
    )
    search: Annotated[
        str | None,
        StringConstraints(min_length=1, max_length=100),
    ] = Field(
        default=None,
        description=(
            "Case-insensitive search across email, full_name, roll_number, "
            "employee_code, department, and designation."
        ),
        example="ahmad",
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=100,
        description="Number of records to fetch (max 100).",
        example=50,
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Number of records to skip.",
        example=0,
    )

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: Any) -> Any:
        """
        Normalize optional role filters to stable lowercase tokens.
        """

        if isinstance(value, str):
            normalized = value.strip().lower()
            return normalized or None

        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None) -> str | None:
        """
        Accept only the supported app roles for admin user filtering.
        """

        if value is None:
            return None

        if value not in {"student", "librarian", "admin"}:
            raise ValueError("role must be one of: student, librarian, admin")

        return value

    @field_validator("search", mode="before")
    @classmethod
    def normalize_search(cls, value: Any) -> Any:
        """
        Normalize search text while collapsing meaningless whitespace.
        """

        if isinstance(value, str):
            normalized = _normalize_bounded_text(value)
            return normalized or None

        return value


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
    is_inactive: bool = Field(..., example=False)


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


class AdminUpdateUserStatusRequest(StrictRequestModel):
    """
    Request model for updating a target user's activation state.
    """

    is_active: bool = Field(..., example=False)


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
    Request model for updating a target user's role-specific profile fields.
    """

    full_name: Annotated[
        str | None,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(default=None, example="Muhammad Ahmad")
    roll_number: Annotated[
        str | None,
        StringConstraints(pattern=r"^\d{4}-[a-z]{2}-\d{4}$"),
    ] = Field(default=None, example="2022-ag-9159")
    department: Annotated[
        str | None,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(default=None, example="Computer Science")
    semester: int | None = Field(default=None, gt=0, example=8)
    employee_code: Annotated[
        str | None,
        StringConstraints(min_length=3, max_length=50),
    ] = Field(default=None, example="LIB-1023")
    designation: Annotated[
        str | None,
        StringConstraints(min_length=2, max_length=100),
    ] = Field(default=None, example="Chief Librarian")

    @field_validator("full_name", "department", "designation", mode="before")
    @classmethod
    def normalize_text_fields(cls, value: Any) -> Any:
        """
        Normalize admin-managed bounded text fields before validation.
        """

        return _normalize_bounded_text(value)

    @field_validator("roll_number", mode="before")
    @classmethod
    def normalize_roll_number(cls, value: Any) -> Any:
        """
        Normalize admin-managed roll-number updates before validation.
        """

        return _normalize_roll_number(value)

    @field_validator("employee_code", mode="before")
    @classmethod
    def normalize_employee_code(cls, value: Any) -> Any:
        """
        Normalize admin-managed employee-code updates before validation.
        """

        return _normalize_employee_code(value)

    @model_validator(mode="after")
    def validate_non_empty_payload(self) -> "AdminUpdateUserProfileRequest":
        """
        Require at least one explicit field for a PATCH profile update.
        """

        if (
            self.full_name is None
            and self.roll_number is None
            and self.department is None
            and self.semester is None
            and self.employee_code is None
            and self.designation is None
        ):
            raise ValueError("At least one updatable field is required")

        return self


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

ADMIN_USERS_LIST_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Users retrieved successfully",
    "data": {
        "items": [
            {
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "email": "student@uaf.edu.pk",
                "role": "STUDENT",
                "is_active": True,
                "full_name": "Ahmad Sajid",
                "roll_number": "2022-ag-9159",
                "department": "Computer Science",
                "semester": 8,
                "employee_code": None,
                "designation": None,
                "created_at": "2026-03-26T10:00:00Z",
            }
        ],
        "total": 1,
        "limit": 50,
        "offset": 0,
    },
    "timestamp_ms": 1741348800000,
}

ADMIN_USER_DETAIL_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "User retrieved successfully",
    "data": {
        "user": {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "student@uaf.edu.pk",
            "role": "STUDENT",
            "is_active": True,
            "full_name": "Ahmad Sajid",
            "created_at": "2026-03-26T10:00:00Z",
            "student_profile": {
                "roll_number": "2022-ag-9159",
                "department": "Computer Science",
                "semester": 8,
            },
        }
    },
    "timestamp_ms": 1741348800000,
}

ACCOUNT_STATUS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Account status retrieved successfully",
    "data": {
        "has_account": True,
        "is_deleted": False,
        "is_inactive": True,
    },
    "timestamp_ms": 1741348800000,
}

ADMIN_UPDATE_PROFILE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "User profile updated successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}

ADMIN_UPDATE_STATUS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "User status updated successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}

ADMIN_DELETE_USER_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "User account deleted successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}
