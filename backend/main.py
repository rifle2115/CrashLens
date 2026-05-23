import os
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from database import engine, get_db
import models, schemas, auth
from parser import parse_log

# Schema is managed by Alembic — run `alembic upgrade head` before starting
# the app. The previous models.Base.metadata.create_all(bind=engine) call was
# convenient in dev but does not handle migrations (column changes, drops, etc.)
# so it has no place in a deployed environment.

# Comma-separated list of allowed origins, e.g. "http://localhost:3000,https://crashlens.app"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

app = FastAPI(title="CrashLens API")

# Must be added BEFORE CORSMiddleware so it runs outermost
@app.middleware("http")
async def catch_all_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc)[:300]},
            headers={"Access-Control-Allow-Origin": CORS_ORIGINS[0] if CORS_ORIGINS else "*"},
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    """Liveness + readiness probe. Verifies the DB is reachable so
    orchestrators (Compose, ECS, ALB) only send traffic when the
    whole stack is up."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "db": "unreachable", "detail": str(exc)[:200]},
        )


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/signup", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def signup(data: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken.")
    user = models.User(username=data.username, password_hash=auth.hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": auth.create_access_token(user.id), "token_type": "bearer"}


@app.post("/auth/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not auth.verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    return {"access_token": auth.create_access_token(user.id), "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# ── Log Analysis ──────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=schemas.LogSessionOut)
async def analyze(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    allowed = {".log", ".txt"}
    suffix = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in file.filename else ""
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{suffix}'.")

    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = raw_bytes.decode("latin-1")

    result = parse_log(content)

    session = models.LogSession(
        user_id=current_user.id,
        filename=name.strip() if name and name.strip() else file.filename,
        total_lines=result["total_lines"],
        summary=result["summary"],
    )
    db.add(session)
    db.flush()

    db.bulk_insert_mappings(
        models.LogEntry,
        [
            {"session_id": session.id, "line_number": e["line_number"], "level": e["level"], "raw": e["raw"]}
            for e in result["entries"]
        ],
    )
    db.commit()
    db.refresh(session)
    return session


# ── Sessions ──────────────────────────────────────────────────────────────────

@app.get("/sessions", response_model=list[schemas.LogSessionOut])
def get_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.LogSession)
        .filter(models.LogSession.user_id == current_user.id)
        .order_by(models.LogSession.uploaded_at.desc())
        .all()
    )


@app.get("/sessions/{session_id}", response_model=schemas.LogSessionDetail)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = db.query(models.LogSession).filter(
        models.LogSession.id == session_id,
        models.LogSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    entries = db.query(models.LogEntry).filter(models.LogEntry.session_id == session_id).order_by(models.LogEntry.line_number).all()
    errors = [e for e in entries if e.level in ("ERROR", "CRITICAL")]
    warnings = [e for e in entries if e.level == "WARNING"]

    return schemas.LogSessionDetail(
        id=session.id,
        filename=session.filename,
        total_lines=session.total_lines,
        summary=session.summary,
        uploaded_at=session.uploaded_at,
        entries=entries,
        errors=errors,
        warnings=warnings,
    )


@app.get("/sessions/{session_id}/entries", response_model=list[schemas.LogEntryOut])
def get_entries(
    session_id: int,
    level: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = db.query(models.LogSession).filter(
        models.LogSession.id == session_id,
        models.LogSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    query = db.query(models.LogEntry).filter(models.LogEntry.session_id == session_id)
    if level and level != "ALL":
        query = query.filter(models.LogEntry.level == level)
    if q:
        query = query.filter(models.LogEntry.raw.ilike(f"%{q}%"))

    return query.order_by(models.LogEntry.line_number).all()


@app.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    session = db.query(models.LogSession).filter(
        models.LogSession.id == session_id,
        models.LogSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    db.delete(session)
    db.commit()


# ── AI Chat (streaming) ───────────────────────────────────────────────────────

@app.post("/ai/chat")
async def ai_chat(
    data: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    import os
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not set in .env")

    try:
        from groq import Groq
    except ImportError:
        raise HTTPException(status_code=500, detail="Install the 'groq' package.")

    log_context = ""
    if data.session_id is not None:
        session = db.query(models.LogSession).filter(
            models.LogSession.id == data.session_id,
            models.LogSession.user_id == current_user.id,
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")

        errors = (
            db.query(models.LogEntry)
            .filter(models.LogEntry.session_id == data.session_id, models.LogEntry.level.in_(["ERROR", "CRITICAL"]))
            .order_by(models.LogEntry.line_number).limit(10).all()
        )
        warnings = (
            db.query(models.LogEntry)
            .filter(models.LogEntry.session_id == data.session_id, models.LogEntry.level == "WARNING")
            .order_by(models.LogEntry.line_number).limit(5).all()
        )
        summary = session.summary or {}
        error_lines = "\n".join(f"  Line {e.line_number}: [{e.level}] {e.raw}" for e in errors)
        warning_lines = "\n".join(f"  Line {e.line_number}: [WARNING] {e.raw}" for e in warnings)
        log_context = (
            f"File: {session.filename} | Lines: {session.total_lines} | Breakdown: {summary}\n\n"
            f"Errors:\n{error_lines or '  (none)'}\n\nWarnings:\n{warning_lines or '  (none)'}"
        )

    system_prompt = (
        "You are CrashLens AI, a log analysis assistant. Be concise and direct. "
        "Reference line numbers. Use bullet points. Max 150 words per response.\n\n"
        + (log_context if log_context else "No log loaded yet. Ask the user to upload a log file.")
    )

    messages = [{"role": "system", "content": system_prompt}]
    for m in data.history[-6:]:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": data.message})

    import asyncio

    client = Groq(api_key=api_key)

    async def token_stream():
        try:
            stream = await asyncio.to_thread(
                lambda: client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=messages,
                    stream=True,
                    max_tokens=512,
                )
            )
            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    yield token
        except Exception as e:
            yield f"[Error: {str(e)[:120]}]"

    return StreamingResponse(
        token_stream(),
        media_type="text/plain",
        headers={"Access-Control-Allow-Origin": "http://localhost:3000"},
    )
