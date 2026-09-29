# 🗄️ Database Schemas & Indexing Strategy

SmartAttend persists documents in **MongoDB Atlas** using the asynchronous **Motor** driver (`AsyncIOMotorClient`).

---

## 1. Primary Collections

### `users`
System credentials and access role permissions.
```json
{
  "_id": "ObjectId",
  "username": "admin",
  "password_hash": "scrypt$16384$8$1$c81f...$04d2...",
  "role": "admin",
  "is_active": true,
  "created_at": "2026-09-12T13:00:00Z"
}
```

### `persons`
Enrolled subject profiles and metadata.
```json
{
  "_id": "c7f99147-36e6-42d1-9430-c3d3957bf9e1",
  "name": "Jashan Randhawa",
  "email": "jashan@example.com",
  "department": "Engineering",
  "photo_url": "https://...",
  "enrolled_at": "2026-09-12T13:05:00Z",
  "enrolled_by": "66e2c...",
  "is_active": true
}
```

### `face_encodings`
512-dimensional normalized facial feature vectors.
```json
{
  "_id": "c7f99147-36e6-42d1-9430-c3d3957bf9e1",
  "name": "Jashan Randhawa",
  "embeddings": [
    [-0.0421, 0.0812, "... 512 normalized float values ..."]
  ]
}
```

### `sessions`
Attendance tracking periods.
```json
{
  "_id": "ObjectId('66e2d1487f98...')",
  "label": "CS101 Morning Lecture",
  "department": "Engineering",
  "started_at": "2026-09-12T14:00:00Z",
  "ended_at": null,
  "is_active": true
}
```

### `attendance`
Individual attendance event records.
```json
{
  "_id": "ObjectId('66e2d1998a12...')",
  "person_id": "c7f99147-36e6-42d1-9430-c3d3957bf9e1",
  "session_id": "ObjectId('66e2d1487f98...')",
  "marked_at": "2026-09-12T14:02:18Z",
  "confidence": 0.8942,
  "status": "present",
  "marked_by": "66e2c..."
}
```

---

## 2. Compound Unique Idempotency Indexes

To prevent accidental double-attendance marking (caused by camera frame loops, double clicks, or multiple cameras), the database enforces a **compound unique index**:

```python
await db.attendance.create_index(
    [("person_id", 1), ("session_id", 1)],
    unique=True,
    name="uniq_person_session"
)
```

When marking attendance, the application handles collisions via `DuplicateKeyError`:
```python
try:
    await db.attendance.insert_one(record)
except DuplicateKeyError:
    # Safely ignored: person is already marked present for this session
    pass
```

---

## 3. Native `ObjectId` Standardization

All `session_id` references are stored as native MongoDB `ObjectId` rather than plain strings. This guarantees:
1. Index lookup efficiency without string casting.
2. Reduced index storage overhead.
3. Native MongoDB pipeline compatibility.

A migration script (`scripts/migrate_session_id_to_objectid.py`) is provided for retrofitting legacy databases.
