from __future__ import annotations

import os
from pymongo import MongoClient, UpdateOne


SOURCE_URI = os.getenv("SOURCE_MONGODB_URI", "mongodb://localhost:27017")
SOURCE_DB = os.getenv("SOURCE_MONGODB_DB", "rankradar_os")
TARGET_URI = os.environ["TARGET_MONGODB_URI"]
TARGET_DB = os.getenv("TARGET_MONGODB_DB", "rankradar-os")
COLLECTIONS = ["brands", "marketplaces", "products", "product_variations", "sync_runs"]


def migrate_collection(source_db, target_db, name: str) -> int:
    rows = list(source_db[name].find({}))
    if not rows:
        return 0
    operations = []
    for row in rows:
        row.pop("_id", None)
        key = {"id": row["id"]} if "id" in row else row
        operations.append(UpdateOne(key, {"$set": row}, upsert=True))
    target_db[name].bulk_write(operations, ordered=False)
    return len(rows)


def main() -> None:
    source = MongoClient(SOURCE_URI, serverSelectionTimeoutMS=5000)
    target = MongoClient(TARGET_URI, serverSelectionTimeoutMS=10000)
    source.admin.command("ping")
    target.admin.command("ping")
    source_db = source[SOURCE_DB]
    target_db = target[TARGET_DB]
    counts = {name: migrate_collection(source_db, target_db, name) for name in COLLECTIONS}
    print({"target_db": TARGET_DB, "migrated": counts})


if __name__ == "__main__":
    main()
