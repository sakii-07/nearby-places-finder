import argparse

from sqlalchemy import select

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.user import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the first admin account for Nearby Places Finder.")
    parser.add_argument("--name", required=True, help="Full name for the admin user")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Strong password for the admin account")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existing_email = db.scalar(select(User).where(User.email == args.email.lower()))
        if existing_email is not None:
            raise SystemExit("An account with this email already exists.")
        if db.scalar(select(User).where(User.role == "admin")) is not None:
            raise SystemExit("An admin account already exists in the database.")

        admin = User(
            name=args.name,
            email=args.email.lower(),
            hashed_password=hash_password(args.password),
            role="admin",
        )
        db.add(admin)
        db.commit()
        print(f"Admin account created for {args.email} with id {admin.id}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
