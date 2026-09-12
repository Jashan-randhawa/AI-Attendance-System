# 📡 Complete REST API Reference

All protected endpoints require either `Authorization: Bearer <JWT>` or `X-API-Key: <key>`. Admin credentials satisfy both operator and admin scopes.

---

## 1. Authentication Endpoints

### `POST /api/auth/token`
Authenticate with username and password to obtain a signed JWT.

- **Access**: Public
- **Request Body (JSON)**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "role": "admin",
    "username": "admin"
  }
  ```

### `GET /api/auth/me`
Retrieve user profile and assigned role.
- **Access**: Operator or Admin
- **Response (200 OK)**:
  ```json
  {
    "username": "operator",
    "role": "operator",
    "is_active": true
  }
  ```

### `POST /api/auth/register`
Provision a new user account.
- **Access**: Admin only
- **Request Body (JSON)**:
  ```json
  {
    "username": "jashan_operator",
    "password": "SecurePassword123!",
    "role": "operator"
  }
  ```

---

## 2. Persons & Biometrics Endpoints

### `GET /api/persons`
List all active enrolled persons.
- **Access**: Admin only
- **Query Parameters**: `?department=Engineering` (optional)

### `POST /api/persons/enroll`
Enroll a person with photos, performing quality validation, duplicate checks, and vector indexing.
- **Access**: Admin only (`Rate limit: 10/min`)
- **Request (Multipart Form Data)**:
  - `name`: string
  - `department`: string
  - `email`: string
  - `photos`: Array of image files (JPEG, PNG)

### `POST /api/persons/enroll/analyze`
Pre-enrollment quality diagnostic on a raw photo before final submission.
- **Access**: Admin only (`Rate limit: 20/min`)
- **Request (Multipart Form Data)**: `photo`: File
- **Response (200 OK)**:
  ```json
  {
    "face_detected": true,
    "confidence": 0.894,
    "quality_score": 0.92,
    "box": [120, 85, 340, 310],
    "passed_gate": true,
    "rejection_reason": null
  }
  ```

### `DELETE /api/persons/{id}`
Soft-deletes a person record while preserving historical attendance logs.
- **Access**: Admin only

---

## 3. Session Endpoints

### `POST /api/sessions`
Create a new attendance session.
- **Access**: Operator or Admin
- **Request Body (JSON)**:
  ```json
  {
    "label": "CS101 Morning Lecture",
    "department": "Computer Science"
  }
  ```

### `PATCH /api/sessions/{id}/end`
Mark an active session as concluded.
- **Access**: Operator or Admin

---

## 4. Attendance Endpoints

### `POST /api/attendance/identify`
Identifies all faces in an image frame without recording attendance.
- **Access**: Operator or Admin (`Rate limit: 20/min`)
- **Request (Multipart Form Data)**: `file`: Image file
- **Response (200 OK)**:
  ```json
  {
    "faces": [
      {
        "person_id": "c7f99147-36e6-42d1-9430-c3d3957bf9e1",
        "name": "Jashan Randhawa",
        "confidence": 0.872,
        "box": [110, 95, 290, 280]
      }
    ]
  }
  ```

### `POST /api/attendance/mark/{session_id}`
Identifies faces in a frame and idempotently marks them present in the given session.
- **Access**: Operator or Admin (`Rate limit: 20/min`)

### `GET /api/attendance/export/csv`
Download attendance records in CSV format.
- **Access**: Admin only
- **Query Parameters**: `?session_id=...`, `?start_date=...`, `?end_date=...`
