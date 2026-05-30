from app.modules.clinic.schemas import ClinicSettingsUpdate


def test_clinic_settings_update_normalizes_text() -> None:
    payload = ClinicSettingsUpdate(
        name="  Clinica Exemplo  ",
        legal_name="  Clinica Exemplo LTDA  ",
        document="  00.000.000/0001-00  ",
        currency=" brl ",
    )

    assert payload.name == "Clinica Exemplo"
    assert payload.legal_name == "Clinica Exemplo LTDA"
    assert payload.document == "00.000.000/0001-00"
    assert payload.currency == "BRL"


def test_clinic_settings_update_allows_clearing_optional_fields() -> None:
    payload = ClinicSettingsUpdate(phone=None, email="  ")

    assert payload.phone is None
    assert payload.email is None
