"""
backend/scripts/migrate_session_id_to_objectid.py

One-time migration script for Step 9:
Converts string-typed `session_id` fields in the `attendance` collection to
native MongoDB `ObjectId` types.

Usage:
    python backend/scripts/migrate_session_id_to_objectid.py [--dry-run] [--verify]

Options:
    --dry-run   Scan and report convertible documents without writing updates.
    --verify    Check for any remaining documents with string session_id.
"""

import argparse
import logging
import os
import sys
from bson import ObjectId
from dotenv import load_dotenv
import pymongo

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("migration")


def get_mongo_collection():
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "attendance_db")
    client = pymongo.MongoClient(
        mongo_url,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
    )
    db = client[db_name]
    return client, db["attendance"]


def run_migration(dry_run: bool = False, verify_only: bool = False):
    client, col = get_mongo_collection()
    logger.info("Connected to MongoDB for attendance migration. dry_run=%s verify_only=%s", dry_run, verify_only)

    total_docs = col.count_documents({})
    logger.info("Total documents in 'attendance' collection: %d", total_docs)

    cursor = col.find({}, {"_id": 1, "session_id": 1})

    string_count = 0
    objectid_count = 0
    invalid_count = 0
    updated_count = 0

    for doc in cursor:
        sess_id = doc.get("session_id")
        if isinstance(sess_id, ObjectId):
            objectid_count += 1
        elif isinstance(sess_id, str):
            string_count += 1
            if ObjectId.is_valid(sess_id):
                if not dry_run and not verify_only:
                    col.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"session_id": ObjectId(sess_id)}}
                    )
                    updated_count += 1
            else:
                invalid_count += 1
                logger.warning("Doc _id=%s has invalid ObjectId string for session_id: %r", doc["_id"], sess_id)
        else:
            logger.warning("Doc _id=%s has unexpected session_id type %s: %r", doc["_id"], type(sess_id), sess_id)

    logger.info("Migration summary:")
    logger.info("  Total scanned:      %d", total_docs)
    logger.info("  Already ObjectId:   %d", objectid_count)
    logger.info("  String session_ids: %d", string_count)
    logger.info("  Invalid strings:    %d", invalid_count)
    if not dry_run and not verify_only:
        logger.info("  Updated to ObjectId:%d", updated_count)

    client.close()
    return {
        "total": total_docs,
        "already_objectid": objectid_count,
        "string_count": string_count,
        "invalid_count": invalid_count,
        "updated": updated_count,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate session_id to ObjectId in attendance collection.")
    parser.add_argument("--dry-run", action="store_true", help="Perform scan without writing to DB")
    parser.add_argument("--verify", action="store_true", help="Verify if any string session_id remain")
    args = parser.parse_args()

    results = run_migration(dry_run=args.dry_run, verify_only=args.verify)
    if args.verify and results["string_count"] > 0:
        logger.error("Verification failed: %d string session_ids remain.", results["string_count"])
        sys.exit(1)
    logger.info("Operation completed successfully.")
