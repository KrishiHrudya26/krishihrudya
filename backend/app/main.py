from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.routers import auth, onboarding, customers, users, permissions, farms, assign, profile, dashboard
from app.routers import valve
from app.routers import products
from app.routers import analytics


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
		"http://187.127.139.240",
		"http://localhost:5173",
		"htttp://localhost:3000",
	],

    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(onboarding.router)
app.include_router(customers.router)
app.include_router(users.router)
app.include_router(permissions.router)
app.include_router(farms.router)
app.include_router(assign.router)
app.include_router(profile.router)
app.include_router(dashboard.router)
app.include_router(valve.router)
app.include_router(products.router)
app.include_router(analytics.router)



@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}
