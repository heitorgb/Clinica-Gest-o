from app.core.config import get_settings
from app.db.session import SessionLocal
from app.modules.users.service import create_initial_superuser


def main() -> None:
    settings = get_settings()

    if not settings.first_superuser_email or not settings.first_superuser_password:
        print("Seed admin ignorado: FIRST_SUPERUSER_EMAIL ou FIRST_SUPERUSER_PASSWORD ausente.")
        return

    with SessionLocal() as db:
        user = create_initial_superuser(
            db=db,
            name=settings.first_superuser_name or "Administrador",
            email=settings.first_superuser_email,
            password=settings.first_superuser_password,
        )
        admin_email = user.email

    print(f"Administrador inicial disponivel: {admin_email}")


if __name__ == "__main__":
    main()
