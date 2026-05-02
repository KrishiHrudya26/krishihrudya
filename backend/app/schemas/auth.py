from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

class LoginRequest(BaseModel):
    identifier: str  # email or phone
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    identifier: str  # email or phone

class VerifyOtpRequest(BaseModel):
    identifier: str
    otp: str
    purpose: str  # password_reset

class ResetPasswordRequest(BaseModel):
    identifier: str
    otp: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserInfo(BaseModel):
    user_id: UUID
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    role_slug: str
    role_name: str
    customer_id: UUID
    customer_name: str
    customer_type: str
    is_kh_internal: bool
    bypass_org_scope: bool
    permissions: dict

    class Config:
        from_attributes = True

class RegisterRequest(BaseModel):
    customer_code:     str
    full_name:         str
    email:             Optional[str] = None
    phone:             Optional[str] = None
    role_id:           UUID
    hierarchy_node_id: Optional[UUID] = None
    verify_via:        str = "email"  # email or phone

class SetPasswordRequest(BaseModel):
    identifier: str
    otp:        str
    password:   str
