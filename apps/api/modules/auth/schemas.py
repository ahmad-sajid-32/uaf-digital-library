# apps/api/modules/auth/schemas.py
"""
Pydantic schemas for the Auth Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define request validation models for admin-driven user creation.
- Provide structured 200 success response model.
- Ensure strict field validation.
- Provide Swagger UI examples.

Architectural Rules:
- No business logic.
- No database logic.
- No Supabase logic.
- Only validation and documentation.

Security Notes:
- Password is never accepted from admin.
- Service role key is never exposed.
- Role is enforced in backend service layer.
"""

from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, StringConstraints


# ================================
# Common Success Response Model
# ================================

class UserCreationResponse(BaseModel):
    """
    Standard 200 response returned after successful user creation.
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


# ================================
# Student Creation Schema
# ================================

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


# ================================
# Librarian Creation Schema
# ================================

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


# ================================
# Admin Creation Schema
# ================================

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