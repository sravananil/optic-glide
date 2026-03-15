from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

class Database:
    client: AsyncIOMotorClient = None
    db = None

db = Database()

async def connect_to_mongo():
    db.client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
    db.db = db.client.opticglide_db
    
    # Create TTL Index: Deletes documents 7 days (604800 seconds) after 'createdAt'
    await db.db.nodes.create_index("createdAt", expireAfterSeconds=604800)
    print("Connected to MongoDB & TTL Index verified (7-day retention).")

async def close_mongo_connection():
    db.client.close()