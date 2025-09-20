from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import jwt
import bcrypt
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
DATABASE_NAME = "ewaste_management"

# FastAPI app
app = FastAPI(title="E-Waste Management API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB client
client = AsyncIOMotorClient(MONGO_URL)
db = client[DATABASE_NAME]

# Security
security = HTTPBearer()

# Pydantic models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    mobile: str
    role: str  # admin, collector, user
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    mobile: str
    password: str
    role: str = "user"

class UserLogin(BaseModel):
    mobile: str
    password: str

class EwasteRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    description: str
    quantity: str
    pickup_address: str
    contact_info: str
    status: str = "submitted"  # submitted, assigned, accepted, picked_up, completed
    assigned_collector_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EwasteRequestCreate(BaseModel):
    description: str
    quantity: str
    pickup_address: str
    contact_info: str

class EwasteRequestUpdate(BaseModel):
    status: str
    assigned_collector_id: Optional[str] = None

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    action: str
    performed_by: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    request_id: str
    action: str
    performed_by: str

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_data: dict) -> str:
    return jwt.encode(user_data, JWT_SECRET, algorithm="HS256")

def verify_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    user_data = verify_jwt_token(token)
    user = await db.users.find_one({"id": user_data["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

async def get_admin_user(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def get_collector_user(user: User = Depends(get_current_user)):
    if user.role not in ["admin", "collector"]:
        raise HTTPException(status_code=403, detail="Collector or admin access required")
    return user

async def log_transaction(request_id: str, action: str, performed_by: str):
    transaction = TransactionCreate(
        request_id=request_id,
        action=action,
        performed_by=performed_by
    )
    transaction_dict = transaction.dict()
    transaction_dict["id"] = str(uuid.uuid4())
    transaction_dict["timestamp"] = datetime.now(timezone.utc)
    await db.transactions.insert_one(transaction_dict)

# Initialize default accounts
async def create_default_accounts():
    default_accounts = [
        {
            "id": str(uuid.uuid4()),
            "name": "Admin User",
            "mobile": "9999999999",
            "password_hash": hash_password("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Collector One",
            "mobile": "8888888888",
            "password_hash": hash_password("collector123"),
            "role": "collector",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Test User",
            "mobile": "7777777777",
            "password_hash": hash_password("user123"),
            "role": "user",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for account in default_accounts:
        existing = await db.users.find_one({"mobile": account["mobile"]})
        if not existing:
            await db.users.insert_one(account)

@app.on_event("startup")
async def startup_event():
    await create_default_accounts()

# API Routes

@app.get("/")
async def root():
    return {"message": "E-Waste Management System API"}

# Authentication routes
@app.post("/api/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"mobile": user_data.mobile})
    if existing_user:
        raise HTTPException(status_code=400, detail="Mobile number already registered")
    
    # Create user
    user_dict = user_data.dict()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = datetime.now(timezone.utc)
    
    # Remove password from dict before storing
    password = user_dict.pop("password")
    user_dict["password_hash"] = password
    
    await db.users.insert_one(user_dict)
    
    # Create JWT token
    token_data = {"user_id": user_dict["id"], "role": user_data.role}
    token = create_jwt_token(token_data)
    
    return {"token": token, "user": User(**user_dict)}

@app.post("/api/login")
async def login(login_data: UserLogin):
    user = await db.users.find_one({"mobile": login_data.mobile})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid mobile number or password")
    
    # Handle both password and password_hash field names for backward compatibility
    password_hash = user.get("password_hash") or user.get("password")
    if not password_hash or not verify_password(login_data.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid mobile number or password")
    
    token_data = {"user_id": user["id"], "role": user["role"]}
    token = create_jwt_token(token_data)
    
    return {"token": token, "user": User(**user)}

@app.post("/api/admin/login")
async def admin_login(login_data: UserLogin):
    user = await db.users.find_one({"mobile": login_data.mobile, "role": "admin"})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    # Handle both password and password_hash field names for backward compatibility
    password_hash = user.get("password_hash") or user.get("password")
    if not password_hash or not verify_password(login_data.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    token_data = {"user_id": user["id"], "role": user["role"]}
    token = create_jwt_token(token_data)
    
    return {"token": token, "user": User(**user)}

# User routes
@app.get("/api/profile", response_model=User)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

# E-waste request routes
@app.post("/api/requests", response_model=EwasteRequest)
async def create_request(request_data: EwasteRequestCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["user"]:
        raise HTTPException(status_code=403, detail="Only users can create requests")
    
    request_dict = request_data.dict()
    request_dict["id"] = str(uuid.uuid4())
    request_dict["user_id"] = current_user.id
    request_dict["status"] = "submitted"
    request_dict["created_at"] = datetime.now(timezone.utc)
    request_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.ewaste_requests.insert_one(request_dict)
    
    # Log transaction
    await log_transaction(request_dict["id"], "Request created", current_user.id)
    
    return EwasteRequest(**request_dict)

@app.get("/api/requests", response_model=List[EwasteRequest])
async def get_requests(current_user: User = Depends(get_current_user)):
    if current_user.role == "user":
        # Users can only see their own requests
        requests = await db.ewaste_requests.find({"user_id": current_user.id}).to_list(length=None)
    elif current_user.role == "collector":
        # Collectors see assigned requests
        requests = await db.ewaste_requests.find({"assigned_collector_id": current_user.id}).to_list(length=None)
    else:
        # Admins see all requests
        requests = await db.ewaste_requests.find().to_list(length=None)
    
    return [EwasteRequest(**req) for req in requests]

@app.get("/api/admin/requests", response_model=List[EwasteRequest])
async def get_all_requests(admin_user: User = Depends(get_admin_user)):
    requests = await db.ewaste_requests.find().to_list(length=None)
    return [EwasteRequest(**req) for req in requests]

@app.put("/api/admin/requests/{request_id}")
async def assign_request(request_id: str, update_data: EwasteRequestUpdate, admin_user: User = Depends(get_admin_user)):
    request = await db.ewaste_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    update_dict = {
        "status": update_data.status,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if update_data.assigned_collector_id:
        update_dict["assigned_collector_id"] = update_data.assigned_collector_id
    
    await db.ewaste_requests.update_one({"id": request_id}, {"$set": update_dict})
    
    # Log transaction
    action = f"Request {update_data.status}"
    if update_data.assigned_collector_id:
        action += f" and assigned to collector {update_data.assigned_collector_id}"
    await log_transaction(request_id, action, admin_user.id)
    
    return {"message": "Request updated successfully"}

@app.put("/api/collector/requests/{request_id}")
async def update_request_status(request_id: str, status: str, collector_user: User = Depends(get_collector_user)):
    request = await db.ewaste_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if collector is assigned to this request or is admin
    if collector_user.role == "collector" and request.get("assigned_collector_id") != collector_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this request")
    
    update_dict = {
        "status": status,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.ewaste_requests.update_one({"id": request_id}, {"$set": update_dict})
    
    # Log transaction
    await log_transaction(request_id, f"Status updated to {status}", collector_user.id)
    
    return {"message": "Request status updated successfully"}

# Collector routes
@app.get("/api/collectors", response_model=List[User])
async def get_collectors(admin_user: User = Depends(get_admin_user)):
    collectors = await db.users.find({"role": "collector"}).to_list(length=None)
    return [User(**collector) for collector in collectors]

# Transaction routes  
@app.get("/api/transactions/{request_id}", response_model=List[Transaction])
async def get_request_transactions(request_id: str, current_user: User = Depends(get_current_user)):
    transactions = await db.transactions.find({"request_id": request_id}).sort("timestamp", -1).to_list(length=None)
    return [Transaction(**txn) for txn in transactions]

# Analytics routes
@app.get("/api/admin/analytics")
async def get_analytics(admin_user: User = Depends(get_admin_user)):
    total_requests = await db.ewaste_requests.count_documents({})
    pending_requests = await db.ewaste_requests.count_documents({"status": {"$in": ["submitted", "assigned"]}})
    completed_requests = await db.ewaste_requests.count_documents({"status": "completed"})
    in_progress_requests = await db.ewaste_requests.count_documents({"status": {"$in": ["accepted", "picked_up"]}})
    
    return {
        "total_requests": total_requests,
        "pending_requests": pending_requests,
        "completed_requests": completed_requests,
        "in_progress_requests": in_progress_requests
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)